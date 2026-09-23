import { expect, test } from "@playwright/test";

test("Данные → расчёт API → заказ → правка → утверждение → CSV/XLSX → повторная правка", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/data");
  await expect(page.getByText(/API 0.1.0/)).toBeVisible();
  await page.getByRole("button", { name: "Открыть синтетический пример" }).click();
  await expect(page.getByRole("heading", { name: "Рекомендации закупок" })).toBeVisible();
  await expect(page.locator("tbody .ek-product")).toHaveCount(6);
  await page.getByLabel("Поиск по товарам").fill("FIX-BASE-001");
  await expect(page.locator("tbody .ek-product")).toHaveCount(1);
  await page.getByRole("button", { name: "Обоснование: FIX-BASE-001" }).click();
  await expect(page.getByRole("dialog")).toContainText("100 шт");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Открыть заказ" }).click();
  await expect(page.getByRole("heading", { name: "Заказы поставщикам" })).toBeVisible();
  await expect(page.locator(".ek-ordercard")).toHaveCount(3);
  const quantity = page.getByRole("spinbutton", { name: "Количество FIX-BASE-001" });
  await quantity.fill("60");
  await page.getByLabel("Причина изменения FIX-BASE-001").fill("Проектный заказ");
  await page.getByRole("button", { name: "Сохранить строку" }).click();
  await expect(quantity).toHaveValue("60");
  await page.getByRole("button", { name: "Подтвердить весь расчёт" }).click();
  await expect(page.getByRole("dialog")).toContainText("всех 3 поставщиков");
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(page.getByRole("button", { name: "Скачать заказ CSV" })).toBeVisible();
  const csvEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать заказ CSV" }).click();
  const csv = await csvEvent;
  const stream = await csv.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString("utf8")).toMatch(/;60(?:\.0)?;/);
  const xlsxEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать заказ XLSX" }).click();
  expect((await xlsxEvent).suggestedFilename()).toMatch(/\.xlsx$/);
  await page.reload();
  await expect(quantity).toHaveValue("60");
  await quantity.fill("0");
  await page.getByLabel("Причина изменения FIX-BASE-001").fill("Не требуется");
  await page.getByRole("button", { name: "Сохранить строку" }).click();
  await expect(page.getByText("Нужно повторное подтверждение").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Скачать заказ CSV" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Реальный архив проходит preview и commit через backend; отсутствие текущего остатка видно", async ({ page }) => {
  test.skip(!process.env.IEK_ARCHIVE_PATH, "Set IEK_ARCHIVE_PATH to the local partner ZIP to run this private-data check");
  await page.goto("/#/data");
  await page.locator("input[type=file]").setInputFiles(process.env.IEK_ARCHIVE_PATH!);
  await page.getByRole("button", { name: "Проверить файлы" }).click();
  await expect(page.getByText("Проверено файлов: 6")).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(/current_available_stock/)).toBeVisible();
  await page.getByRole("button", { name: "Сохранить набор и рассчитать" }).click();
  await expect(page.getByRole("heading", { name: "Рекомендации закупок" })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText(/Нет артикулов с историей продаж и актуальным остатком/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Открыть заказ" })).toBeDisabled();
});

test("Основные экраны читаемы на ноутбуке и телефоне", async ({ page }) => {
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["data", "recommendations", "orders"]) {
      await page.goto(`/#/${route}`);
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});
