import asyncio
import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.cache import TtlCache
from app.config import settings

log = logging.getLogger("portfolio.github")

router = APIRouter(prefix="/api/github", tags=["github"])

API = "https://api.github.com"
DAYS = 53 * 7  # a year of weeks, like github.com


class Day(BaseModel):
    date: str
    count: int
    level: Literal[0, 1, 2, 3, 4]


class Recent(BaseModel):
    repo: str
    url: str
    date: str
    commits: int


class Activity(BaseModel):
    username: str
    profileUrl: str
    total: int
    # "calendar" = full contribution calendar (needs a token); "events" = built
    # from recent public events, which GitHub only keeps for about 90 days.
    source: Literal["calendar", "events"]
    days: list[Day]
    recent: list[Recent]


cache: TtlCache[Activity] = TtlCache(10 * 60)
lock = asyncio.Lock()  # one rebuild at a time, so a cold cache isn't stampeded


def headers() -> dict[str, str]:
    h = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "portfolio-backend",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if settings.github_token:
        h["Authorization"] = f"Bearer {settings.github_token}"
    return h


def empty_window() -> dict[str, int]:
    """Every day in the window, oldest first, so the grid has no gaps."""
    today = datetime.now(UTC).date()
    return {(today - timedelta(days=i)).isoformat(): 0 for i in range(DAYS - 1, -1, -1)}


def to_days(counts: dict[str, int]) -> list[Day]:
    # Shade by quartile of the active days, like github.com, so one huge day
    # doesn't wash out everything else.
    active = sorted(c for c in counts.values() if c)
    cuts = [active[min(len(active) - 1, int(len(active) * p))] for p in (0.25, 0.5, 0.75)] if active else []

    def level(count: int) -> Literal[0, 1, 2, 3, 4]:
        if count == 0:
            return 0
        return 1 + sum(count > cut for cut in cuts)  # type: ignore[return-value]

    return [Day(date=date, count=count, level=level(count)) for date, count in counts.items()]


def commits_in(event: dict[str, Any]) -> int:
    payload = event.get("payload", {})
    size = payload.get("size")
    if size is not None:
        return size
    commits = payload.get("commits")
    return len(commits) if commits is not None else 1


async def fetch_events(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for page in range(1, 4):
        res = await client.get(
            f"{API}/users/{settings.github_username}/events/public",
            params={"per_page": 100, "page": page},
        )
        res.raise_for_status()
        batch = res.json()
        events.extend(batch)
        if len(batch) < 100:
            break
    return [e for e in events if e["type"] == "PushEvent"]


CALENDAR_QUERY = """
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}
"""


async def fetch_calendar(client: httpx.AsyncClient) -> tuple[dict[str, int], int]:
    res = await client.post(
        f"{API}/graphql",
        json={"query": CALENDAR_QUERY, "variables": {"login": settings.github_username}},
    )
    res.raise_for_status()
    user = (res.json().get("data") or {}).get("user")
    if not user:
        raise ValueError("GitHub GraphQL returned no calendar")
    calendar = user["contributionsCollection"]["contributionCalendar"]

    counts = empty_window()
    for week in calendar["weeks"]:
        for day in week["contributionDays"]:
            if day["date"] in counts:
                counts[day["date"]] = day["contributionCount"]
    return counts, calendar["totalContributions"]


DAY_CELL = re.compile(r'<td[^>]*?data-date="([^"]+)"[^>]*?id="([^"]+)"')
DAY_TIP = re.compile(r'<tool-tip[^>]*?for="([^"]+)"[^>]*>(\d[\d,]*) contribution')


async def fetch_profile_calendar() -> tuple[dict[str, int], int]:
    """Read the calendar GitHub renders on the public profile page.

    Needs no token, and matches what the profile shows, including private
    contributions when "Include private contributions" is on. It parses HTML,
    so it is the first thing to break if GitHub changes the markup.
    """
    async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "portfolio-backend"}) as client:
        res = await client.get(f"https://github.com/users/{settings.github_username}/contributions")
    res.raise_for_status()

    dates = {id_: date for date, id_ in DAY_CELL.findall(res.text)}
    if not dates:
        raise ValueError("Profile page had no contribution calendar")

    counts = empty_window()
    for id_, n in DAY_TIP.findall(res.text):
        date = dates.get(id_)
        if date in counts:
            counts[date] = int(n.replace(",", ""))
    return counts, sum(counts.values())


async def build() -> Activity:
    async with httpx.AsyncClient(headers=headers(), timeout=10) as client:
        events = await fetch_events(client)

        counts = empty_window()
        total = 0
        source: Literal["calendar", "events"] = "events"

        # Best source first: the official API (token), then the public profile
        # calendar, then recent push events (about 90 days, public only).
        if settings.github_token:
            try:
                counts, total = await fetch_calendar(client)
                source = "calendar"
            except (httpx.HTTPError, ValueError):
                log.exception("GraphQL calendar failed, trying the profile page")

        if source == "events":
            try:
                counts, total = await fetch_profile_calendar()
                source = "calendar"
            except (httpx.HTTPError, ValueError):
                log.exception("Profile calendar failed, falling back to events")

    if source == "events":
        for e in events:
            day = e["created_at"][:10]
            if day in counts:
                counts[day] += commits_in(e)
                total += commits_in(e)

    # One row per repo per day, so several pushes don't list the same repo over
    # and over. Events arrive newest first.
    grouped: dict[str, Recent] = {}
    for e in events:
        repo = e["repo"]["name"]
        key = f"{repo}@{e['created_at'][:10]}"
        if key in grouped:
            grouped[key].commits += commits_in(e)
        else:
            grouped[key] = Recent(
                repo=repo,
                url=f"https://github.com/{repo}",
                date=e["created_at"],
                commits=commits_in(e),
            )

    return Activity(
        username=settings.github_username,
        profileUrl=f"https://github.com/{settings.github_username}",
        total=total,
        source=source,
        days=to_days(counts),
        recent=list(grouped.values())[:5],
    )


@router.get("/activity", response_model=Activity)
async def activity() -> Activity:
    if hit := cache.fresh():
        return hit
    async with lock:
        if hit := cache.fresh():  # another request rebuilt it while we waited
            return hit
        try:
            result = await build()
        except httpx.HTTPError:
            log.exception("GitHub activity failed")
            if stale := cache.stale():
                return stale
            raise HTTPException(502, "GitHub activity is unavailable right now.")
        cache.set(result)
        return result
