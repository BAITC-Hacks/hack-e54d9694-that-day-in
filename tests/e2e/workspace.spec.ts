import { test, expect } from "@playwright/test";

// Browser tests exercise the real simulation API, but never make paid AI calls.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/analyze", async (route) => {
    const response = await page.request.post("/api/simulate", {
      data: route.request().postDataJSON(),
    });
    const body = await response.json();
    if (!response.ok()) {
      await route.fulfill({ status: response.status(), json: body });
      return;
    }
    await route.fulfill({
      status: 503,
      json: {
        ...body,
        created_at: "2026-09-23T00:00:00.000Z",
        model: "offline-ui-test",
        prompt_version: "2.0.0",
        evidence: [],
        status: "ai_unavailable",
        analysis: null,
        ai_error: {
          code: "missing_api_key",
          message: "Offline test: no provider calls.",
        },
      },
    });
  });
});

test("first visit has one clear action and reveals details progressively", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Астана начинается с вас." }),
  ).toBeVisible();
  await expect(page.locator(".metric-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Начать с района Нура" }).click();
  await expect(
    page.getByRole("heading", { name: "Нура", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".metric-list")).not.toBeVisible();
  await page.getByText("Подробнее о районе", { exact: true }).click();
  await expect(page.locator(".metric-row")).toHaveCount(10);
  await page
    .getByRole("button", { name: "Выбрать решение", exact: true })
    .click();
  await expect(page.locator("dialog[open] .measure-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Все решения", exact: true }).click();
  await expect(page.locator("dialog[open] .measure-card")).toHaveCount(14);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("mobile flow has no overflow, accessible districts and working choice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Правила игры", exact: true }).click();
  await expect(page.locator("dialog[open]")).toContainText(
    "не более двух из одного направления",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Район Алматы", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Алматы", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Выбрать решение", exact: true })
    .click();
  await page.getByRole("button", { name: "Соцсфера", exact: true }).click();
  await page.getByRole("button", { name: "Добавить M9", exact: true }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator(".count-pill")).toHaveText("1 / 5");
  await expect(page.getByRole("status")).toContainText("Решение добавлено");
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(page.locator(".count-pill")).toHaveText("0 / 5");
});

test("control scenario retains exact score, server verification and draft persistence", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Правила игры", exact: true }).click();
  await page
    .getByRole("button", { name: "Загрузить контрольный пример · 95 ед." })
    .click();
  await expect(page.locator(".count-pill")).toHaveText("5 / 5");
  await expect(page.locator(".budget-value")).toHaveText("5 / 100");
  await page
    .getByRole("button", { name: "Посмотреть результат", exact: true })
    .click();
  await expect(page.locator(".result-score strong")).toHaveText("56,54");
  await expect(page.locator(".report-message")).toContainText(
    "Числовой результат подтверждён сервером",
  );
  await expect(page.locator(".result-breakdown")).toContainText(
    "Критических значений0",
  );
  await page.getByRole("button", { name: "Закрыть результат" }).click();
  await page.getByRole("button", { name: /Мой план/ }).click();
  await page.getByRole("button", { name: "Удалить M8", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Посмотреть результат", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.locator(".count-pill")).toHaveText("4 / 5");
  await expect(page.locator(".budget-value")).toHaveText("25 / 100");
});

test("successful explanation shows evidence and reuses a saved report", async ({
  page,
}) => {
  let analysisCalls = 0;
  await page.route("**/api/analyze", async (route) => {
    analysisCalls++;
    const response = await page.request.post("/api/simulate", {
      data: route.request().postDataJSON(),
    });
    const body = await response.json();
    const item = {
      explanation: "ТЕСТ: улучшены показатели контрольного сценария.",
      evidence_ids: ["ui:test"],
    };
    await route.fulfill({
      json: {
        ...body,
        created_at: "2026-09-23T00:00:00.000Z",
        model: "offline-ui-test",
        prompt_version: "2.0.0",
        evidence: [
          {
            id: "ui:test",
            label: "Контрольный пример",
            value: "Score 56.54307",
          },
        ],
        status: "complete",
        ai_error: null,
        analysis: {
          summary: "ТЕСТОВОЕ объяснение без обращения к модели.",
          strengths: [item, item],
          risks: [item, item],
          consequences: [item, item],
        },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Правила игры", exact: true }).click();
  await page
    .getByRole("button", { name: "Загрузить контрольный пример · 95 ед." })
    .click();
  await page.getByRole("button", { name: "Посмотреть результат" }).click();
  await expect(page.locator(".analysis-summary")).toContainText(
    "ТЕСТОВОЕ объяснение",
  );
  await page
    .getByText("На основе каких данных", { exact: true })
    .first()
    .click();
  await expect(page.locator("details[open]")).toContainText("Score 56.54307");
  await page.reload();
  await expect(page.locator(".count-pill")).toHaveText("5 / 5");
  await page.getByRole("button", { name: "Посмотреть результат" }).click();
  await expect(page.locator(".report-provenance")).toContainText(
    "Сохранённый отчёт",
  );
  expect(analysisCalls).toBe(1);
});

test("catalog preserves conflict and budget constraints in the guided flow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Начать с района Нура" }).click();
  const catalog = async () => {
    await page
      .getByRole("button", { name: "Выбрать решение", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Все решения", exact: true })
      .click();
  };
  await catalog();
  await page.getByRole("button", { name: "Добавить M3", exact: true }).click();
  await catalog();
  await expect(
    page.getByRole("button", { name: "Добавить M1", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Добавить M3", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Добавить M5", exact: true }).click();
  await catalog();
  await page.getByRole("button", { name: "Добавить M7", exact: true }).click();
  await catalog();
  await page.getByRole("button", { name: "Добавить M6", exact: true }).click();
  await catalog();
  const card = page
    .locator("article")
    .filter({
      has: page.getByRole("button", { name: "Добавить M10", exact: true }),
    });
  await expect(card.getByRole("button")).toBeDisabled();
  await expect(card).toContainText("превышает бюджет");
  await expect(page.locator(".budget-value")).toHaveText("1 / 100");
});

test("geographic map loads offline asset, supports zoom, drag and reset", async ({
  page,
}) => {
  await page.goto("/");
  const response = await page.request.get("/maps/astana.svg");
  expect(response.ok()).toBe(true);
  const map = page.locator(".city-scene");
  const original = await map.getAttribute("viewBox");
  await page
    .getByRole("button", { name: "Увеличить карту", exact: true })
    .click();
  await expect(map).not.toHaveAttribute("viewBox", original!);
  const zoomed = await map.getAttribute("viewBox");
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(map).not.toHaveAttribute("viewBox", zoomed!);
  await page
    .getByRole("button", { name: "Вернуть масштаб карты", exact: true })
    .click();
  await expect(map).toHaveAttribute("viewBox", original!);
  await page.getByRole("button", { name: "Район Есиль", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Есиль", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "© OpenStreetMap · ODbL" }),
  ).toBeVisible();
});
