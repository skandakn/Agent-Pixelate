# Contributing to Agent Pixelate

Thank you for contributing to **Agent Pixelate**! To ensure the project maintains the highest standard of engineering craft, security, and test reliability, all contributors (including automated agents and human developers) must follow these guidelines.

---

## 🚀 Pre-Submission Checklist

Before creating a pull request or pushing commits, verify the following:

- [ ] **Frontend Tests Pass:** `cd frontend && npm test` passes 100% of Vitest unit tests.
- [ ] **Frontend Build Passes:** `cd frontend && npm run build` compiles with zero TypeScript errors or warnings.
- [ ] **Backend Tests Pass:** `python -m pytest orchestrator/tests -v` passes 100% of Pytest tests.
- [ ] **No Hardcoded Secrets:** Zero hardcoded API keys, bearer tokens, or fallback secrets exist in code.
- [ ] **Environment Templates Updated:** Any new configuration parameters are documented in `.env.example`, `frontend/.env.example`, and `orchestrator/.env.example`.
- [ ] **Zustand State Centralization:** Any new global UI or campaign state is wired through `frontend/src/store/useCampaignStore.ts`.
- [ ] **Structured Logging & Tracing:** New backend endpoints participate in correlation tracing (`X-Correlation-ID`) and structured logging.
- [ ] **Documentation & Comments:** Non-trivial agent logic, protocol handoffs, and canvas operations have inline comments and docstrings.

---

## 🧪 Testing Guidelines

### Frontend
- Tests are located in `frontend/src/__tests__/`.
- Use Vitest and mock external network boundaries where appropriate.
- Test new store actions, renderer math/transformations, and client API contracts.

### Backend
- Tests are located in `orchestrator/tests/` and `agents/tests/`.
- Use `pytest` with `pytest-asyncio`.
- Verify request validation, BAND message handoffs, and fallback state transitions.

---

## 🔒 Security & Secrets Management

- All secrets are accessed via the `orchestrator.security.SecretManager` instance (`secrets.get(...)`).
- Never log raw credentials. Always use `mask_secret(value)` before logging or outputting in debugging interfaces.
- For cloud environments, configure `SECRETS_PROVIDER` (`aws_secrets`, `gcp_secrets`, `vault`, or `env`).

---

## 📐 Architecture & Standards Reference

See [`AGENTS.md`](./AGENTS.md) and [`README.md`](./README.md) for full architectural patterns, sequence diagrams, and design rules.
