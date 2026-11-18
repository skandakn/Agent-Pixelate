"""AdaL (`adalagent.ai`) / AdalFlow SDK Modular Agent Harness.

Provides the shared agent execution substrate for Agent Pixelate's `@visual_pixelate`
and `@copy_pixelate` agents using native AdalFlow primitives:
  - `adalflow.Component` modular architecture
  - `adalflow.Generator` + `adalflow.DataClassParser` for strict structured outputs
  - `adalflow.core.func_tool.FunctionTool` & `ToolManager` for tool calling
  - `adalflow.Agent` & `adalflow.Runner` bindings
  - `adalflow.components.memory.memory.ConversationMemory` + persistent JSON
    session memory (`AdalSessionMemory`) for cross-turn and cross-agent traceability
  - Multi-provider `ModelClient` resolution (`OpenAIClient` + modern `google-genai`
    `GeminiGenAIModelClient`) with automatic graceful fallback if no API key is set
    or upstream quota is exceeded.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, TypeVar

import adalflow as adal
from adalflow.components.memory.memory import ConversationMemory
from adalflow.components.output_parsers import DataClassParser
from adalflow.core import Component, DataClass, Generator, ModelClient, ModelType
from adalflow.core.func_tool import FunctionTool
from adalflow.core.tool_manager import ToolManager
from adalflow.core.types import GeneratorOutput
from pydantic import BaseModel

logger = logging.getLogger(__name__)

TModel = TypeVar("TModel", bound=BaseModel)

JSON_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def extract_json_payload(raw_text: str) -> dict[str, Any]:
    """Extract and parse a JSON object from raw LLM output (handles fenced blocks)."""
    text = raw_text.strip()
    if not text:
        raise ValueError("Empty LLM response; expected JSON object.")

    # Direct parse first
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Fenced code block parse
    for match in JSON_FENCE_RE.finditer(text):
        candidate = match.group(1).strip()
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue

    # Balanced outermost braces scan
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        parsed = json.loads(text[start : end + 1])
        if isinstance(parsed, dict):
            return parsed

    raise ValueError(f"Could not extract a valid JSON object from response: {text[:240]!r}")


class GeminiGenAIModelClient(ModelClient):
    """AdalFlow `ModelClient` powered by the official `google-genai` SDK."""

    def __init__(self, api_key: str | None = None) -> None:
        super().__init__()
        self._api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self._sync_client: Any = None

    def init_sync_client(self) -> Any:
        if self._sync_client is None:
            from google import genai  # type: ignore[import-not-found]

            self._sync_client = genai.Client(api_key=self._api_key)
        return self._sync_client

    def convert_inputs_to_api_kwargs(
        self,
        input: Any = None,
        model_kwargs: dict[str, Any] | None = None,
        model_type: ModelType = ModelType.UNDEFINED,
    ) -> dict[str, Any]:
        kwargs = dict(model_kwargs or {})
        kwargs["contents"] = str(input or "")
        kwargs.setdefault("model", os.getenv("GEMINI_TEXT_MODEL", "gemini-2.5-flash"))
        return kwargs

    def call(
        self,
        api_kwargs: dict[str, Any] | None = None,
        model_type: ModelType = ModelType.UNDEFINED,
    ) -> Any:
        from google.genai import types  # type: ignore[import-not-found]

        params = dict(api_kwargs or {})
        model = params.pop("model", os.getenv("GEMINI_TEXT_MODEL", "gemini-2.5-flash"))
        contents = params.pop("contents", "")
        temperature = params.pop("temperature", 0.5)
        response_mime = params.pop("response_mime_type", "application/json")

        client = self.init_sync_client()
        config = types.GenerateContentConfig(
            temperature=temperature,
            response_mime_type=response_mime,
        )
        return client.models.generate_content(
            model=model,
            contents=contents,
            config=config,
        )

    async def acall(
        self,
        api_kwargs: dict[str, Any] | None = None,
        model_type: ModelType = ModelType.UNDEFINED,
    ) -> Any:
        return await asyncio.to_thread(self.call, api_kwargs, model_type)

    def parse_chat_completion(self, completion: Any) -> GeneratorOutput:
        try:
            text = getattr(completion, "text", None)
            if not text and hasattr(completion, "candidates") and completion.candidates:
                parts = completion.candidates[0].content.parts
                text = "".join(getattr(p, "text", "") for p in parts)
            return GeneratorOutput(data=text or "", raw_response=str(text or ""))
        except Exception as exc:
            return GeneratorOutput(data=None, error=str(exc), raw_response=str(completion))


@dataclass
class AdalSessionRecord:
    """Single auditable turn/tool/skill event stored in `AdalSessionMemory`."""

    timestamp: str
    agent_handle: str
    kind: str  # "skill_loaded" | "tool_call" | "llm_prompt" | "llm_output" | "handoff"
    summary: str
    payload: dict[str, Any] = field(default_factory=dict)


class AdalSessionMemory:
    """Session memory wrapping AdalFlow `ConversationMemory` + persistent JSON journal.

    Maintains both in-memory AdalFlow dialog turns (passed directly to `adal.Runner`)
    and durable JSON session logs under `<session_dir>/<campaign_id>_session.json`
    so Visual Agent context and tool traces survive handoffs to the Copy Agent.
    """

    def __init__(
        self,
        campaign_id: str,
        agent_handle: str,
        session_dir: Path | None = None,
    ) -> None:
        self.campaign_id = campaign_id
        self.agent_handle = agent_handle
        self.conversation_memory = ConversationMemory(user_id=f"{campaign_id}:{agent_handle}")
        self.records: list[AdalSessionRecord] = []
        self.loaded_skills: list[str] = []
        self.shared_context: dict[str, Any] = {}
        self.session_dir = session_dir

        if self.session_dir is not None:
            self.session_dir.mkdir(parents=True, exist_ok=True)
            self._load_existing()

    @property
    def session_file(self) -> Path | None:
        if self.session_dir is None:
            return None
        safe_id = re.sub(r"[^a-zA-Z0-9_-]", "_", self.campaign_id)
        return self.session_dir / f"{safe_id}_adal_session.json"

    def _load_existing(self) -> None:
        path = self.session_file
        if path is None or not path.exists():
            return
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            self.shared_context.update(raw.get("shared_context", {}))
            for skill in raw.get("loaded_skills", []):
                if skill not in self.loaded_skills:
                    self.loaded_skills.append(skill)
            for rec in raw.get("records", []):
                self.records.append(AdalSessionRecord(**rec))
        except Exception as exc:
            logger.debug("Ignoring unreadable AdaL session file %s: %s", path, exc)

    def _flush(self) -> None:
        path = self.session_file
        if path is None:
            return
        data = {
            "campaign_id": self.campaign_id,
            "updated_at": _utc_iso(),
            "loaded_skills": self.loaded_skills,
            "shared_context": self.shared_context,
            "records": [
                {
                    "timestamp": r.timestamp,
                    "agent_handle": r.agent_handle,
                    "kind": r.kind,
                    "summary": r.summary,
                    "payload": r.payload,
                }
                for r in self.records
            ],
        }
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
        os.replace(tmp, path)

    def record_skill_load(self, skill_id: str, version: str, provider: str) -> None:
        if skill_id not in self.loaded_skills:
            self.loaded_skills.append(skill_id)
        self.records.append(
            AdalSessionRecord(
                timestamp=_utc_iso(),
                agent_handle=self.agent_handle,
                kind="skill_loaded",
                summary=f"Loaded Finch skill `{skill_id}` v{version} ({provider})",
                payload={"skill_id": skill_id, "version": version, "provider": provider},
            )
        )
        self._flush()

    def record_tool_call(
        self, tool_name: str, args: dict[str, Any], result_preview: str
    ) -> None:
        self.records.append(
            AdalSessionRecord(
                timestamp=_utc_iso(),
                agent_handle=self.agent_handle,
                kind="tool_call",
                summary=f"Executed AdalFlow tool `{tool_name}`",
                payload={"tool": tool_name, "args": args, "result_preview": result_preview[:300]},
            )
        )
        self._flush()

    def record_turn(self, user_query: str, assistant_response: str) -> None:
        self.conversation_memory.add_dialog_turn(
            user_query=user_query[:2000],
            assistant_response=assistant_response[:2000],
        )
        self.records.append(
            AdalSessionRecord(
                timestamp=_utc_iso(),
                agent_handle=self.agent_handle,
                kind="llm_turn",
                summary=f"Completed AdaL turn ({len(assistant_response)} chars)",
                payload={"query_chars": len(user_query), "response_chars": len(assistant_response)},
            )
        )
        self._flush()

    def put_context(self, key: str, value: Any) -> None:
        self.shared_context[key] = value
        self._flush()

    def get_context(self, key: str, default: Any = None) -> Any:
        return self.shared_context.get(key, default)

    def render_recent_memory(self, max_items: int = 6) -> str:
        if not self.records:
            return "No prior session turns."
        recent = self.records[-max_items:]
        lines = [
            f"- [{r.agent_handle}] ({r.kind}): {r.summary}"
            for r in recent
        ]
        return "\n".join(lines)


def resolve_adal_model_client(
    preferred_provider: str | None = None,
) -> tuple[ModelClient | None, dict[str, Any], str]:
    """Resolve the active AdalFlow `ModelClient` and default `model_kwargs`.

    Respects `ADAL_LLM_PROVIDER` (`auto` | `gemini` | `openai` | `offline`).
    Returns `(model_client, model_kwargs, provider_label)`.
    """
    provider = (
        preferred_provider
        or os.getenv("ADAL_LLM_PROVIDER")
        or os.getenv("LLM_PROVIDER")
        or "auto"
    ).strip().lower()

    if provider in {"offline", "mock", "fallback", "none"}:
        return None, {}, "offline_fallback"

    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    openai_base_url = os.getenv("OPENAI_BASE_URL")

    # Decide order
    candidates: list[str]
    if provider == "gemini":
        candidates = ["gemini", "openai"]
    elif provider == "openai":
        candidates = ["openai", "gemini"]
    else:
        # In auto mode, prefer Gemini if GEMINI_API_KEY is explicitly provided,
        # otherwise OpenAI if OPENAI_API_KEY is set.
        candidates = ["gemini", "openai"] if gemini_key else ["openai", "gemini"]

    for candidate in candidates:
        if candidate == "gemini" and gemini_key:
            model_name = os.getenv("GEMINI_TEXT_MODEL", "gemini-2.5-flash")
            return (
                GeminiGenAIModelClient(api_key=gemini_key),
                {"model": model_name, "temperature": 0.45, "response_mime_type": "application/json"},
                f"gemini:{model_name}",
            )
        if candidate == "openai" and openai_key:
            model_name = os.getenv("OPENAI_TEXT_MODEL", "gpt-4o-mini")
            kwargs: dict[str, Any] = {"api_key": openai_key}
            if openai_base_url:
                kwargs["base_url"] = openai_base_url
            try:
                client = adal.OpenAIClient(**kwargs)
                return (
                    client,
                    {
                        "model": model_name,
                        "temperature": 0.45,
                        "response_format": {"type": "json_object"},
                    },
                    f"openai:{model_name}",
                )
            except Exception as exc:
                logger.warning("Could not initialize AdalFlow OpenAIClient: %s", exc)

    return None, {}, "offline_fallback"


STRUCTURED_AGENT_TEMPLATE = r"""<START_OF_SYSTEM_PROMPT>
{{system_prompt}}

