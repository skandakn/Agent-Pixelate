# Agent Pixelate — AI Agents & Reusable Finch Skills (`/agents`)

Multi-agent creative & conversion copywriting subsystem for **Agent Pixelate**, built on:

- **AdaL (`adalagent.ai`) / AdalFlow SDK** — modular `Component` + `Generator` + `DataClassParser` + `FunctionTool` / `ToolManager` + `ConversationMemory` + persistent `AdalSessionMemory`.
- **Finch (`finchtech.ai`) Reusable Agent Skills** — standardized `*.SKILL.md` capability files dynamically loaded at runtime via progressive disclosure.
- **BAND (`band.ai`) Multi-Agent Handoff** — `@visual_pixelate` -> Band Memory -> `@copy_pixelate` room mention listener & async worker runner.

## Directory Layout

```text
agents/
├── skills/
│   ├── brand_visual_direction.SKILL.md     # 5-hex palette, lighting physics, 3-aspect prompts, 3-scene video storyboard
│   ├── ad_copy_conversion.SKILL.md         # AIDA/PAS frameworks, visual-to-copy alignment, anti-cliché gate
│   └── social_platform_formatter.SKILL.md  # Instagram, LinkedIn, Paid Ad, X & Web Banner formatting rules
├── adal_harness.py                         # AdaL / AdalFlow Component, ToolManager, ConversationMemory & ModelClient router
├── skill_loader.py                         # Finch SKILL.md parser, registry & AdalFlow FunctionTool adapter
├── image_providers.py                      # Gemini Imagen / OpenAI gpt-image-1 / Fal.ai + studio PNG fallback
├── contracts.py                            # Imports /shared/schemas.py (with exact local fallback mirror)
├── visual_agent.py                         # @visual_pixelate implementation
├── copy_agent.py                           # @copy_pixelate implementation
├── worker.py                               # run_visual_agent, run_copy_agent, BandRoomListener & FastAPI worker app
└── test_pipeline.py                        # End-to-end CLI test runner (`python -m agents.test_pipeline`)
```

## Quick Start

```bash
# Install dependencies
pip install -r agents/requirements.txt

# Run the full Visual -> BAND Handoff -> Copy pipeline end-to-end
python -m agents.test_pipeline

# Force deterministic offline mode (no external API quota required)
python -m agents.test_pipeline --offline
```

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `ADAL_LLM_PROVIDER` | Text model backend (`auto` \| `gemini` \| `openai` \| `offline`) | `auto` |
| `IMAGE_PROVIDER` | Image backend (`auto` \| `gemini` \| `openai` \| `fal` \| `placeholder`) | `auto` |
| `GEMINI_API_KEY` | Google Gemini text + Imagen 3 key | — |
| `OPENAI_API_KEY` | OpenAI text + `gpt-image-1` key | — |
| `FAL_KEY` | Fal.ai Flux key | — |
| `BAND_API_KEY` | Live Band (`band.ai`) room & memory key (optional; local fallback if unset) | — |
| `CAMPAIGN_DATA_DIR` | Persistent asset directory (`/data/campaigns` in Docker/Agent37) | `./data/campaigns` |

## Orchestrator Integration

```python
from agents.worker import run_visual_agent, run_copy_agent, BandRoomListener

visual_out = await run_visual_agent(req, emit_event=on_event)
copy_out = await run_copy_agent(req, visual_out, emit_event=on_event)
```
