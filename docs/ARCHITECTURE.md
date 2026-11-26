# Architecture and roadmap
Local-first web application for a single household. Start with a dependency-free Node server and browser modules; migrate to a richer UI only when needed.
## Stages
1. Prototype: synthetic snapshot, device status, energy/climate cards, rules-based insights.
2. Data: SQLite history, typed readings (timestamp, device, metric, unit, value, quality), retention and export. Preserve missing values; distinguish import from consumption.
3. Integration: read-only Home Assistant adapter with server-held token, MQTT opt-in, explicit device allowlist; stale data and connection failures visible.
4. AI: deterministic metrics plus optional local Ollama model for grounded explanations; no model-generated executable commands. User approval for any external data transmission.
5. Automation: authenticated household roles, explicit confirmation, allowlisted low-risk actions, audit log, idempotency and rate limits. No autonomous locks, alarms, heaters or safety equipment.
6. Responsive PWA, accessibility, tablet/TV layouts, offline assets; native apps later.
7. Security and release: threat model, authentication, CSRF protection, integration tests, backup and restore, deployment guide.
## Trust boundaries
Prototype binds to loopback only, no secret storage, no real device endpoints. Do not expose to LAN or internet until authentication and transport security are implemented. Never commit tokens or household telemetry to the public repository.
## Reference
PRMGR Observatory Starter (MIT) inspired the local-first, synthetic-data approach. This prototype uses original code rather than copying starter files. See https://github.com/prmgr-org/prmgr-observatory-starter.
