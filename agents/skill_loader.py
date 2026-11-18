"""Finch (`finchtech.ai`) Reusable Agent Skill Loader & Progressive-Disclosure Registry.

Dynamically discovers, parses, validates, and injects standardized `*.SKILL.md`
capability definitions stored in `/agents/skills/`. Supports both direct loading
into AdaL/AdalFlow agent prompts and exposure as an AdalFlow `FunctionTool` so
agents can inspect skill indexes and pull domain rules on demand.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

DEFAULT_SKILLS_DIR = Path(__file__).resolve().parent / "skills"
FRONTMATTER_RE = re.compile(r"\A---\s*\r?\n(.*?)\r?\n---\s*\r?\n?(.*)\Z", re.DOTALL)


@dataclass(slots=True)
class FinchSkill:
    """Parsed Finch standardized `SKILL.md` capability definition."""

    skill_id: str
    filename: str
    path: Path
    name: str
    version: str
    display_name: str
    description: str
    category: str
    provider: str
    compatibility: list[str] = field(default_factory=list)
    triggers: list[str] = field(default_factory=list)
    inputs: list[str] = field(default_factory=list)
    outputs: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    body_markdown: str = ""
    raw_frontmatter: dict[str, Any] = field(default_factory=dict)

    def summary_card(self) -> dict[str, Any]:
        """Lightweight progressive-disclosure index entry (frontmatter only)."""
        return {
            "skill_id": self.skill_id,
            "name": self.name,
            "version": self.version,
            "displayName": self.display_name,
            "description": self.description,
            "category": self.category,
            "provider": self.provider,
            "triggers": self.triggers,
            "compatibility": self.compatibility,
        }

    def render_prompt_block(self) -> str:
        """Render the full Finch skill instructions for injection into an AdaL agent."""
        header = (
            f"=== FINCH SKILL LOADED: {self.display_name} "
            f"({self.name} v{self.version} | provider={self.provider}) ===\n"
            f"Triggers: {', '.join(self.triggers)}\n"
            f"Expected Outputs: {', '.join(self.outputs)}\n"
        )
        return f"{header}\n{self.body_markdown.strip()}\n=== END FINCH SKILL: {self.name} ==="


class FinchSkillLoader:
    """Discovers and loads standardized `*.SKILL.md` files from `/agents/skills/`."""

    def __init__(self, skills_dir: Path | str | None = None) -> None:
        self.skills_dir = Path(skills_dir) if skills_dir else DEFAULT_SKILLS_DIR
        self._cache: dict[str, FinchSkill] = {}
        self.refresh()

    def refresh(self) -> list[str]:
        """Scan `skills_dir` and index all `*.SKILL.md` files."""
        self._cache.clear()
        if not self.skills_dir.exists():
            logger.warning("Finch skills directory does not exist: %s", self.skills_dir)
            return []

        for path in sorted(self.skills_dir.glob("*.SKILL.md")):
            try:
                skill = self._parse_skill_file(path)
                self._cache[skill.skill_id] = skill
                self._cache[skill.name] = skill
                self._cache[path.name] = skill
            except Exception as exc:
                logger.error("Failed to parse Finch skill %s: %s", path, exc)
                raise

        return self.list_skill_ids()

    @staticmethod
    def _parse_skill_file(path: Path) -> FinchSkill:
        raw_text = path.read_text(encoding="utf-8")
        match = FRONTMATTER_RE.match(raw_text)
        if not match:
            raise ValueError(
                f"Finch skill {path.name} is missing valid YAML frontmatter delimited by `---`."
            )

        frontmatter_text, body = match.group(1), match.group(2)
        frontmatter = yaml.safe_load(frontmatter_text) or {}
        if not isinstance(frontmatter, dict):
            raise ValueError(f"Finch skill {path.name} YAML frontmatter must be a mapping.")

        name = str(frontmatter.get("name") or "").strip()
        description = str(frontmatter.get("description") or "").strip()
        if not name or not description:
            raise ValueError(
                f"Finch skill {path.name} must define required `name` and `description` fields."
            )

        skill_id = path.name.removesuffix(".SKILL.md")
        return FinchSkill(
            skill_id=skill_id,
            filename=path.name,
            path=path,
            name=name,
            version=str(frontmatter.get("version") or "1.0.0"),
            display_name=str(frontmatter.get("displayName") or name),
            description=description,
            category=str(frontmatter.get("category") or "general"),
            provider=str(frontmatter.get("provider") or "finchtech.ai"),
            compatibility=list(frontmatter.get("compatibility") or []),
            triggers=list(frontmatter.get("triggers") or []),
            inputs=list(frontmatter.get("inputs") or []),
            outputs=list(frontmatter.get("outputs") or []),
            metadata=dict(frontmatter.get("metadata") or {}),
            body_markdown=body.strip(),
            raw_frontmatter=frontmatter,
        )

    def list_skill_ids(self) -> list[str]:
        """Return unique canonical skill IDs (file stems without `.SKILL.md`)."""
        seen: list[str] = []
        for skill in self._cache.values():
            if skill.skill_id not in seen:
                seen.append(skill.skill_id)
        return seen

    def list_catalog(self) -> list[dict[str, Any]]:
        """Progressive-disclosure metadata catalog for all installed Finch skills."""
        catalog: list[dict[str, Any]] = []
        seen: set[str] = set()
        for skill in self._cache.values():
            if skill.skill_id in seen:
                continue
            seen.add(skill.skill_id)
            catalog.append(skill.summary_card())
        return catalog

    def load(self, identifier: str) -> FinchSkill:
        """Load a skill by filename (`brand_visual_direction.SKILL.md`), stem, or YAML `name`."""
        cleaned = identifier.strip()
        candidates = [
            cleaned,
            cleaned.removesuffix(".SKILL.md"),
            cleaned.replace("-", "_"),
            cleaned.replace("_", "-"),
        ]
        for key in candidates:
            if key in self._cache:
                return self._cache[key]
        available = ", ".join(self.list_skill_ids())
        raise KeyError(
            f"Finch skill {identifier!r} not found in {self.skills_dir}. Available: {available}"
        )

    def load_many(self, identifiers: list[str]) -> list[FinchSkill]:
        """Load multiple Finch skills in order."""
        return [self.load(ident) for ident in identifiers]

    def build_combined_instructions(self, identifiers: list[str]) -> str:
        """Load and concatenate multiple Finch skills into a single agent directive block."""
        skills = self.load_many(identifiers)
        return "\n\n".join(skill.render_prompt_block() for skill in skills)

    def as_adal_tool_fn(self):
        """Return a docstring-annotated tool function compatible with AdalFlow `FunctionTool`."""

        def load_finch_skill(skill_name: str) -> str:
            """Load a standardized Finch (finchtech.ai) SKILL.md capability definition.

            Args:
                skill_name: Skill identifier such as 'brand_visual_direction',
                    'ad_copy_conversion', or 'social_platform_formatter'.

            Returns:
                Full structured markdown rules and constraints from the requested SKILL.md.
            """
            skill = self.load(skill_name)
            return skill.render_prompt_block()

        return load_finch_skill


__all__ = ["DEFAULT_SKILLS_DIR", "FinchSkill", "FinchSkillLoader"]
