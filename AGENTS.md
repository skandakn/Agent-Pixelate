# Agent Pixelate — Engineering Craft & Hackathon Standards

These rules enforce top-tier engineering craft, rigorous automated testing, enterprise security, and architecture quality across all future development, commits, and AI agent contributions to **Agent Pixelate**.

---

## 1. Automated Testing & Verification (Zero-Regression Mandate)

All code modifications must maintain 100% test pass rates across both frontend and backend suites before any commit is created or pushed:

### Frontend Unit & Component Testing
- **Framework:** Vitest (`frontend/vitest.config.mjs`)
- **Location:** `frontend/src/__tests__/*.test.ts`
- **Rule:** Every new component, custom hook, store mutation, or utility module **must** have an accompanying unit/integration test.
- **Verification Command:**
  ```bash
  cd frontend && npm test
  ```
- **Build Verification:** Ensure production static build passes with zero TypeScript or Next.js build errors:
  ```bash
  cd frontend && npm run build
  ```

### Backend Unit & Integration Testing
- **Framework:** Pytest with `pytest-asyncio`
- **Location:** `orchestrator/tests/*.py` and `agents/tests/*.py`
- **Rule:** Every new FastAPI endpoint, WebSocket handler, BAND protocol adapter, or agent workflow logic **must** have automated test coverage.
- **Verification Command:**
  ```bash
  python -m pytest orchestrator/tests -v
  ```

### CI/CD Preservation
- Never disable, skip, or weaken jobs in `.github/workflows/ci.yml`.
- All 4 CI pipeline jobs must pass green:
  1. `backend-test-and-lint` (Python 3.12, FFmpeg, Ruff, Pytest)
  2. `frontend-test-and-lint` (Node 20, ESLint, Vitest, Next.js build)
  3. `docker-build-verification` (Docker Compose / multi-stage Dockerfile)
  4. `security-secret-scan` (Automated secret leak prevention audit)

---

## 2. Secrets & Configuration Security

### Zero-Hardcoding Rule
- **Never** hardcode API keys, service tokens, private keys, fallback authorization headers, or external production URLs into source code or test mock data.

### Synchronized Environment Templates
- Whenever a new environment variable or configuration option is introduced, it **must** be documented simultaneously in:
  1. Root `.env.example`
  2. `frontend/.env.example`
  3. `orchestrator/.env.example`

### Secret Abstraction & Redaction
- Access backend credentials exclusively via `orchestrator.security.secrets` (`SecretManager`).
- Always wrap logged or returned credential values in `mask_secret()` so plaintext is never exposed in logs, telemetry payloads, or API responses.

---

## 3. Centralized Frontend State Management

### Single Source of Truth: Zustand
- All campaign-wide, cross-component, and telemetry states **must** reside in `frontend/src/store/useCampaignStore.ts`.
- Avoid creating fragmented local `useState` or nested React Context providers for state that crosses components (e.g., active brief parameters, streaming WebSocket `AgentEvent`s, creative assets, poster customizer configuration).
- Keep store actions pure, predictable, and fully typed.

---

## 4. Structured Observability & Error Handling

### Backend Observability
- All logging must use structured formatting (`orchestrator.logging_config`).
- Propagate `X-Correlation-ID` across all REST calls, WebSocket handoffs, and background worker jobs.
- Catch domain-specific exceptions cleanly and return standard RFC 7807 problem details or structured error payloads.

### Frontend Error Boundaries
- Retain and expand Next.js runtime error boundaries (`frontend/src/app/error.tsx`) and 404 handlers (`frontend/src/app/not-found.tsx`).
- Prevent unhandled UI exceptions from causing white-screen failures; always offer the user a clear error message, diagnostic context, and retry actions.

---

## 5. Documentation & Code Readability

- **Inline Code Comments:** Complex multi-agent coordination (BAND room broadcasting, visual-to-copy context handoffs, HTML5 canvas poster rendering) must be heavily annotated with inline comments explaining design rationale.
- **Root README Alignment:** Any newly added feature, architecture change, or agent capability must be updated in `README.md`, including updating the Mermaid sequence diagrams and quickstart steps.
