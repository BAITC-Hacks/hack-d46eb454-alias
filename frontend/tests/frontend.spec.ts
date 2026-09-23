import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";

function syntheticWorkbook(withStock = false, count = 1) {
  const headers = ["Дата продажи", "Номер документа", "Тип документа", "Код товара", "Наименование товара", "Ед. изм.", "Склад", "Кол-во"];
  const row: (string | number)[] = ["2026-09-22", "SYN-1", "Расходная накладная", "TEST-001", "Синтетический товар", "шт", "Алматы", 90];
  if (withStock) {
    headers.push("Текущий остаток", "Дата остатка", "MOQ", "Категория");
    row.push(0, "2026-09-23", 5, "Тест");
  }
  const rows = Array.from({length: count}, (_, index) => {
    const next = [...row];
    const suffix = String(index + 1).padStart(3, "0");
    next[1] = `SYN-${suffix}`; next[3] = `TEST-${suffix}`;
    if (count > 1) next[4] = `Синтетический товар ${suffix}`;
    return next;
  });
  return execFileSync(new URL("../../.venv/bin/python", import.meta.url).pathname, ["-c", "import json,sys; from io import BytesIO; from openpyxl import Workbook; w=Workbook(); s=w.active; [s.append(r) for r in json.loads(sys.argv[1])]; b=BytesIO(); w.save(b); sys.stdout.buffer.write(b.getvalue())", JSON.stringify([headers, ...rows])]);
}

