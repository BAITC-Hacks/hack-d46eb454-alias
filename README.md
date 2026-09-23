# hack-d46eb454-alias
Hackathon team repository for Alias

## Работа с ИИ-агентами

- [Цель, ограничения и готовность MVP](PROJECT_BRIEF.md)
- [Общие инструкции агентам](AGENTS.md)
- [Контракт API](contracts/openapi.yaml)
- [Пример ответа рекомендаций](contracts/example-recommendations-response.json)
- [Зафиксированные алгоритмы MVP](docs/ALGORITHMS.md)
- [Синтетические fixtures](tests/fixtures/replenishment_scenarios.json)
- [Как разделить работу и запустить агентов](docs/AGENT_START.md)
- [MCP: назначение и подключение](docs/MCP.md)

Проектные навыки: `hackalem-import`, `hackalem-replenishment`, `hackalem-ui`, `hackalem-verify` в `.agents/skills/`.

## Локальный запуск в Docker

После запуска Docker Desktop выполните из корня репозитория:

```bash
docker compose up --build
```

Интерфейс: `http://127.0.0.1:8080/#/data`. Документация API: `http://127.0.0.1:8000/docs`.
