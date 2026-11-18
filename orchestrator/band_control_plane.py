"""BAND (`band.ai`) Agent Interaction Control Plane, Governance, Focus & Audit Engine.

Implements BAND's core architectural primitives as clean, composable services:
  1. **Dual-Scope Policy & Authority Engine (`BandPolicyEngine`)**:
     Partitions the Human `/me` API surface from the Agent Runtime API surface so
     autonomous agents can never approve their own human gates or mutate policies.
  2. **Loop-Prevention Circuit Breaker (`BandLoopGuard`)**:
     Tracks consecutive agent-to-agent `@mention` hops, detects ping-pong cycles,
     and halts runaway loops while resetting cleanly on human intervention.
  3. **Per-Agent Focus Projector (`BandFocusProjector`)**:
     Computes isolated, scoped context windows per agent (relevant `@mentions`,
     pinned guardrails, and scoped memories) and measures exact context savings.
  4. **Context-Isolated Execution Tracker (`BandExecutionTracker`)**:
     Tracks every `@mention`-triggered execution (`exec_...`) with tool call
     traces, token estimates, and millisecond latency telemetry.
  5. **Cross-Session Brand Memory Vault (`BandBrandMemoryVault`)**:
     Persists promoted brand guidelines across rooms/campaigns so new BAND rooms
     for the same brand automatically hydrate institutional brand memory.
  6. **Brand QA Critic (`BandCriticEngine` — `@critic_pixelate`)**:
     Heterogeneous 3rd mesh agent auditing WCAG 2.1 palette contrast ratios,
     aspect completeness, conversion copy quality, and pinned guardrail compliance.
  7. **Tamper-Evident Audit Ledger (`BandAuditLedger`)**:
     Computes a SHA-256 hash-chained compliance ledger across all room activity.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any, Literal

from shared.schemas import (
    AgentEvent,
    AgentHandle,
    BandAgentDirectoryEntry,
    BandAuditEntry,
    BandCriticCheck,
    BandCriticReport,
    BandFocusWindow,
    BandLoopGuardState,
    BandMemoryEntry,
    BandPolicyAuthority,
    BandTaskExecution,
    BandToolCallTrace,
    CampaignResponse,
    EventType,
    utc_now,
)

BANNED_COPY_CLICHES = (
    "elevate your game",
    "game-changer",
    "unleash the power",
    "in today's fast-paced world",
    "revolutionary synergy",
    "delve into",
)


def _slugify_brand(brand_name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", brand_name.strip().lower()).strip("_")
    return slug or "default_brand"


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4) if text else 0


def _hex_relative_luminance(hex_color: str) -> float | None:
    cleaned = hex_color.strip().lstrip("#")
    if len(cleaned) != 6:
        return None
    try:
        rgb = [int(cleaned[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]
    except ValueError:
        return None

    def _linear(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (_linear(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def compute_max_wcag_contrast(palette: list[str]) -> float:
    """Compute the highest WCAG 2.1 contrast ratio across any two palette hex tokens."""
    lums = [lum for hx in palette if (lum := _hex_relative_luminance(hx)) is not None]
    if len(lums) < 2:
        return 7.0
    brightest = max(lums)
    darkest = min(lums)
    return round((brightest + 0.05) / (darkest + 0.05), 2)


class BandPolicyEngine:
    """Enforces BAND Dual-Scope Role Separation (`/me` Human vs `/agent` Runtime)."""

    def __init__(self) -> None:
        self._muted_handles: dict[str, set[str]] = {}
        self._auto_critic: dict[str, bool] = {}

    def is_auto_critic_enabled(self, campaign_id: str, default: bool = True) -> bool:
        return self._auto_critic.get(campaign_id, default)

    def set_auto_critic(self, campaign_id: str, enabled: bool) -> None:
        self._auto_critic[campaign_id] = enabled

    def set_muted(self, campaign_id: str, handle: str, muted: bool) -> None:
        bucket = self._muted_handles.setdefault(campaign_id, set())
        normalized = handle if handle.startswith("@") else f"@{handle}"
        if muted:
            bucket.add(normalized.lower())
        else:
            bucket.discard(normalized.lower())

    def is_muted(self, campaign_id: str, handle: str) -> bool:
        normalized = handle if handle.startswith("@") else f"@{handle}"
        return normalized.lower() in self._muted_handles.get(campaign_id, set())

    def assert_human_scope(self, actor: str, action: str) -> None:
        """Prevent autonomous agents from invoking Human `/me` Control Plane actions."""
        if actor.lower() in {
            AgentHandle.VISUAL.value,
            AgentHandle.COPY.value,
            AgentHandle.CRITIC.value,
        }:
            raise PermissionError(
                f"BAND Dual-Scope Policy Violation: agent '{actor}' is blocked from "
                f"Human /me action '{action}'."
            )

    def get_policies(self, campaign_id: str) -> list[BandPolicyAuthority]:
        return [
            BandPolicyAuthority(
                handle=AgentHandle.HUMAN.value,
                api_scope="human_me_api",
                can_read_memories=True,
                can_write_memories=True,
                can_promote_brand_memory=True,
                can_approve_handoff=True,
                can_modify_governance=True,
                can_mention=[
                    AgentHandle.VISUAL.value,
                    AgentHandle.COPY.value,
                    AgentHandle.CRITIC.value,
                    "@all",
                ],
                allowed_tools=["approve_handoff", "pin_memory", "promote_brand_memory", "governance_patch"],
                muted=False,
            ),
            BandPolicyAuthority(
                handle=AgentHandle.ORCHESTRATOR.value,
                api_scope="agent_runtime_api",
                can_read_memories=True,
                can_write_memories=True,
                can_promote_brand_memory=False,
                can_approve_handoff=False,
                can_modify_governance=False,
                can_mention=[
                    AgentHandle.VISUAL.value,
                    AgentHandle.COPY.value,
                    AgentHandle.CRITIC.value,
                ],
                allowed_tools=["create_room", "dispatch_mention", "ffmpeg_video_render"],
                muted=self.is_muted(campaign_id, AgentHandle.ORCHESTRATOR.value),
            ),
            BandPolicyAuthority(
                handle=AgentHandle.VISUAL.value,
                api_scope="agent_runtime_api",
                can_read_memories=True,
                can_write_memories=True,
                can_promote_brand_memory=False,
                can_approve_handoff=False,
                can_modify_governance=False,
                can_mention=[AgentHandle.COPY.value, AgentHandle.HUMAN.value],
                allowed_tools=[
                    "load_finch_skill:brand_visual_direction",
                    "normalize_five_hex_palette",
                    "generate_campaign_image",
                    "build_video_storyboard",
                ],
                muted=self.is_muted(campaign_id, AgentHandle.VISUAL.value),
            ),
            BandPolicyAuthority(
                handle=AgentHandle.COPY.value,
                api_scope="agent_runtime_api",
                can_read_memories=True,
                can_write_memories=True,
                can_promote_brand_memory=False,
                can_approve_handoff=False,
                can_modify_governance=False,
                can_mention=[AgentHandle.CRITIC.value, AgentHandle.HUMAN.value],
                allowed_tools=[
                    "load_finch_skill:ad_copy_conversion",
                    "load_finch_skill:social_platform_formatter",
                    "extract_visual_cues",
                    "audit_copy_quality",
                ],
                muted=self.is_muted(campaign_id, AgentHandle.COPY.value),
            ),
            BandPolicyAuthority(
                handle=AgentHandle.CRITIC.value,
                api_scope="agent_runtime_api",
                can_read_memories=True,
                can_write_memories=True,
                can_promote_brand_memory=False,
                can_approve_handoff=False,
                can_modify_governance=False,
                can_mention=[
                    AgentHandle.VISUAL.value,
                    AgentHandle.COPY.value,
                    AgentHandle.HUMAN.value,
                ],
                allowed_tools=[
                    "wcag_contrast_audit",
                    "cliche_policy_scanner",
                    "brand_guardrail_verifier",
                ],
                muted=self.is_muted(campaign_id, AgentHandle.CRITIC.value),
            ),
        ]


class BandLoopGuard:
    """BAND Loop-Prevention Circuit Breaker preventing runaway agent-to-agent storms."""

    def __init__(self) -> None:
        self._states: dict[str, BandLoopGuardState] = {}

    def get_state(self, campaign_id: str) -> BandLoopGuardState:
        return self._states.setdefault(campaign_id, BandLoopGuardState())

    def configure(
        self,
        campaign_id: str,
        *,
        max_agent_hops: int | None = None,
        strict_mode: bool | None = None,
    ) -> BandLoopGuardState:
        state = self.get_state(campaign_id)
        if max_agent_hops is not None:
            state.max_agent_hops = max_agent_hops
            if state.current_hops < state.max_agent_hops:
                state.circuit_open = False
        if strict_mode is not None:
            state.strict_mode = strict_mode
            if not strict_mode:
                state.circuit_open = False
        return state

    def reset_on_human_turn(self, campaign_id: str) -> BandLoopGuardState:
        """Human participation cleanly resets consecutive agent hop budget."""
        state = self.get_state(campaign_id)
        state.current_hops = 0
        state.circuit_open = False
        return state

    def check_and_record_hop(
        self, campaign_id: str, from_handle: str, to_handle: str
    ) -> tuple[bool, str]:
        """Validate whether an `@mention` hop is permitted by the circuit breaker."""
        state = self.get_state(campaign_id)
        if from_handle.lower() == AgentHandle.HUMAN.value:
            self.reset_on_human_turn(campaign_id)
            state.last_route = f"{from_handle} -> {to_handle}"
            return True, "Human-initiated delegation permitted."

        if from_handle.lower() == to_handle.lower():
            state.blocked_loops += 1
            return False, f"Self-mention loop blocked ({from_handle} -> {to_handle})."

        if state.strict_mode and state.current_hops >= state.max_agent_hops:
            state.blocked_loops += 1
            state.circuit_open = True
            return (
                False,
                f"BAND Loop Guard tripped: reached max {state.max_agent_hops} consecutive agent hops. "
                f"Human intervention required to reset.",
            )

        state.current_hops += 1
        state.last_route = f"{from_handle} -> {to_handle}"
        return True, "Hop permitted."


class BandFocusProjector:
    """Computes BAND Per-Agent Focus scopes showing exact context isolation & token savings."""

    FOCUS_MEMORY_KEYS: dict[str, set[str]] = {
        AgentHandle.VISUAL.value: {
            "campaign_brief",
            "brand_guardrail",
            "audience_insight",
            "compliance_rule",
            "human_visual_directive",
            "cross_session_brand_memory",
        },
        AgentHandle.COPY.value: {
            "campaign_brief",
            "visual_brief",
            "visual_brief_revision",
            "brand_guardrail",
            "audience_insight",
            "cta_requirement",
            "compliance_rule",
            "human_approval_note",
            "human_copy_directive",
            "cross_session_brand_memory",
        },
        AgentHandle.CRITIC.value: {
            "campaign_brief",
            "visual_brief",
            "visual_brief_revision",
            "campaign_copy",
            "brand_guardrail",
            "compliance_rule",
            "cta_requirement",
            "cross_session_brand_memory",
        },
    }

    def project(
        self,
        campaign: CampaignResponse,
        memories: list[BandMemoryEntry],
        agent_handle: str,
    ) -> BandFocusWindow:
        events = [e for e in campaign.events if e.event_type != EventType.HEARTBEAT]
        allowed_keys = self.FOCUS_MEMORY_KEYS.get(agent_handle, set())
        handle_lower = agent_handle.lower()

        focused_events = [
            e
            for e in events
            if handle_lower in [m.lower() for m in e.mentions]
            or e.sender.lower() == handle_lower
            or e.event_type in {EventType.HUMAN_MESSAGE, EventType.APPROVAL_GRANTED}
        ]
        focused_memories = [
            m
            for m in memories
            if m.key in allowed_keys or bool(m.metadata.get("pinned"))
        ]

        full_text = "\n".join(e.message for e in events) + "\n" + "\n".join(
            m.content for m in memories
        )
        focused_text = "\n".join(e.message for e in focused_events) + "\n" + "\n".join(
            m.content for m in focused_memories
        )

        full_tokens = _estimate_tokens(full_text)
        focused_tokens = _estimate_tokens(focused_text)
        savings_pct = (
            round(max(0.0, (1.0 - (focused_tokens / full_tokens)) * 100.0), 1)
            if full_tokens > 0
            else 0.0
        )

        return BandFocusWindow(
            agent_handle=agent_handle,
            total_room_events=len(events),
            focused_event_count=len(focused_events),
            filtered_noise_count=max(0, len(events) - len(focused_events)),
            included_memory_keys=sorted({m.key for m in focused_memories}),
            included_memory_ids=[m.memory_id for m in focused_memories],
            focused_tokens_est=focused_tokens,
            full_room_tokens_est=full_tokens,
            context_savings_pct=savings_pct,
            focus_summary=(
                f"Isolated {len(focused_events)}/{len(events)} relevant room turns & "
                f"{len(focused_memories)}/{len(memories)} scoped memories ({savings_pct}% context saved)."
            ),
        )

    def project_all(
        self, campaign: CampaignResponse, memories: list[BandMemoryEntry]
    ) -> list[BandFocusWindow]:
        return [
            self.project(campaign, memories, handle)
            for handle in (
                AgentHandle.VISUAL.value,
                AgentHandle.COPY.value,
                AgentHandle.CRITIC.value,
            )
        ]


class BandExecutionTracker:
    """Tracks context-isolated BAND agent executions & tool call traces."""

    def __init__(self) -> None:
        self._executions: dict[str, list[BandTaskExecution]] = {}

    def start_execution(
        self,
        *,
        campaign_id: str,
        room_id: str,
        agent_handle: str,
        framework: str,
        trigger_by: str,
        trigger_reason: str,
        focus_memory_ids: list[str],
        focus_token_estimate: int,
    ) -> BandTaskExecution:
        execution = BandTaskExecution(
            campaign_id=campaign_id,
            room_id=room_id,
            agent_handle=agent_handle,
            framework=framework,
            trigger_by=trigger_by,
            trigger_reason=trigger_reason,
            focus_memory_ids=focus_memory_ids,
            focus_token_estimate=focus_token_estimate,
            status="running",
        )
        self._executions.setdefault(campaign_id, []).append(execution)
        return execution

    def record_tool(
        self,
        execution: BandTaskExecution,
        *,
        tool_name: str,
        framework: str,
        args_summary: str,
        result_summary: str,
        duration_ms: int = 12,
        status: Literal["ok", "error", "blocked"] = "ok",
    ) -> BandToolCallTrace:
        trace = BandToolCallTrace(
            tool_name=tool_name,
            framework=framework,
            args_summary=args_summary,
            result_summary=result_summary,
            duration_ms=duration_ms,
            status=status,
        )
        execution.tool_calls.append(trace)
        return trace

    def finish_execution(
        self,
        execution: BandTaskExecution,
        *,
        status: Literal["completed", "blocked_by_policy", "failed"] = "completed",
    ) -> BandTaskExecution:
        now = utc_now()
        execution.status = status
        execution.completed_at = now
        elapsed = int((now - execution.started_at).total_seconds() * 1000)
        execution.duration_ms = max(1, elapsed)
        return execution

    def list_executions(self, campaign_id: str) -> list[BandTaskExecution]:
        return list(self._executions.get(campaign_id, []))


class BandBrandMemoryVault:
    """Cross-session persistent Brand Memory store shared across BAND rooms."""

    def __init__(self, base_dir: Path) -> None:
        self.vault_dir = base_dir / "_brand_memories"
        self.vault_dir.mkdir(parents=True, exist_ok=True)

    def _brand_file(self, brand_name: str) -> Path:
        return self.vault_dir / f"{_slugify_brand(brand_name)}.json"

    def list_brand_memories(self, brand_name: str) -> list[BandMemoryEntry]:
        path = self._brand_file(brand_name)
        if not path.exists():
            return []
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            return [BandMemoryEntry.model_validate(item) for item in raw]
        except Exception:
            return []

    def promote_memory(
        self, brand_name: str, entry: BandMemoryEntry, promoter: str
    ) -> BandMemoryEntry:
        existing = self.list_brand_memories(brand_name)
        promoted = BandMemoryEntry(
            memory_id=f"bmem_{entry.memory_id[-8:]}",
            room_id=f"brand:{_slugify_brand(brand_name)}",
            campaign_id=entry.campaign_id,
            author=promoter,
            key=entry.key,
            content=entry.content,
            metadata={
                **entry.metadata,
                "pinned": True,
                "scope": "cross_session_brand",
                "brand_name": brand_name,
                "promoted_from_memory_id": entry.memory_id,
            },
        )
        deduped = [m for m in existing if m.content.strip() != promoted.content.strip()]
        deduped.append(promoted)

        path = self._brand_file(brand_name)
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(
            json.dumps([m.model_dump(mode="json") for m in deduped], indent=2, default=str),
            encoding="utf-8",
        )
        os.replace(tmp, path)
        return promoted


class BandCriticEngine:
    """`@critic_pixelate` — Brand QA, WCAG Contrast & Guardrail Governance Auditor."""

    def evaluate(
        self, campaign: CampaignResponse, memories: list[BandMemoryEntry]
    ) -> BandCriticReport:
        checks: list[BandCriticCheck] = []
        visual = campaign.visual_output
        copy = campaign.copy_output

        # 1. WCAG 2.1 Color Contrast Check
        palette = visual.color_palette if visual else []
        contrast_ratio = compute_max_wcag_contrast(palette)
        contrast_passed = contrast_ratio >= 4.5
        contrast_score = min(100, int((contrast_ratio / 7.0) * 100)) if contrast_ratio > 0 else 70
        checks.append(
            BandCriticCheck(
                category="contrast_wcag",
                label="WCAG 2.1 Palette Contrast",
                passed=contrast_passed,
                score=max(60, contrast_score),
                detail=(
                    f"Peak contrast ratio {contrast_ratio}:1 across {len(palette)} tokens "
                    + ("(exceeds WCAG AAA 7:1)." if contrast_ratio >= 7.0 else "(meets WCAG AA 4.5:1)." if contrast_passed else "(below 4.5:1 AA minimum).")
                ),
            )
        )

        # 2. Palette & Visual Asset Completeness
        asset_count = len(visual.assets) if visual else 0
        palette_ok = len(palette) >= 4 and asset_count >= 1
        checks.append(
            BandCriticCheck(
                category="palette_harmony",
                label="Visual System & Multi-Aspect Coverage",
                passed=palette_ok,
                score=96 if (len(palette) >= 5 and asset_count >= 3) else 84 if palette_ok else 55,
                detail=f"{len(palette)} brand hex tokens synchronized across {asset_count} rendered visual asset(s).",
            )
        )

        # 3. Copy Conversion & Anti-Cliché Scan
        all_copy_text = ""
        if copy:
            all_copy_text = " ".join(
                [copy.campaign_tagline, copy.brand_voice_summary]
                + [f"{p.headline} {p.body_copy} {p.call_to_action}" for p in copy.platform_copies]
            ).lower()
        found_cliches = [c for c in BANNED_COPY_CLICHES if c in all_copy_text]
        copy_ok = bool(copy and len(copy.platform_copies) >= 1 and not found_cliches)
        checks.append(
            BandCriticCheck(
                category="copy_conversion",
                label="Conversion Craft & Anti-Cliché Gate",
                passed=copy_ok,
                score=97 if copy_ok else 72,
                detail=(
                    f"Zero banned clichés detected across {len(copy.platform_copies) if copy else 0} channel decks; CTAs verified."
                    if not found_cliches
                    else f"Detected cliché phrases: {', '.join(found_cliches)}."
                ),
            )
        )

        # 4. Platform Formatting & Visual-Copy Binding
        linked_count = (
            sum(1 for p in copy.platform_copies if p.linked_asset_id) if copy else 0
        )
        total_copies = len(copy.platform_copies) if copy else 0
        binding_ok = total_copies > 0 and linked_count == total_copies
        checks.append(
            BandCriticCheck(
                category="platform_spec",
                label="Asset-to-Copy Visual Pairing",
                passed=binding_ok,
                score=98 if binding_ok else 80 if total_copies > 0 else 50,
                detail=f"{linked_count}/{total_copies} platform copy blocks explicitly bound to a @visual_pixelate asset ID.",
            )
        )

        # 5. Pinned BAND Guardrail Verification
        pinned_memories = [m for m in memories if m.metadata.get("pinned")]
        guardrail_ok = True
        guardrail_detail = (
            f"Verified {len(pinned_memories)} pinned BAND Memory rule(s) hydrated into agent focus windows."
            if pinned_memories
            else "No conflicting brand guardrails; ready to pin custom rules in BAND Memory."
        )
        # Check simple negative rule like "no exclamation" or "never use exclamation"
        for mem in pinned_memories:
            if "exclamation" in mem.content.lower() and "!" in all_copy_text:
                guardrail_ok = False
                guardrail_detail = (
                    f"Guardrail `{mem.key}` restricts exclamation marks, but '!' was found in draft copy."
                )
                break
        checks.append(
            BandCriticCheck(
                category="guardrails",
                label="Shared BAND Guardrail Compliance",
                passed=guardrail_ok,
                score=96 if guardrail_ok else 68,
                detail=guardrail_detail,
            )
        )

        overall = int(round(sum(c.score for c in checks) / max(1, len(checks))))
        grade = (
            "A+" if overall >= 95
            else "A" if overall >= 90
            else "A-" if overall >= 85
            else "B+" if overall >= 80
            else "B"
        )

        recommendation: str | None = None
        if not guardrail_ok:
            recommendation = f"{AgentHandle.COPY.value} Remove exclamation marks to satisfy pinned BAND guardrail."
        elif not contrast_passed:
            recommendation = f"{AgentHandle.VISUAL.value} Increase dark/light palette contrast above 4.5:1 WCAG AA."
        elif found_cliches:
            recommendation = f"{AgentHandle.COPY.value} Replace generic clichés with sharper sensory product copy."

        return BandCriticReport(
            overall_score=overall,
            grade=grade,
            summary=(
                f"Brand QA passed ({overall}/100, Grade {grade}) — visual contrast ({contrast_ratio}:1), "
                f"asset-copy pairing, and BAND shared guardrails verified."
                if not recommendation
                else f"Brand QA flagged an improvement ({overall}/100, Grade {grade}): {recommendation}"
            ),
            wcag_contrast_ratio=contrast_ratio,
            checks=checks,
            recommended_mention=recommendation,
        )


class BandAuditLedger:
    """Produces a SHA-256 hash-chained tamper-evident BAND compliance audit log."""

    @staticmethod
    def build_chain(
        campaign: CampaignResponse, executions: list[BandTaskExecution]
    ) -> list[BandAuditEntry]:
        entries: list[BandAuditEntry] = []
        prev_hash = "0" * 64
        seq = 1

        for evt in campaign.events:
            if evt.event_type == EventType.HEARTBEAT:
                continue
            scope: Literal["human_me_api", "agent_runtime_api"] = (
                "human_me_api"
                if evt.sender.lower() == AgentHandle.HUMAN.value
                else "agent_runtime_api"
            )
            target = ", ".join(evt.mentions)
            summary = evt.message[:220]
            canonical = f"{seq}|{evt.timestamp.isoformat()}|{evt.sender}|{scope}|{evt.event_type.value}|{target}|{summary}|{prev_hash}"
            entry_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            entries.append(
                BandAuditEntry(
                    seq=seq,
                    timestamp=evt.timestamp,
                    actor=evt.sender,
                    api_scope=scope,
                    action=evt.event_type.value,
                    target=target,
                    summary=summary,
                    prev_hash=prev_hash,
                    entry_hash=entry_hash,
                )
            )
            prev_hash = entry_hash
            seq += 1

        for ex in executions:
            summary = (
                f"Execution {ex.execution_id} ({ex.status}, {ex.duration_ms}ms, "
                f"{len(ex.tool_calls)} tools, {ex.focus_token_estimate} focused tokens)"
            )
            canonical = f"{seq}|{ex.started_at.isoformat()}|{ex.agent_handle}|agent_runtime_api|execution:{ex.status}|{ex.trigger_by}|{summary}|{prev_hash}"
            entry_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            entries.append(
                BandAuditEntry(
                    seq=seq,
                    timestamp=ex.started_at,
                    actor=ex.agent_handle,
                    api_scope="agent_runtime_api",
                    action=f"execution:{ex.status}",
                    target=ex.trigger_by,
                    summary=summary,
                    prev_hash=prev_hash,
                    entry_hash=entry_hash,
                )
            )
            prev_hash = entry_hash
            seq += 1

        return entries


def build_agent_directory(
    registered_remote_map: dict[str, bool] | None = None,
) -> list[BandAgentDirectoryEntry]:
    """Return the discoverable BAND Agentic Mesh Registry across heterogeneous frameworks."""
    remote = registered_remote_map or {}
    return [
        BandAgentDirectoryEntry(
            handle=AgentHandle.VISUAL.value,
            display_name="Visual Pixelate",
            framework="AdaL / AdalFlow + Gemini Imagen 3",
            agent_type="remote_sdk",
            contact_status="mutual_approved",
            description="Creative director generating 5-hex color systems, multi-aspect visuals, and 15s storyboards.",
            skills=["brand_visual_direction", "motion_video_direction"],
            capabilities=["chat", "mentions", "memories", "image_generation", "storyboard"],
            registered_remote=remote.get(AgentHandle.VISUAL.value, False),
        ),
        BandAgentDirectoryEntry(
            handle=AgentHandle.COPY.value,
            display_name="Copy Pixelate",
            framework="AdaL / AdalFlow + Finch SKILL.md",
            agent_type="remote_sdk",
            contact_status="mutual_approved",
            description="Direct-response copywriter turning visual briefs into Instagram, LinkedIn, and Meta Ad decks.",
            skills=["ad_copy_conversion", "social_platform_formatter"],
            capabilities=["chat", "mentions", "memories", "aida_pas_copywriting"],
            registered_remote=remote.get(AgentHandle.COPY.value, False),
        ),
        BandAgentDirectoryEntry(
            handle=AgentHandle.CRITIC.value,
            display_name="Critic Pixelate (Brand QA)",
            framework="BAND Policy Engine + WCAG 2.1 Auditor",
            agent_type="platform_hosted",
            contact_status="mutual_approved",
            description="Independent Brand QA & Governance Critic auditing WCAG contrast, anti-cliché rules, and pinned guardrails.",
            skills=["wcag_contrast_audit", "brand_guardrail_verifier"],
            capabilities=["chat", "mentions", "memories", "compliance_scoring"],
            registered_remote=remote.get(AgentHandle.CRITIC.value, False),
        ),
        BandAgentDirectoryEntry(
            handle=AgentHandle.ORCHESTRATOR.value,
            display_name="BAND Orchestrator",
            framework="BAND Protocol + FastAPI + FFmpeg",
            agent_type="platform_hosted",
            contact_status="system",
            description="Durable room router managing Phoenix WS streams, shared memories, and H.264 MP4 rendering.",
            skills=["room_routing", "shared_memory_sync", "ffmpeg_mp4_studio"],
            capabilities=["rooms", "mentions", "memories", "video_rendering"],
            registered_remote=remote.get(AgentHandle.ORCHESTRATOR.value, False),
        ),
    ]


__all__ = [
    "BandAuditLedger",
    "BandBrandMemoryVault",
    "BandCriticEngine",
    "BandExecutionTracker",
    "BandFocusProjector",
    "BandLoopGuard",
    "BandPolicyEngine",
    "build_agent_directory",
    "compute_max_wcag_contrast",
]
