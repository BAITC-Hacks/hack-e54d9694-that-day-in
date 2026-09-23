import { test, expect, type Page } from "@playwright/test";
import type { SimulationResponse } from "../../src/shared/contracts";
import { dataset } from "../../src/data";
import { recommendScenarios } from "../../src/lib/simulation/recommendations";
import {
  buildSlides,
  slidesToMarkdown,
} from "../../src/lib/simulation/presentation";
import { fixtureCompleteAnalysis } from "../../src/shared/fixtures";

// All numerical scenarios use the actual /api/simulate server. Only paid AI and
// external Redis are replaced at the transport boundary. Never call a provider.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/analyze", async (route) => {
    const r = await page.request.post("/api/simulate", {
      data: route.request().postDataJSON(),
    });
    const source = await r.json();
    await route.fulfill({
      status: r.ok() ? 503 : r.status(),
      json: r.ok()
        ? {
            ...source,
            created_at: "2026-09-23T00:00:00.000Z",
            model: "offline-ui-test",
            prompt_version: "2.0.1",
            evidence: [],
            status: "ai_unavailable",
            analysis: null,
            ai_error: { code: "missing_api_key", message: "Offline test" },
          }
        : source,
    });
  });
  await page.route("**/api/recommendations", async (route) => {
    const r = await page.request.post("/api/simulate", {
      data: route.request().postDataJSON(),
    });
    const source = await r.json();
    await route.fulfill({
      status: 503,
      json: {
        source,
        search: "single_replacement",
        candidates: recommendScenarios(dataset, source.decisions),
        status: "ai_unavailable",
        model: "offline-ui-test",
        prompt_version: "recommendations-1.0.1",
        notes: null,
        evidence: [],
        ai_error: { code: "missing_api_key", message: "Offline test" },
      },
    });
  });
  await page.route("**/api/presentation", async (route) => {
    const body = route.request().postDataJSON();
    const r = await page.request.post("/api/simulate", {
      data: {
        dataset_version: body.dataset_version,
        decisions: body.decisions,
      },
    });
    const source = await r.json();
    const slides = buildSlides(dataset, source, null);
    const title = body.title ?? "Тестовая презентация";
    await route.fulfill({
      status: 503,
      json: {
        source,
        title,
        slides,
        markdown: slidesToMarkdown(title, slides),
        status: "ai_unavailable",
        model: "offline-ui-test",
        prompt_version: "2.0.1",
        evidence: [],
        ai_error: { code: "missing_api_key", message: "Offline test" },
      },
    });
  });
  await page.route("**/api/leaderboard**", (route) =>
    route.fulfill({
      status: 503,
      json: {
        code: "leaderboard_unavailable",
        message: "Offline test: storage unavailable",
      },
    }),
  );
});
async function example(page: Page) {
  await page
    .getByRole("button", { name: "Правила симулятора", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Загрузить контрольный пример · 95 ед." })
    .click();
}
async function openAll(page: Page) {
  await page
    .getByRole("button", { name: "Выбрать мероприятие", exact: true })
    .click();
  await page
    .locator("dialog[open]")
    .getByRole("button", { name: "Все решения", exact: true })
    .click();
}

test("map stays still after click or drag release, including outside its bounds", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const map = page.locator(".city-scene"),
    original = await map.getAttribute("viewBox");
  await page.getByRole("button", { name: "Район Есиль", exact: true }).click();
  await page.mouse.move(400, 600);
  await page.mouse.move(600, 670, { steps: 6 });
  await expect(map).toHaveAttribute("viewBox", original!);
  await page
    .getByRole("button", { name: "Увеличить карту", exact: true })
    .click();
  const zoomed = await map.getAttribute("viewBox");
  expect(zoomed).not.toBe(original);
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.65, {
    steps: 8,
  });
  await page.mouse.up();
  const stopped = await map.getAttribute("viewBox");
  expect(stopped).not.toBe(zoomed);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, {
    steps: 6,
  });
  await expect(map).toHaveAttribute("viewBox", stopped!);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 30, box.y + box.height * 0.5, {
    steps: 8,
  });
  await page.mouse.up();
  const outside = await map.getAttribute("viewBox");
  await page.mouse.move(box.x + 100, box.y + 100, { steps: 6 });
  await expect(map).toHaveAttribute("viewBox", outside!);
  await page
    .getByRole("button", { name: "Вернуть масштаб карты", exact: true })
    .click();
  await expect(map).toHaveAttribute("viewBox", original!);
  expect((await page.request.get("/maps/astana.svg")).ok()).toBe(true);
  expect(errors).toEqual([]);
});

