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
