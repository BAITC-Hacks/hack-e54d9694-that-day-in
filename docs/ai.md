# API и AI: обновлённый протокол

Контракты src/shared/contracts.ts заменены под dataset/dataset.json. Предыдущие Program/EvaluateRequest/Evaluation, /api/evaluate, критерии AI и finalScore отменены. Все новые JSON-поля snake_case.

## API

GET /api/catalog → {dataset_version, dataset}. dataset содержит исходный JSON без переписывания. dataset_version — SHA-256 содержимого JSON с каноническим порядком ключей: меняется при изменении данных, даже если schema_version сохранён.

POST /api/simulate и POST /api/analyze принимают одинаковый запрос:

```json
{
  "dataset_version": "значение из GET /api/catalog",
  "decisions": [
    {"measure_id":"M7","district_id":"nura"},
    {"measure_id":"M8","district_id":"nura"},
    {"measure_id":"M10","district_id":"nura"},
    {"measure_id":"M12","district_id":null},
    {"measure_id":"M5","district_id":"saryarka"}
  ]
}
```

Клиент не передаёт цены, эффекты, рассчитанные показатели или Score. Сервер сам валидирует и пересчитывает сценарий. Лишние поля запрещены. 422 — ValidationError с code/message/field_errors; 409 — несовпадение dataset_version. AI для невалидного сценария не вызывается.

/api/simulate → SimulationResponse: dataset_version, scenario_key, канонический decisions, simulation. В simulation: budget, districts (before/after/delta), before/after (ScoreSummary), score_delta, contributions и applied_synergies. Основной балл — simulation.after.score.

/api/analyze → тот же расчёт плюс created_at, model, prompt_version, evidence, status, analysis, ai_error. При успехе status=complete, analysis содержит summary и по 2–3 пункта strengths/risks/consequences с explanation/evidence_ids; ai_error=null. При сбое — HTTP 503, status=ai_unavailable, analysis=null, ai_error с безопасной причиной. Расчётная часть и Score сохраняются. UI должен читать тело ответа и при HTTP 503.

scenario_key — хеш dataset_version и канонических решений. Порядок кликов не влияет. Серверного хранилища нет. Повторный запрос AI может дать другой текст; сохранять полученный отчёт должен клиент.

## Настройки AI

Серверные env: OPENAI_API_KEY, OPENAI_MODEL (по умолчанию gpt-5.4-mini-2026-03-17). Ключ не передаётся браузеру и не коммитится. Локально — .env.local, на Vercel — серверная переменная окружения; на другом устройстве ключ задаётся отдельно. Ключ, попавший в чат, рекомендуется заменить.

Официальный OpenAI SDK, Responses API, Structured Outputs. AI получает только серверные факты: исходные и итоговые показатели, вклады мер, синергии, бюджет, критические значения и уже рассчитанный Score. Запрещены новые цены, эффекты и факты о реальном городе. Предположения должны быть явно обозначены. AI не выставляет оценки и не меняет результат.

Версия промпта 2.0.1. Структура ответа и существование evidence_ids проверяются сервером. Это не доказывает истинность каждой фразы: смысловую корректность экспертного текста полностью автоматизировать нельзя. Промпт отдельно запрещает путать названия показателей и требует объяснять отрицательные вклады мер. Общий лимит AI 45 секунд; maxRetries=0; обработчик maxDuration=60 и Node runtime. Повторная попытка только по явному новому запросу.

Документация: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [модель](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

## Интеграция с интерфейсом

PR #1 содержит новые контракты и fixtures. Их изменение несовместимо со старым UI: решения теперь массив, направление ecology, меры с district/city scope, 10 показателей и новый путь основного балла simulation.after.score. Координаты и внешний вид карты остаются в UI; в исходный JSON они не добавляются.

Fixtures: fixtureCatalog, fixtureDraftSelections, fixtureSimulateRequest, fixtureAnalyzeRequest, fixtureSimulation, fixtureCompleteAnalysis, fixtureUnavailableAnalysis. Каталог взят из источника; объяснения AI явно помечены как тестовые. fixture-only нельзя отправлять production API — получите 409.

Нужны Zod 4, OpenAI 6, Vitest 3, поддержка JSON imports и Node 22. Они уже есть в каркасе первого разработчика (codex/ui, 2776251). Каркас подключён к рабочей ветке совместимым merge; package.json, lock-файл, настройки и UI в точности сохранены. Второй проект не создавался.

Backend находится в PR #2 / codex/dataset-prep. Название ветки историческое: старый каталог из неё удалён, теперь внутри только адаптер исходного JSON, расчёты, API, AI, тесты и документация поверх каркаса. PR #2 основан на codex/ui, чтобы отдельно показывать изменения backend. Интеграцию в main выполняет первый разработчик. Старое предупреждение в AGENTS.md о шестирайонном каталоге уже не описывает текущее содержимое этой ветки; владельцу каркаса следует обновить его при интеграции.

После c4b8ca1 публичные контракты больше не менялись. Версия промпта изменена отдельно, без изменения формата ответа. Клиенту нужно заменить тестовые данные вызовами этих трёх маршрутов и подключить чистые функции для локального предпросмотра. При HTTP 503 показать рассчитанный Score и сообщение о недоступности объяснения. Серверные пакеты нельзя импортировать в клиентские модули.

## Состояние проверок

2026-09-23 на Node.js 22.23.2: 59 unit/API-тестов (Vitest 3.2.7), typecheck всего проекта, ESLint серверной части/общих модулей/тестов и production-сборка Next.js 16.3.6 прошли. Сборка зарегистрировала /api/catalog, /api/simulate, /api/analyze. E2E интерфейса и деплой в рамках этой работы не выполнялись.

После сборки приложение запущено локально на 127.0.0.1:3031; HTTP-проверка подтвердила точное совпадение каталога с JSON, контрольный результат, независимость от порядка, HTTP 409 для старой версии и 422 для неполного набора.

Настоящие HTTP-вызовы /api/analyze с моделью gpt-5.4-mini-2026-03-17 и промптом 2.0.1:

| Сценарий | HTTP / status | Score | critical_count | Время |
| --- | --- | --- | --- | --- |
| example | 200 / complete | 56.54307 | 0 | 8.778 с |
| concentrated | 200 / complete | 53.8565475 | 2 | 6.325 с |
| tradeoffs | 200 / complete | 54.232295 | 2 | 4.866 с |

Во всех трёх ответах прошли проверки ссылок evidence_ids; расчёт совпал с /api/simulate. Настоящие тексты не записаны вместо fixtures. Выборочная смысловая проверка показала объяснение социальных дефицитов Нуры, неравномерного распределения и отрицательного вклада M11; это не гарантия точности будущих ответов.

## Повторение проверок

На Node 22 после npm ci: `npm run typecheck`, `npm test`, `npm run build`. Линтер своей части: `npx eslint src/shared src/data src/lib src/app/api tests/unit tests/api`.

Для ручной HTTP-проверки запустите собранное приложение: `npm run start -- --port 3031`. В другом терминале: `node tests/api/live-smoke.mjs` (без платных обращений). Явный `--live` запускает три настоящих AI-запроса; OPENAI_API_KEY должен быть задан у сервера. Другой адрес задаётся через SMOKE_BASE_URL. Скрипт не входит в Vitest и не запускается автоматически. Каждый успешный повтор может вернуть новый текст.
