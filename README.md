# HomeSphere AI

Your home. Connected. Intelligent.

Local-first smart home intelligence dashboard. The initial prototype uses clearly labelled synthetic readings, not real devices. Inspired by [PRMGR Observatory Starter](https://github.com/prmgr-org/prmgr-observatory-starter); initial implementation is original code.

## Run

Install Node.js 22+, then run `npm start` and open http://127.0.0.1:8780. Run `npm test` for unit tests. No dependencies or paid API keys required for the demo.

## Scope

Initial release: dashboard, energy and climate metrics, simulated device status, deterministic advisory insights. Future: authenticated Home Assistant integration, durable history, optional local LLM, mobile and TV layouts. No live device control or cloud upload in the prototype.

See [architecture](docs/ARCHITECTURE.md) for the roadmap and safety boundaries.
