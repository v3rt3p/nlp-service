# nlp-service

Deterministic natural-language parser for common Razvalisa assistant requests.

## Endpoints

- `GET /health` returns `{ "status": "ok" }`.
- `POST /parse` accepts `{ "text": string, "functions": object }` and returns a direct response, known function calls, or `unknown` for LLM fallback.

The service never connects to MQTT. The processor supplies the currently available function catalog and continues through the LLM when parsing is uncertain.

## Environment

- `PORT` (default `8090`)
- `TIMEZONE` (default `Europe/Moscow`)
# nlp-service
