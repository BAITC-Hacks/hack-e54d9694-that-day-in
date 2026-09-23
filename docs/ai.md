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

Версия промпта 2.0.0. Структура ответа и существование evidence_ids проверяются сервером. Это не доказывает истинность каждой фразы: смысловую корректность экспертного текста полностью автоматизировать нельзя. Общий лимит AI 45 секунд; maxRetries=0; обработчик maxDuration=60 и Node runtime. Повторная попытка только по явному новому запросу.

Документация: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [модель](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

## Интеграция с интерфейсом

PR #1 содержит новые контракты и fixtures. Их изменение несовместимо со старым UI: решения теперь массив, направление ecology, меры с district/city scope, 10 показателей и новый путь основного балла simulation.after.score. Координаты и внешний вид карты остаются в UI; в исходный JSON они не добавляются.

Fixtures: fixtureCatalog, fixtureDraftSelections, fixtureSimulateRequest, fixtureAnalyzeRequest, fixtureSimulation, fixtureCompleteAnalysis, fixtureUnavailableAnalysis. Каталог взят из источника; объяснения AI явно помечены как тестовые. fixture-only нельзя отправлять production API — получите 409.

Нужны Zod 4, OpenAI 6, Vitest 3, поддержка JSON imports и Node 22. package.json, lock-файл, корневые настройки и UI меняет первый разработчик. До каркаса проверки запускаются во временном окружении, без создания второго приложения.

## Состояние проверок

После адаптации выполнены 33 unit-теста на Node.js 22.23.2/Vitest 3.2.7. Контрольный пример: стоимость 95, Score 56.54307, critical_count=0. API и новый объясняющий AI-адаптер — следующий этап.

Ранее выполнена реальная проверка доступа: метаданные модели и простой Responses Structured Outputs через официальный SDK (completed за 3890 мс). Это не тест нового полного анализа. Автоматические тесты не должны использовать ключ или платные вызовы.
