# Карта репозитория и веток

[← README](../README.md) · [Правила совместной работы](../CONTRIBUTING.md)

Обзор актуален на **23 сентября 2026 года**. Ветки сохраняют историю распределённой работы двух разработчиков. Их имена оставлены прежними, чтобы не нарушать локальные checkout, ссылки и существующие PR.

## Куда идти

- **Посмотреть продукт:** [опубликованное приложение](https://akim-five-hours.vercel.app).
- **Запустить или продолжить разработку:** [`main`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/main). Новую задачу начинать от актуального `origin/main`.
- **Узнать, какой код опубликован:** [журнал deployment](deployment.md).
- **Проверить исходные данные:** [`dataset/dataset.json`](../dataset/dataset.json).
- **Оценить проект без запуска:** [README](../README.md) и [повторяемое демо](demo.md).

## Назначение веток

| Ветка | Назначение | Состояние |
| :--- | :--- | :--- |
| [`main`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/main) | Основная версия проекта | Приложение, датасет, тесты и документация; ветка для запуска и новых PR |
| [`codex/ui`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/ui) | Интерфейс и сборка этапов разработки | Проверенная интеграция объединена в `main` через PR #3; ветка сохранена |
| [`codex/map-studio`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/map-studio) | Фокус района, панели и события на карте | Карта включена в `main` через PR #7. Дополнительное оформление из `4db0faa` находится в PR #8 и пока не включено в `main` |
| [`codex/deploy`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/deploy) | Подготовка публикации и проверка Vercel/Redis | Предыдущая публикация `5f478f0` и отчёт `934a40b` включены в `main`; актуальный deployment описан в журнале |
| [`codex/scenario-features`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/scenario-features) | Backend рейтинга, рекомендаций, событий и презентации | Изменения до `7ce23ac` включены в `main` |
| [`codex/resident-feedback`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/resident-feedback) | Экспериментальная проекция состояния по отзывам | Изменения до `32a4946` включены в `main`; API сохранён, отдельного экрана пока нет |
| [`codex/dataset-prep`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/dataset-prep) | Адаптер датасета, симуляция и базовый AI/API | Изменения до `07b139c` включены в `main`; название отражает начальный этап |
| [`codex/contracts`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/contracts) | Согласованные контракты authoritative dataset | Изменения до `c4b8ca1` включены в `main`; старые схемы из истории не использовать |

«Включены» означает, что указанный commit этапа является предком `main`. В начале README пяти исторических backend/deploy-веток добавлены пояснения и ссылка на актуальное приложение; последующие commits этих пометок не меняют код этапа. Статус отдельного исторического PR может отличаться: его исходной базой была другая рабочая ветка.

## Pull requests

| PR | Назначение | Как читать |
| :--- | :--- | :--- |
| [#8 · оформление интерфейса](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/8) | `codex/map-studio` → `main` | Открыт: типографика, навигация и оформление презентации; следующие изменения после PR #7 |
| [#7 · карта и события](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/7) | `codex/map-studio` → `main` | Новая карта, события и актуальный журнал публикации объединены в `main` |
| [#3 · приложение](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/3) | `codex/ui` → `main` | Приложение объединено в `main`; история основной интеграции |
| [#6 · публикация](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/6) | `codex/deploy` → `codex/scenario-features` | История публикации и исправления «+»; эти commits уже включены в `main` |
| [#5 · дополнительные функции](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/5) | `codex/scenario-features` → `codex/resident-feedback` | История серверного этапа; включена в интеграцию |
| [#4 · отзывы](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/4) | `codex/resident-feedback` → `codex/ui` | PR объединён |
| [#2 · модель и API](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/2) | `codex/dataset-prep` → `codex/ui` | PR объединён |
| [#1 · контракты](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/1) | `codex/contracts` → `main` | История контрактов; исходный код этапа включён в `main` через PR #3 |

Исторические PR не закрываются вручную в рамках оформления; GitHub может отметить включённый PR как объединённый автоматически. Датасет, commits и ветки сохраняются. При последующих изменениях обновлять эту таблицу.

## После объединения

Для запуска и новых задач использовать `main`. Разработчикам с существующими checkout нужно сделать fetch/pull и включить актуальный `main` в свою рабочую ветку перед следующими изменениями. Имена веток и локальные настройки второго устройства не меняются. Подключение GitHub к Vercel — отдельная настройка: объединение с `main` само по себе не создаёт deployment.

## Рекомендуемые поля GitHub About

Для владельца репозитория, если есть права на изменение настроек:

- **Description:** `that day — AI-симулятор управления Астаной: 5 направлений, бюджет 100 и прозрачный Quality of Life Score.`
- **Website:** `https://akim-five-hours.vercel.app`
- **Topics:** `hackathon`, `astana`, `urban-planning`, `simulation`, `nextjs`, `typescript`, `openai`

Это подготовленные значения, а не утверждение, что настройки уже изменены. Репозиторий остаётся приватным; жюри нужен доступ к исходникам, демо доступно отдельно. GitHub не предоставляет обычных описаний для каждой ветки, поэтому их назначение собрано здесь.