test("Отчёт импорта появляется после расчёта только на Данных и сбрасывается при обновлении", async ({ page }) => {
  await page.goto("/#/data");
  await page.locator("input[type=file]").setInputFiles({ name: "синтетические-продажи.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: syntheticWorkbook() });
  await page.getByRole("button", { name: "Проверить файлы" }).click();
  await expect(page.getByText("Проверено файлов: 1")).toBeVisible();
  const report = page.getByRole("region", { name: "Отчёт после расчёта" });
  await expect(report).toHaveCount(0);
  await page.getByLabel("Дата расчёта", { exact: true }).fill("2026-09-23");
  await page.getByRole("button", { name: "Сохранить набор и рассчитать" }).click();
  await expect(report).toContainText("Текущий остаток не предоставлен");
  await expect(report).toContainText("Рассчитано позиций: 1");
  await expect(page).toHaveURL(/#\/data$/);
  for (const link of ["Закупки", "Заказы"]) {
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(report).not.toBeVisible();
    await expect(page.getByText(/Текущий остаток не предоставлен/)).not.toBeVisible();
  }
  await page.getByRole("link", { name: "Данные", exact: true }).click();
  await expect(report).toBeVisible();
  await page.reload();
  await expect(report).toHaveCount(0);
  await expect(page.getByText(/Текущий остаток не предоставлен/)).toHaveCount(0);
});

test("Общая таблица действительно рассчитывается сервером", async ({ page }) => {
  await page.goto("/#/data");
  await page.locator("input[type=file]").setInputFiles({ name: "синтетическая-общая.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: syntheticWorkbook(true) });
  await page.getByRole("button", { name: "Проверить файлы" }).click();
  await expect(page.getByText("Проверено файлов: 1")).toBeVisible();
  await page.getByLabel("Дата расчёта", { exact: true }).fill("2026-09-23");
  await page.getByRole("button", { name: "Сохранить набор и рассчитать" }).click();
  await expect(page.getByRole("region", { name: "Отчёт после расчёта" })).toContainText("Рассчитано позиций: 1");
  await page.getByRole("button", { name: "Посмотреть рекомендации" }).click();
  await expect(page.locator("tbody .ek-product")).toHaveCount(1);
  await expect(page.locator("tbody .ek-product")).toContainText("TEST-001");
  await expect(page.getByRole("region", { name: "Отчёт после расчёта" })).not.toBeVisible();
});

test("Данные → расчёт API → заказ → правка → утверждение → CSV/XLSX → повторная правка", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/data");
  await expect(page.getByText(/API 0.1.0/)).toBeVisible();
  await expect(page.getByRole("button", { name: /оформлен/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Обзор" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Товары" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Поставщики" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Открыть синтетический пример" })).toHaveCount(0);
  await page.locator("input[type=file]").setInputFiles({ name: "тест-заказа.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: syntheticWorkbook(true) });
  await page.getByRole("button", { name: "Проверить файлы" }).click();
  await expect(page.getByText("Проверено файлов: 1")).toBeVisible();
  await page.getByLabel("Дата расчёта", { exact: true }).fill("2026-09-23");
  await page.getByRole("button", { name: "Сохранить набор и рассчитать" }).click();
  await page.getByRole("button", { name: "Посмотреть рекомендации" }).click();
  await expect(page.getByRole("heading", { name: "Рекомендации закупок" })).toBeVisible();
  await expect(page.locator("tbody .ek-product")).toHaveCount(1);
  await page.getByLabel("Поиск по товарам").fill("TEST-001");
  await expect(page.locator("tbody .ek-product")).toHaveCount(1);
  await page.getByRole("button", { name: "Обоснование: Синтетический товар" }).click();
  await expect(page.getByRole("dialog")).toContainText("Прогноз спроса");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Открыть заказ" }).click();
  await expect(page.getByRole("heading", { name: "Заказы поставщикам" })).toBeVisible();
  await expect(page.locator(".ek-ordercard")).toHaveCount(1);
  const quantity = page.getByRole("spinbutton", { name: "Количество Синтетический товар" });
  await quantity.fill("60");
  await page.getByLabel("Причина изменения Синтетический товар").fill("Проектный заказ");
  await page.getByRole("button", { name: "Сохранить строку" }).click();
  await expect(quantity).toHaveValue("60");
  await page.getByRole("button", { name: "Подтвердить весь расчёт" }).click();
  await expect(page.getByRole("dialog")).toContainText("всех 1 поставщиков");
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
  await page.getByLabel("Причина изменения Синтетический товар").fill("Не требуется");
  await page.getByRole("button", { name: "Сохранить строку" }).click();
  await expect(page.getByText("Нужно повторное подтверждение").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Скачать заказ CSV" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Реальные ф1–ф6 дают прогноз и предварительный план", async ({ page }) => {
  test.setTimeout(180000);
  test.skip(!process.env.IEK_FILES_DIR, "Set IEK_FILES_DIR to run this private-data check");
  await page.goto("/#/data");
  await page.locator("input[type=file]").setInputFiles(Array.from({length: 6}, (_, i) => `${process.env.IEK_FILES_DIR}/ф${i + 1}.xlsx`));
  await page.getByRole("button", { name: "Проверить файлы" }).click();
  await expect(page.getByText("Проверено файлов: 6")).toBeVisible({ timeout: 60000 });
  await page.getByLabel("Дата расчёта", { exact: true }).fill("2026-09-23");
  await page.getByRole("button", { name: "Сохранить набор и рассчитать" }).click();
  await expect(page.getByRole("heading", { name: "Данные для расчёта" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Отчёт после расчёта" })).toContainText("Рассчитано позиций: 1472", { timeout: 30000 });
  await page.getByRole("button", { name: "Посмотреть рекомендации" }).click();
  await expect(page.locator("tbody .ek-product")).toHaveCount(20);
  await expect(page.getByRole("navigation", {name: "Страницы закупок сверху"})).toContainText("из 1472");
  await expect(page.getByRole("columnheader", {name: "Прогноз спроса"})).toBeVisible();
  await page.getByRole("link", {name: "Данные", exact: true}).click();
  await page.getByRole("checkbox", { name: /Предварительный план/ }).check();
  await page.getByRole("button", { name: "Сохранить набор и рассчитать" }).click();
  await expect(page.getByRole("region", { name: "Отчёт после расчёта" })).toContainText("рассчитан предварительный план", { timeout: 30000 });
  await page.getByRole("button", { name: "Посмотреть рекомендации" }).click();
  await expect(page.getByText("предварительно", {exact: true}).first()).toBeVisible();
});

test("Пагинация 10/20/50, фильтры, правка на второй странице и экспорт полного заказа", async ({ page }) => {
  await page.goto("/#/data");
  await page.locator("input[type=file]").setInputFiles({ name: "pagination-test.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: syntheticWorkbook(true, 53) });
  await page.getByRole("button", {name: "Проверить файлы"}).click();
  await expect(page.getByText("Проверено файлов: 1")).toBeVisible();
  await page.getByLabel("Дата расчёта", {exact: true}).fill("2026-09-23");
  await page.getByRole("button", {name: "Сохранить набор и рассчитать"}).click();
  await page.getByRole("button", {name: "Посмотреть рекомендации"}).click();
  const purchases = page.getByRole("navigation", {name: "Страницы закупок сверху"});
  const products = page.locator("tbody .ek-product");
  await expect(products).toHaveCount(20);
  await expect(purchases).toContainText("1–20 из 53");
  await purchases.getByRole("button", {name: "Страница 3", exact: true}).click();
  await expect(products).toHaveCount(13);
  await expect(products.first()).toContainText("TEST-041");
  await purchases.getByLabel("Позиций на странице").selectOption("10");
  await expect(products).toHaveCount(10);
  await expect(purchases).toContainText("Страница 1 из 6");
  await purchases.getByRole("button", {name: "Страница 6", exact: true}).click();
  await expect(products).toHaveCount(3);
  await page.getByLabel("Поиск по товарам").fill("TEST-053");
  await expect(products).toHaveCount(1);
  await expect(purchases).toContainText("Страница 1 из 1");
  await page.getByLabel("Поиск по товарам").fill("не найдено");
  await expect(products).toHaveCount(0);
  await expect(purchases).toContainText("0–0 из 0");
  await expect(purchases.getByRole("button", {name: "Далее"})).toBeDisabled();
  await page.getByLabel("Поиск по товарам").fill("");
  await purchases.getByLabel("Позиций на странице").selectOption("50");
  await expect(products).toHaveCount(50);
  await page.getByRole("button", {name: "Открыть заказ", exact: true}).click();
  const orderPages = page.getByRole("navigation", {name: "Страницы позиций заказа сверху"});
  const lines = page.locator(".ek-orderline-form");
  await expect(lines).toHaveCount(20);
  await orderPages.getByRole("button", {name: "Далее"}).click();
  await expect(orderPages).toContainText("21–40 из 53");
  const quantity = page.getByRole("spinbutton", {name: "Количество Синтетический товар 021", exact: true});
  await quantity.fill("60");
  await page.getByLabel("Причина изменения Синтетический товар 021", {exact: true}).fill("Проверка второй страницы");
  await expect(orderPages.getByRole("button", {name: "Назад"})).toBeDisabled();
  await expect(orderPages.getByLabel("Позиций на странице")).toBeDisabled();
  await page.getByRole("button", {name: "Сохранить строку"}).click();
  await expect(orderPages.getByRole("button", {name: "Назад"})).toBeEnabled();
  await orderPages.getByRole("button", {name: "Назад"}).click();
  await orderPages.getByRole("button", {name: "Далее"}).click();
  await expect(quantity).toHaveValue("60");
  await orderPages.getByRole("button", {name: "Страница 3", exact: true}).click();
  await expect(lines).toHaveCount(13);
  await orderPages.getByLabel("Позиций на странице").selectOption("10");
  await expect(lines).toHaveCount(10);
  await orderPages.getByLabel("Позиций на странице").selectOption("50");
  await expect(lines).toHaveCount(50);
  await page.setViewportSize({width: 375, height: 900});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({width: 1440, height: 1050});
  await page.getByRole("button", {name: "Подтвердить весь расчёт", exact: true}).click();
  await page.getByRole("button", {name: "Подтвердить", exact: true}).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", {name: "Скачать заказ CSV"}).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv.trim().split(/\r?\n/)).toHaveLength(54);
  expect(csv).toContain("TEST-053");
  expect(csv).toMatch(/TEST-021;[^\n]*;60(?:\.0)?;/);
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
