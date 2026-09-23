import { test, expect } from "@playwright/test";

test("district selection and category filters use the authoritative dataset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Нура", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Исходные показатели города" }),
  ).toContainText("52,56");
  await page.getByRole("button", { name: "Район Есиль", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Есиль", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Район Есиль", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Экология", exact: true }).click();
  await expect(page.locator(".metric-row")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Изучить мероприятия", exact: true })
    .click();
  await expect(page.locator("dialog[open] .measure-card")).toHaveCount(3);
  await page.getByLabel("Направление", { exact: true }).selectOption("all");
  await expect(page.locator("dialog[open] .measure-card")).toHaveCount(14);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Оценить сценарий" }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

test("mobile screen has no horizontal overflow and rules explain current limits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Правила игры", exact: true }).click();
  await expect(page.locator("dialog[open]")).toContainText(
    "не более двух из одного направления",
  );
  await page.getByRole("button", { name: "Закрыть правила" }).click();
  await page.getByRole("button", { name: "Район Алматы", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Алматы", exact: true }),
  ).toBeVisible();
});

test("control scenario produces the reference score and persists edits", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Правила игры", exact: true }).click();
  await page.getByRole("button", { name: "Загрузить контрольный пример · 95 ед." }).click();
  await expect(page.locator(".count-pill")).toHaveText("5 / 5");
  await expect(page.locator(".budget-value")).toHaveText("5 / 100");
  await page.getByRole("button", { name: "Оценить сценарий" }).click();
  await expect(page.locator(".result-score strong")).toHaveText("56,54");
  await expect(page.locator(".result-breakdown")).toContainText("Критических значений0");
  await page.getByRole("button", { name: "Закрыть результат" }).click();
  await page.getByRole("button", { name: "Удалить M8" }).click();
  await expect(page.locator(".count-pill")).toHaveText("4 / 5");
  await expect(page.getByRole("button", { name: "Оценить сценарий" })).toBeDisabled();
  await page.reload();
  await expect(page.locator(".count-pill")).toHaveText("4 / 5");
  await expect(page.locator(".budget-value")).toHaveText("25 / 100");
  await page.getByRole("button", { name: "Прогноз", exact: true }).click();
  await expect(page.getByRole("region", { name: "Прогнозные показатели города" })).toContainText("Для Score нужно ещё 1 решений");
});

test("catalog blocks incompatible measures and overspending using shared validation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Изучить мероприятия", exact: true }).click();
  await page.getByRole("button", { name: "Добавить M3", exact: true }).click();
  await expect(page.getByRole("button", { name: "Добавить M1", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Добавить M3", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Добавить M5", exact: true }).click();
  await page.getByRole("button", { name: "Добавить M7", exact: true }).click();
  await page.getByRole("button", { name: "Добавить M6", exact: true }).click();
  await expect(page.locator(".district-picker")).toContainText("осталось 1 ед.");
  const safetyCard = page.locator("article").filter({ has: page.getByRole("button", { name: "Добавить M10", exact: true }) });
  await expect(safetyCard.getByRole("button")).toBeDisabled();
  await expect(safetyCard).toContainText("превышает бюджет");
});
