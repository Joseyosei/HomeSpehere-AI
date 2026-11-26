# HomeSphere AI
Your home. Connected. Intelligent.
Local-first smart home dashboard, inspired by [PRMGR Observatory Starter](https://github.com/prmgr-org/prmgr-observatory-starter). Original implementation.
## Run
Node.js 22.13+ required. No dependencies or paid API keys.
```sh
npm start
npm test
```
Open http://127.0.0.1:8780. SQLite database created and synthetic data seeded on first start. The dashboard shows persisted demo data; no real devices or AI model yet. API docs: [API](docs/API.md), [database](docs/DATABASE.md), [architecture](docs/ARCHITECTURE.md). DB_PATH and PORT optionally configure storage and port. Keep data local; no authentication yet. Do not expose server externally. Node SQLite may emit an experimental warning.
