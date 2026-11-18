"""Async in-memory Pub/Sub event bus for live WebSocket streaming & Band fallback."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from shared.schemas import AgentEvent

logger = logging.getLogger(__name__)


class AsyncEventBus:
    """Fan-out event bus supporting multiple WebSocket subscribers per campaign.

    Maintains an ordered per-campaign event history so newly connected frontend
    WebSocket clients immediately receive all prior events before streaming live
    updates from either Band or the local fallback transport.
    """

    def __init__(self, max_queue_size: int = 256, max_history: int = 500) -> None:
        self._max_queue_size = max_queue_size
        self._max_history = max_history
        self._subscribers: dict[str, set[asyncio.Queue[AgentEvent]]] = defaultdict(set)
        self._history: dict[str, list[AgentEvent]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def publish(self, event: AgentEvent) -> None:
        """Record an event in history and deliver it to all active subscribers."""
        async with self._lock:
            history = self._history[event.campaign_id]
            if not any(existing.event_id == event.event_id for existing in history):
                history.append(event)
                if len(history) > self._max_history:
                    del history[: len(history) - self._max_history]

            subscribers = list(self._subscribers.get(event.campaign_id, set()))

        for queue in subscribers:
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                logger.warning(
                    "Dropped oldest queued event for slow WebSocket subscriber on campaign %s",
                    event.campaign_id,
                )
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.debug("Subscriber queue still full for campaign %s", event.campaign_id)

    async def get_history(self, campaign_id: str) -> list[AgentEvent]:
        """Return a snapshot of recorded events for a campaign."""
        async with self._lock:
            return list(self._history.get(campaign_id, []))

    async def seed_history(self, campaign_id: str, events: list[AgentEvent]) -> None:
        """Hydrate in-memory history from persistent storage after process restart."""
        if not events:
            return
        async with self._lock:
            existing_ids = {e.event_id for e in self._history[campaign_id]}
            for event in events:
                if event.event_id not in existing_ids:
                    self._history[campaign_id].append(event)
                    existing_ids.add(event.event_id)

    @asynccontextmanager
    async def subscribe(
        self, campaign_id: str, replay_history: bool = True
    ) -> AsyncIterator[tuple[list[AgentEvent], asyncio.Queue[AgentEvent]]]:
        """Subscribe to live events for `campaign_id`, returning (history_snapshot, queue)."""
        queue: asyncio.Queue[AgentEvent] = asyncio.Queue(maxsize=self._max_queue_size)
        async with self._lock:
            snapshot = list(self._history.get(campaign_id, [])) if replay_history else []
            self._subscribers[campaign_id].add(queue)
        try:
            yield snapshot, queue
        finally:
            async with self._lock:
                self._subscribers[campaign_id].discard(queue)
                if not self._subscribers[campaign_id]:
                    self._subscribers.pop(campaign_id, None)

    async def subscriber_count(self, campaign_id: str) -> int:
        """Return the number of active WebSocket subscribers for a campaign."""
        async with self._lock:
            return len(self._subscribers.get(campaign_id, set()))