test("five directions, district metrics, selection and constraints are accessible", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Нура", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".direction-strip button")).toHaveCount(5);
  await expect(page.locator(".metric-list")).not.toBeVisible();
  await page.getByText("Показатели района", { exact: true }).click();
  await expect(page.locator(".metric-row")).toHaveCount(10);
  await openAll(page);
  await expect(page.locator("dialog[open] .measure-card")).toHaveCount(14);
  await page.getByRole("button", { name: "Добавить M3", exact: true }).click();
  await openAll(page);
  await expect(
    page.getByRole("button", { name: "Добавить M1", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Добавить M3", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Добавить M5", exact: true }).click();
  await openAll(page);
  await page.getByRole("button", { name: "Добавить M7", exact: true }).click();
  await openAll(page);
  await page.getByRole("button", { name: "Добавить M6", exact: true }).click();
  await openAll(page);
  const card = page.locator("article").filter({
    has: page.getByRole("button", { name: "Добавить M10", exact: true }),
  });
  await expect(card.getByRole("button")).toBeDisabled();
  await expect(card).toContainText("превышает бюджет");
  await page.keyboard.press("Escape");
  await expect(page.locator(".budget-value")).toHaveText("1 / 100");
});

test("mobile layout works without overflow and supports keyboard district selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Район Алматы", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Алматы", exact: true }),
  ).toBeVisible();
  await openAll(page);
  await page.getByRole("button", { name: "Добавить M9", exact: true }).click();
  await expect(page.locator(".decision-count")).toHaveText("1 / 5");
  await page.getByRole("button", { name: "Удалить M9", exact: true }).click();
  await expect(page.locator(".decision-count")).toHaveText("0 / 5");
  await expect(
    page.getByRole("button", { name: "Рассчитать сценарий", exact: true }),
  ).toBeDisabled();
});

test("reference Score, unavailable AI and persisted edits retain authoritative rules", async ({
  page,
}) => {
  await page.goto("/");
  await example(page);
  await expect(page.locator(".budget-value")).toHaveText("5 / 100");
  await page
    .getByRole("button", { name: "Рассчитать сценарий", exact: true })
    .click();
  await expect(page.locator(".result-score strong")).toHaveText("56,54");
  await expect(page.locator(".report-message")).toContainText(
    "Числовой результат подтверждён сервером",
  );
  await expect(page.locator(".result-breakdown")).toContainText(
    "Критических значений0",
  );
  await page.getByRole("button", { name: "Удалить M8", exact: true }).click();
  await expect(page.locator(".result-score")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".decision-count")).toHaveText("4 / 5");
  await expect(page.locator(".budget-value")).toHaveText("25 / 100");
});

test("complete AI explanation shows evidence and reuses the correct cached report", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/analyze", async (route) => {
    calls++;
    const r = await page.request.post("/api/simulate", {
      data: route.request().postDataJSON(),
    });
    const source = await r.json();
    const item = {
      explanation: "ТЕСТ: объяснение проверенного сценария.",
      evidence_ids: ["test:score"],
    };
    await route.fulfill({
      json: {
        ...source,
        created_at: "2026-09-23T00:00:00.000Z",
        model: "offline-ui-test",
        prompt_version: "2.0.1",
        evidence: [
          { id: "test:score", label: "Контрольный Score", value: "56.54307" },
        ],
        status: "complete",
        analysis: {
          summary: "ТЕСТОВЫЙ AI-анализ без обращения к модели.",
          strengths: [item, item],
          risks: [item, item],
          consequences: [item, item],
        },
        ai_error: null,
      },
    });
  });
  await page.goto("/");
  await example(page);
  await page
    .getByRole("button", { name: "Рассчитать сценарий", exact: true })
    .click();
  await expect(page.locator(".analysis-summary")).toContainText("ТЕСТОВЫЙ");
  await page
    .getByText("На основе каких данных", { exact: true })
    .first()
    .click();
  await expect(page.locator("details[open]").first()).toContainText("56.54307");
  await page.reload();
  await page
    .getByRole("button", { name: "Рассчитать сценарий", exact: true })
    .click();
  await expect(page.locator(".report-provenance")).toContainText(
    "Сохранённый отчёт",
  );
  expect(calls).toBe(1);
});

