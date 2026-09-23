# Карта репозитория и веток

[← README](../README.md) · [Правила совместной работы](../CONTRIBUTING.md)

Обзор актуален на **23 сентября 2026 года**. Ветки сохраняют историю распределённой работы двух разработчиков. Их имена оставлены прежними, чтобы не нарушать локальные checkout, ссылки и существующие PR.

## Куда идти

- **Посмотреть продукт:** [опубликованное приложение](https://akim-five-hours.vercel.app).
- **Запустить или продолжить разработку:** [`codex/ui`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/ui).
- **Узнать, какой код опубликован:** [журнал deployment](deployment.md).
- **Проверить исходные данные:** [`dataset/dataset.json`](../dataset/dataset.json).
- **Оценить проект без запуска:** [README](../README.md) и [повторяемое демо](demo.md).

## Назначение веток

| Ветка | Назначение | Состояние |
| :--- | :--- | :--- |
| [`main`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/main) | Главная страница: датасет и документационная витрина | Код приложения пока не перенесён; запускать из `codex/ui` |
| [`codex/ui`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/ui) | Текущая интеграция приложения и основной интерфейс | Включены backend, дополнительные функции и исправления опубликованной версии |
| [`codex/deploy`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/deploy) | Подготовка публикации и проверка Vercel/Redis | Последняя зафиксированная сборка приложения — `5f478f0`; отчёт — `934a40b`; включены в `codex/ui` |
| [`codex/scenario-features`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/scenario-features) | Backend рейтинга, рекомендаций, событий и презентации | Изменения до `7ce23ac` включены в интеграцию |
| [`codex/resident-feedback`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/resident-feedback) | Экспериментальная проекция состояния по отзывам | Изменения до `32a4946` включены; API сохранён, отдельного экрана пока нет |
| [`codex/dataset-prep`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/dataset-prep) | Адаптер датасета, симуляция и базовый AI/API | Изменения до `07b139c` включены; название отражает начальный этап |
| [`codex/contracts`](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/tree/codex/contracts) | Согласованные контракты authoritative dataset | Изменения до `c4b8ca1` включены; старые схемы из истории не использовать |

«Включены» означает, что соответствующий commit является предком текущей интеграции. Это не утверждение о статусе кнопки Merge на GitHub: часть изменений объединялась через Git локально, поэтому отдельные PR могут оставаться открытыми.

## Pull requests

| PR | Назначение | Как читать |
| :--- | :--- | :--- |
| [#3 · приложение](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/3) | `codex/ui` → `main` | Основная точка просмотра интегрированной версии; код ещё не слит в main |
| [#6 · публикация](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/6) | `codex/deploy` → `codex/scenario-features` | История публикации и исправления «+»; эти commits уже включены в `codex/ui` |
| [#5 · дополнительные функции](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/5) | `codex/scenario-features` → `codex/resident-feedback` | История серверного этапа; включена в интеграцию |
| [#4 · отзывы](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/4) | `codex/resident-feedback` → `codex/ui` | PR объединён |
| [#2 · модель и API](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/2) | `codex/dataset-prep` → `codex/ui` | PR объединён |
| [#1 · контракты](https://github.com/BAITC-Hacks/hack-e54d9694-that-day-in/pull/1) | `codex/contracts` → `main` | Историческая ветка контрактов; изменения включены через интеграцию приложения |

Открытые исторические PR пока не закрываются автоматически. Датасет, commits и ветки не удаляются. Последующие изменения веток могут изменить эту таблицу — обновлять её при передаче этапа.

## Следующий этап объединения

Когда команда решит переносить приложение в `main`, использовать основной PR #3 после актуальных проверок. После merge обновить инструкции запуска, эту таблицу и ссылки интеграции. Подключение GitHub к Vercel — отдельная настройка: перенос в `main` сам по себе не создаёт deployment.

## Рекомендуемые поля GitHub About

Для владельца репозитория, если есть права на изменение настроек:

- **Description:** `Аким на 5 часов — AI-симулятор управления Астаной: 5 направлений, бюджет 100 и прозрачный Quality of Life Score.`
- **Website:** `https://akim-five-hours.vercel.app`
- **Topics:** `hackathon`, `astana`, `urban-planning`, `simulation`, `nextjs`, `typescript`, `openai`

Это подготовленные значения, а не утверждение, что настройки уже изменены. Репозиторий остаётся приватным; жюри нужен доступ к исходникам, демо доступно отдельно. GitHub не предоставляет обычных описаний для каждой ветки, поэтому их назначение собрано здесь.
