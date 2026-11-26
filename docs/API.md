# Stage 04 API v0.2
Local only, GET, JSON, no authentication yet. Do not expose to LAN or internet. All timestamps are UTC Unix epoch milliseconds. Default household demo; device meter. No public write endpoint. Future adapters call insertReading only after source validation.
| Route | Parameters |
| --- | --- |
| /api/health | none |
| /api/households | none |
| /api/rooms | household |
| /api/devices | household |
| /api/latest | household |
| /api/history | household, device, metric, from, to, limit |
| /api/energy | household, device, from, to |
History inclusive bounds, ordered ascending, default last 24 hours, maximum 31 days, default limit 1000, max 5000; truncated flag. Advance from to last timestamp + 1 for paging. Latest marks stale after 30 minutes. Unknown and suspect readings are not zero. Energy integrates adjacent good power samples no more than 30 minutes apart, clipped to requested range. kWh null if no valid coverage; coverage fraction and coveredMs accompany totals. No battery or billing estimates; independent import/export/solar/consumption streams prevent double counting. Demo data generated once at initialization, becomes stale with time; no automatic refresh. Use a fresh database for a fresh synthetic scenario. HTTP 400 invalid query, 404 missing resource, 405 non-GET, 500 internal error.
