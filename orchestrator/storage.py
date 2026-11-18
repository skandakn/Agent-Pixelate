"""Persistent file-backed campaign state, Band memory mirror, and asset store.

Designed for Agent37 persistent volume storage (`/data/campaigns`) with atomic
JSON writes and per-campaign asyncio locking.
"""

from __future__ import annotations

import asyncio
import json
import os
from collections import defaultdict
from pathlib import Path

from shared.schemas import (
    AgentEvent,
    BandMemoryEntry,
    CampaignResponse,
    CampaignStatus,
    CopyOutput,
    VisualOutput,
    utc_now,
)


class CampaignStore:
    """Durable campaign store on `/data/campaigns` (or local fallback dir)."""

    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    def campaign_dir(self, campaign_id: str) -> Path:
        safe_id = self._sanitize_segment(campaign_id)
        return self.base_dir / safe_id

    def assets_dir(self, campaign_id: str) -> Path:
        path = self.campaign_dir(campaign_id) / "assets"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _state_path(self, campaign_id: str) -> Path:
        return self.campaign_dir(campaign_id) / "state.json"

    def _memories_path(self, campaign_id: str) -> Path:
        return self.campaign_dir(campaign_id) / "memories.json"

    @staticmethod
    def _sanitize_segment(segment: str) -> str:
        cleaned = Path(segment).name
        if not cleaned or cleaned in {".", ".."} or "/" in segment or "\\" in segment:
            raise ValueError(f"Invalid path segment: {segment!r}")
        return cleaned

    @staticmethod
    def _atomic_write_json(path: Path, data: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_suffix(path.suffix + ".tmp")
        tmp_path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
        os.replace(tmp_path, path)

    def _load_sync(self, campaign_id: str) -> CampaignResponse | None:
        state_file = self._state_path(campaign_id)
        if not state_file.exists():
            return None
        raw = json.loads(state_file.read_text(encoding="utf-8"))
        return CampaignResponse.model_validate(raw)

    def _save_sync(self, campaign: CampaignResponse) -> None:
        self._atomic_write_json(
            self._state_path(campaign.campaign_id),
            campaign.model_dump(mode="json"),
        )

    async def save_campaign(self, campaign: CampaignResponse) -> CampaignResponse:
        async with self._locks[campaign.campaign_id]:
            campaign.updated_at = utc_now()
            await asyncio.to_thread(self._save_sync, campaign)
            return campaign

    async def get_campaign(self, campaign_id: str) -> CampaignResponse | None:
        async with self._locks[campaign_id]:
            return await asyncio.to_thread(self._load_sync, campaign_id)

    async def list_campaigns(self, limit: int = 50) -> list[CampaignResponse]:
        def _scan() -> list[CampaignResponse]:
            results: list[CampaignResponse] = []
            if not self.base_dir.exists():
                return results
            for entry in self.base_dir.iterdir():
                if not entry.is_dir():
                    continue
                state_file = entry / "state.json"
                if not state_file.exists():
                    continue
                try:
                    raw = json.loads(state_file.read_text(encoding="utf-8"))
                    results.append(CampaignResponse.model_validate(raw))
                except Exception:
                    continue
            results.sort(key=lambda c: c.created_at, reverse=True)
            return results[:limit]

        return await asyncio.to_thread(_scan)

    async def append_event(self, campaign_id: str, event: AgentEvent) -> CampaignResponse | None:
        async with self._locks[campaign_id]:
            campaign = await asyncio.to_thread(self._load_sync, campaign_id)
            if campaign is None:
                return None
            if not any(existing.event_id == event.event_id for existing in campaign.events):
                campaign.events.append(event)
                campaign.updated_at = utc_now()
                await asyncio.to_thread(self._save_sync, campaign)
            return campaign

    async def update_status(
        self,
        campaign_id: str,
        status: CampaignStatus,
        error: str | None = None,
    ) -> CampaignResponse | None:
        async with self._locks[campaign_id]:
            campaign = await asyncio.to_thread(self._load_sync, campaign_id)
            if campaign is None:
                return None
            campaign.status = status
            if error is not None:
                campaign.error = error
            campaign.updated_at = utc_now()
            await asyncio.to_thread(self._save_sync, campaign)
            return campaign

    async def set_visual_output(
        self,
        campaign_id: str,
        visual_output: VisualOutput,
        status: CampaignStatus = CampaignStatus.HANDOFF_TO_COPY,
    ) -> CampaignResponse | None:
        async with self._locks[campaign_id]:
            campaign = await asyncio.to_thread(self._load_sync, campaign_id)
            if campaign is None:
                return None
            campaign.visual_output = visual_output
            campaign.status = status
            campaign.updated_at = utc_now()
            await asyncio.to_thread(self._save_sync, campaign)
            return campaign

    async def set_copy_output(
        self,
        campaign_id: str,
        copy_output: CopyOutput,
        status: CampaignStatus = CampaignStatus.COMPLETED,
    ) -> CampaignResponse | None:
        async with self._locks[campaign_id]:
            campaign = await asyncio.to_thread(self._load_sync, campaign_id)
            if campaign is None:
                return None
            campaign.copy_output = copy_output
            campaign.status = status
            campaign.updated_at = utc_now()
            await asyncio.to_thread(self._save_sync, campaign)
            return campaign

    async def save_memory(self, memory: BandMemoryEntry) -> BandMemoryEntry:
        async with self._locks[memory.campaign_id]:
            path = self._memories_path(memory.campaign_id)

            def _write() -> None:
                items: list[dict] = []
                if path.exists():
                    items = json.loads(path.read_text(encoding="utf-8"))
                items.append(memory.model_dump(mode="json"))
                self._atomic_write_json(path, items)

            await asyncio.to_thread(_write)
            return memory

    async def get_memories(self, campaign_id: str) -> list[BandMemoryEntry]:
        async with self._locks[campaign_id]:
            path = self._memories_path(campaign_id)

            def _read() -> list[BandMemoryEntry]:
                if not path.exists():
                    return []
                raw_items = json.loads(path.read_text(encoding="utf-8"))
                return [BandMemoryEntry.model_validate(item) for item in raw_items]

            return await asyncio.to_thread(_read)

    async def write_asset_bytes(
        self, campaign_id: str, filename: str, content: bytes
    ) -> Path:
        safe_name = self._sanitize_segment(filename)
        target = self.assets_dir(campaign_id) / safe_name

        def _write_bytes() -> Path:
            tmp = target.with_suffix(target.suffix + ".tmp")
            tmp.write_bytes(content)
            os.replace(tmp, target)
            return target

        return await asyncio.to_thread(_write_bytes)

    def resolve_asset_path(self, campaign_id: str, filename: str) -> Path | None:
        safe_campaign = self._sanitize_segment(campaign_id)
        safe_name = self._sanitize_segment(filename)
        candidate = (self.base_dir / safe_campaign / "assets" / safe_name).resolve()
        expected_root = (self.base_dir / safe_campaign / "assets").resolve()
        if not str(candidate).startswith(str(expected_root)):
            return None
        return candidate if candidate.is_file() else None