test("recommendations use the backend contract and applying one invalidates old report", async ({
  page,
}) => {
  await page.goto("/");
  await example(page);
  await page
    .getByRole("button", { name: "Рассчитать сценарий", exact: true })
    .click();
  await expect(page.locator(".report-message")).toBeVisible();
  await page.getByRole("tab", { name: "Рекомендации", exact: true }).click();
  await page
    .getByRole("button", { name: "Найти улучшения", exact: true })
    .click();
  await expect(page.locator(".alternative")).toHaveCount(3);
  await expect(page.locator(".notice")).toContainText(
    "проверенные расчётным модулем",
  );
  await page
    .getByRole("button", { name: "Применить вариант", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("tab", { name: "Результат", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".result-score strong")).not.toHaveText("56,54");
  await expect(page.locator(".report-message")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Получить AI-анализ", exact: true }),
  ).toBeVisible();
  const displayed = await page.locator(".result-score strong").innerText();
  await page.reload();
  await expect(page.locator(".result-score strong")).toHaveText(displayed);
});

test("stale recommendation responses cannot overwrite an edited scenario", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/recommendations", async (route) => {
    const r = await page.request.post("/api/simulate", {
      data: route.request().postDataJSON(),
    });
    const source = await r.json();
    await gate;
    try {
      await route.fulfill({
        status: 503,
        json: {
          source,
          search: "single_replacement",
          candidates: recommendScenarios(dataset, source.decisions),
          status: "ai_unavailable",
          model: "offline-ui-test",
          prompt_version: "1",
          notes: null,
          evidence: [],
          ai_error: { code: "missing_api_key", message: "test" },
        },
      });
    } catch {
      /* Request intentionally aborted after edit. */
    }
  });
  await page.goto("/");
  await example(page);
  await page.getByRole("tab", { name: "Рекомендации", exact: true }).click();
  await page
    .getByRole("button", { name: "Найти улучшения", exact: true })
    .click();
  await page.getByRole("button", { name: "Удалить M8", exact: true }).click();
  release();
  await expect(page.locator(".alternative")).toHaveCount(0);
  await expect(page.getByRole("tabpanel")).toContainText(
    "сначала выберите пять",
  );
  await expect(page.locator(".decision-count")).toHaveText("4 / 5");
});

