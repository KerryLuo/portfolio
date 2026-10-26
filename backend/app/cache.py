import time
from typing import Generic, TypeVar

T = TypeVar("T")


class TtlCache(Generic[T]):
    """Tiny in-memory cache.

    On upstream failure the caller can still fall back to the last good value,
    so the site keeps working through a GitHub outage or rate limit.
    """

    def __init__(self, ttl_seconds: float) -> None:
        self._ttl = ttl_seconds
        self._value: T | None = None
        self._expires = 0.0

    def fresh(self) -> T | None:
        return self._value if time.monotonic() < self._expires else None

    def stale(self) -> T | None:
        return self._value

    def set(self, value: T) -> None:
        self._value = value
        self._expires = time.monotonic() + self._ttl
