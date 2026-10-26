import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class RateLimiter:
    """Sliding-window limiter per client IP, usable as a FastAPI dependency.

    In-memory, so it resets on restart and is per process; plenty for a
    single-instance portfolio backend.
    """

    def __init__(self, limit: int, window_seconds: float, message: str) -> None:
        self._limit = limit
        self._window = window_seconds
        self._message = message
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        # Behind a proxy, run uvicorn with --proxy-headers so this is the
        # visitor's address rather than the proxy's.
        ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        hits = self._hits[ip]
        while hits and now - hits[0] > self._window:
            hits.popleft()
        if len(hits) >= self._limit:
            raise HTTPException(status_code=429, detail=self._message)
        hits.append(now)