test("event reserve blocks invalid Score, allows redistribution and preserves base plan", async ({
  page,
}) => {
  await page.goto("/");
  await example(page);
  await page.getByRole("tab", { name: "События", exact: true }).click();
  await page.getByRole("button", { name: /Сильные осадки/ }).click();
  await expect(
    page.locator(".analysis-panel").getByRole("alert"),
  ).toContainText("превышает доступный бюджет на 5");
  await expect(
    page.getByRole("button", { name: "Рассчитать последствия", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".event-result")).toHaveCount(0);
  // Decisions may be canonically reordered after hydration; find the M5 slot.
  const selects = page.locator('.event-editor select[id^="event-measure"]');
  for (let i = 0; i < (await selects.count()); i++) {
    if ((await selects.nth(i).inputValue()) === "M5") {
      await selects.nth(i).selectOption("M4");
      break;
    }
  }
  await page
    .getByRole("button", { name: "Рассчитать последствия", exact: true })
    .click();
  await expect(page.locator(".event-result")).toContainText(
    "85 на меры + 10 резерв",
  );
  await expect(page.locator(".event-result strong")).toBeVisible();
  await expect(page.locator(".budget-value")).toHaveText("5 / 100");
  await page.getByRole("tab", { name: "Результат", exact: true }).click();
  await expect(page.locator(".result-score strong")).toHaveText("56,54");
});

test("presentation remains useful without AI and downloads real calculated content", async ({
  page,
}) => {
  await page.goto("/");
  await example(page);
  await page.getByRole("tab", { name: "Презентация", exact: true }).click();
  await page
    .getByLabel("Заголовок презентации")
    .fill("Сценарий команды Астана");
  await page
    .getByRole("button", { name: "Сформировать презентацию", exact: true })
    .click();
  await expect(page.locator(".notice")).toContainText(
    "Расчётные слайды сформированы",
  );
  await expect(page.locator(".slide-toolbar")).toContainText("1 / 6");
  await expect(page.locator(".presentation-slide")).toContainText(
    "Сценарий команды Астана",
  );
  await page
    .getByRole("button", { name: "Следующий слайд", exact: true })
    .click();
  await expect(page.locator(".slide-toolbar")).toContainText("2 / 6");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Скачать Markdown", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("astana-scenario.md");
  const stream = await file.createReadStream();
  let markdown = "";
  for await (const chunk of stream!) markdown += chunk.toString();
  expect(markdown).toContain("Сценарий команды Астана");
  expect(markdown).toContain("56\\.54307");
});

test("complete presentation includes AI explanation slides and evidence", async ({
  page,
}) => {
  await page.route("**/api/presentation", async (route) => {
    const body = route.request().postDataJSON();
    const r = await page.request.post("/api/simulate", {
      data: {
        dataset_version: body.dataset_version,
        decisions: body.decisions,
      },
    });
    const source = await r.json();
    const slides = buildSlides(
      dataset,
      source,
      fixtureCompleteAnalysis.analysis,
    );
    await route.fulfill({
      json: {
        source,
        title: body.title,
        slides,
        markdown: slidesToMarkdown(body.title, slides),
        status: "complete",
        model: "offline-ui-test",
        prompt_version: "test",
        evidence: fixtureCompleteAnalysis.evidence,
        ai_error: null,
      },
    });
  });
  await page.goto("/");
  await example(page);
  await page.getByRole("tab", { name: "Презентация", exact: true }).click();
  await page
    .getByRole("button", { name: "Сформировать презентацию", exact: true })
    .click();
  await expect(page.locator(".slide-toolbar")).toContainText("1 / 9");
  for (let i = 0; i < 6; i++)
    await page
      .getByRole("button", { name: "Следующий слайд", exact: true })
      .click();
  await expect(page.locator(".presentation-slide")).toContainText(
    "Сильные стороны",
  );
  await expect(page.locator(".evidence")).not.toHaveCount(0);
});

test("comparison reports unavailable storage without inventing an empty ranking", async ({
  page,
}) => {
  await page.goto("/");
  await example(page);
  await page.getByRole("tab", { name: "Сравнение", exact: true }).click();
  await expect(
    page.locator(".analysis-panel").getByRole("alert"),
  ).toContainText("Общий рейтинг пока недоступен");
  await expect(page.locator(".leaderboard")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Опубликовать результат", exact: true }),
  ).toBeDisabled();
});

test("comparison publishes only on explicit action, highlights own best and shows tied ranks", async ({
  page,
}) => {
  let source: SimulationResponse;
  let published = false;
  let calls = 0;
  const me = "00000000-0000-4000-8000-000000000001",
    other = "00000000-0000-4000-8000-000000000002";
  await page.route("**/api/leaderboard**", async (route) => {
    const c = await (await page.request.get("/api/catalog")).json();
    if (!source)
      source = await (
        await page.request.post("/api/simulate", {
          data: {
            dataset_version: c.dataset_version,
            decisions: dataset.example.decisions,
          },
        })
      ).json();
    const entry = {
      participant_id: me,
      display_name: "Тестовая команда",
      scenario: source,
      submitted_at: "2026-09-23T00:00:00.000Z",
    };
    if (route.request().method() === "POST") {
      calls++;
      expect(route.request().postDataJSON().display_name).toBe(
        "Тестовая команда",
      );
      published = true;
      await route.fulfill({ json: { policy: "personal_best", entry } });
    } else
      await route.fulfill({
        json: {
          dataset_version: c.dataset_version,
          mode: "standard",
          policy: "personal_best",
          total: published ? 2 : 1,
          offset: 0,
          limit: 20,
          entries: [
            {
              ...entry,
              participant_id: other,
              display_name: "Тестовый участник",
              rank: 1,
              is_winner: true,
            },
            ...(published ? [{ ...entry, rank: 1, is_winner: true }] : []),
          ],
          best_score: source.simulation.after.score,
          winner_count: published ? 2 : 1,
          current_participant_id: me,
        },
      });
  });
  await page.goto("/");
  await example(page);
  await page.getByRole("tab", { name: "Сравнение", exact: true }).click();
  await expect(page.locator(".leaderboard tbody tr")).toHaveCount(1);
  expect(calls).toBe(0);
  await page
    .getByLabel("Название команды или участника")
    .fill("Тестовая команда");
  await page
    .getByRole("button", { name: "Опубликовать результат", exact: true })
    .click();
  await expect(page.locator(".leaderboard tbody tr")).toHaveCount(2);
  await expect(page.locator(".own-entry")).toContainText("Ваш результат");
  await expect(page.locator(".pagination")).toContainText(
    "лучших результатов: 2",
  );
  expect(calls).toBe(1);
});
