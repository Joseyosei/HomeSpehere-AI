# HomeSphere AI
Your home. Connected. Intelligent.
Local-first smart home dashboard, inspired by [PRMGR Observatory Starter](https://github.com/prmgr-org/prmgr-observatory-starter). Original implementation.
## Run
Node.js 22.13+ required. No paid API keys. Install the MQTT dependency with npm install before enabling integrations.
```sh
npm start
npm test
```
Open http://127.0.0.1:8780. SQLite database created and synthetic data seeded on first start. The dashboard shows persisted demo data; optional read-only Home Assistant and MQTT connections; no AI model yet. API docs: [API](docs/API.md), [database](docs/DATABASE.md), [architecture](docs/ARCHITECTURE.md). DB_PATH and PORT optionally configure storage and port. Keep data local; no authentication yet. Do not expose server externally. Node SQLite may emit an experimental warning.

## Stage 05
See [integration setup](docs/INTEGRATIONS.md). Use npm install and npm run start:configured after copying .env.example to .env. Demo runs with npm start.