You are executing inside the AdaL (adalagent.ai) / AdalFlow structured agent harness.
Follow EVERY loaded Finch SKILL.md rule below strictly:
{{skill_instructions}}

SESSION MEMORY SUMMARY:
{{session_memory}}

OUTPUT CONTRACT (STRICT JSON ONLY — NO MARKDOWN FENCES OR COMMENTARY):
{{output_format_str}}
<END_OF_SYSTEM_PROMPT>
<START_OF_USER>
{{user_prompt}}
<END_OF_USER>
"""


class AdalAgentHarness(Component):
    """Modular AdaL / AdalFlow Agent Component with tools, memory, and strict schemas.

    Inherits directly from `adalflow.core.Component` so every Agent Pixelate
    worker is a first-class AdalFlow component supporting:
      - `ToolManager` + `FunctionTool` modular tool execution
      - `adal.Generator` + `DataClassParser` structured JSON generation
      - `adal.Agent` + `adal.Runner` ReAct loop factory (for interactive/agentic runs)
      - `AdalSessionMemory` backed by `ConversationMemory` + persistent JSON store
      - Strict Pydantic v2 validation + automatic fallback when offline/rate-limited
    """

    def __init__(
        self,
        *,
        name: str,
        agent_handle: str,
        role_desc: str,
        tools: list[Callable[..., Any]] | None = None,
        data_class: type[DataClass] | None = None,
        preferred_provider: str | None = None,
        timeout_s: float = 25.0,
    ) -> None:
        super().__init__()
        self.name = name
        self.agent_handle = agent_handle
        self.role_desc = role_desc
        self.timeout_s = timeout_s

        # Wrap Python callables into AdalFlow FunctionTools and register with ToolManager
        self.function_tools: list[FunctionTool] = [
            fn if isinstance(fn, FunctionTool) else FunctionTool(fn=fn)
            for fn in (tools or [])
        ]
        self.tool_manager = ToolManager(tools=self.function_tools)

        # AdalFlow DataClassParser produces deterministic JSON schema instructions
        self.data_class = data_class
        self.output_parser = (
            DataClassParser(data_class=data_class, return_data_class=False, format_type="json")
            if data_class is not None
            else None
        )

        # Resolve ModelClient (OpenAIClient or GeminiGenAIModelClient)
        self.model_client, self.model_kwargs, self.provider_label = resolve_adal_model_client(
            preferred_provider
        )

        # Build AdalFlow Generator component when a live ModelClient is available
        self.generator: Generator | None = None
        if self.model_client is not None:
            self.generator = Generator(
                model_client=self.model_client,
                model_kwargs=self.model_kwargs,
                template=STRUCTURED_AGENT_TEMPLATE,
                name=f"{name}_generator",
                use_cache=False,
            )

    def build_adal_runner(
        self,
        *,
        session_memory: AdalSessionMemory,
        answer_data_type: type[Any] = str,
        max_steps: int = 4,
    ) -> adal.Runner | None:
        """Construct a native `adalflow.Agent` + `adalflow.Runner` bound to session memory."""
        if self.model_client is None:
            return None
        agent = adal.Agent(
            name=self.name,
            tools=self.function_tools,
            model_client=self.model_client,
            model_kwargs=self.model_kwargs,
            role_desc=self.role_desc,
            answer_data_type=answer_data_type,
            max_steps=max_steps,
            tool_manager=self.tool_manager,
            use_cache=False,
        )
        return adal.Runner(
            agent=agent,
            max_steps=max_steps,
            conversation_memory=session_memory.conversation_memory,
        )

    async def execute_tool(
        self,
        tool_name: str,
        session_memory: AdalSessionMemory | None = None,
        **kwargs: Any,
    ) -> Any:
        """Invoke a registered AdalFlow `FunctionTool` by name and log it in session memory."""
        target: FunctionTool | None = None
        for tool in self.function_tools:
            if tool.definition.func_name == tool_name:
                target = tool
                break
        if target is None:
            available = [t.definition.func_name for t in self.function_tools]
            raise KeyError(f"AdalFlow tool {tool_name!r} not registered. Available: {available}")

        if asyncio.iscoroutinefunction(target.fn):
            result = await target.fn(**kwargs)
        else:
            result = await asyncio.to_thread(target.fn, **kwargs)

        if session_memory is not None:
            session_memory.record_tool_call(
                tool_name=tool_name,
                args={k: str(v)[:120] for k, v in kwargs.items()},
                result_preview=str(result),
            )
        return result

    async def generate_structured(
        self,
        *,
        schema_cls: type[TModel],
        user_prompt: str,
        skill_instructions: str,
        session_memory: AdalSessionMemory,
        fallback_builder: Callable[[], TModel],
        extra_schema_notes: str = "",
    ) -> tuple[TModel, str]:
        """Run AdalFlow `Generator` with strict Pydantic v2 validation + resilient fallback.

        Returns `(validated_model, execution_mode)` where `execution_mode` is either
        the live AdalFlow provider label (e.g. `openai:gpt-4o-mini` / `gemini:gemini-2.5-flash`)
        or `adal_structured_fallback` when running offline or after an upstream error/quota hit.
        """
        if self.generator is None or self.model_client is None:
            fallback = fallback_builder()
            session_memory.record_turn(
                user_query=user_prompt,
                assistant_response=fallback.model_dump_json(),
            )
            return fallback, "adal_structured_fallback"

        format_instructions = (
            self.output_parser.get_output_format_str()
            if self.output_parser is not None
            else json.dumps(schema_cls.model_json_schema(), indent=2)
        )
        if extra_schema_notes:
            format_instructions = f"{format_instructions}\n\n{extra_schema_notes}"

        prompt_kwargs = {
            "system_prompt": self.role_desc,
            "skill_instructions": skill_instructions,
            "session_memory": session_memory.render_recent_memory(),
            "output_format_str": format_instructions,
            "user_prompt": user_prompt,
        }

        try:
            gen_output: GeneratorOutput = await asyncio.wait_for(
                self.generator.acall(prompt_kwargs=prompt_kwargs),
                timeout=self.timeout_s,
            )
            if gen_output.error:
                raise RuntimeError(f"AdalFlow Generator error: {gen_output.error}")

            raw_text = str(gen_output.data or gen_output.raw_response or "")
            parsed_dict = extract_json_payload(raw_text)
            validated = schema_cls.model_validate(parsed_dict)

            session_memory.record_turn(
                user_query=user_prompt,
                assistant_response=validated.model_dump_json(),
            )
            return validated, f"adalflow:{self.provider_label}"
        except Exception as exc:
            logger.warning(
                "AdaL/AdalFlow live LLM call (%s) unavailable or invalid (%s); "
                "using deterministic structured synthesis fallback.",
                self.provider_label,
                exc,
            )
            fallback = fallback_builder()
            session_memory.record_turn(
                user_query=user_prompt,
                assistant_response=fallback.model_dump_json(),
            )
            return fallback, f"adal_structured_fallback({type(exc).__name__})"


__all__ = [
    "AdalAgentHarness",
    "AdalSessionMemory",
    "AdalSessionRecord",
    "GeminiGenAIModelClient",
    "extract_json_payload",
    "resolve_adal_model_client",
]
