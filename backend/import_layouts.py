"""Explicit header aliases and streaming views of supported procurement tables."""

import re
import unicodedata


def normalize(value):
    text = unicodedata.normalize("NFKC", str(value or "")).casefold().replace("ё", "е")
    return re.sub(r"[\W_]+", "", text)


ALIASES = {
    "code": ("Код", "Код 1С", "Номенклатура.Код", "Код товара", "Внутренний код", "sku"),
    "name": ("Номенклатура", "Наименование", "Наименование товара", "Название товара", "Товар"),
    "unit": ("Ед.", "Ед. изм.", "Единица", "Единица измерения", "unit"),
    "warehouse": ("Склад", "Наименование склада", "warehouse"),
    "date": ("Дата", "Дата операции", "Дата продажи", "sale_date"),
    "document": ("Документ", "Тип документа", "Вид документа", "Тип операции"),
    "number": ("Номер", "Номер документа", "Документ номер"),
    "quantity": ("Количество", "Кол-во", "Количество продаж", "Продано", "Продажи, шт", "sales_quantity"),
    "customer": ("customer_id", "Обезличенный ID клиента", "Обезличенный клиент"),
    "stock": ("Остаток", "Текущий остаток", "Доступный остаток", "Остаток на дату", "available_stock"),
    "stock_date": ("Дата остатка", "Дата снимка", "Дата среза", "На дату", "stock_date"),
    "category": ("Категория", "Категория товара", "Товарная категория", "category"),
    "moq": ("Мин. разр. к отгр.", "MOQ", "Минимальная партия", "Минимальный заказ", "Мин. партия"),
    "article": ("Артикул поставщика", "Артикул ИЭК", "supplier_article"),
    "arrival_qty": ("В пути", "Количество в пути", "Количество поставки", "Ожидаемое поступление", "inbound_quantity"),
    "arrival_date": ("Дата поступления", "Ожидаемая дата поступления", "Дата поставки", "expected_date"),
    "arrival_doc": ("Документ поставки", "Номер поставки", "inbound_document"),
    "start": ("Начало", "Начало отсутствия", "Дата начала отсутствия", "stockout_start"),
    "end": ("Конец", "Конец отсутствия", "Дата окончания отсутствия", "stockout_end"),
}
LOOKUP = {normalize(alias): field for field, aliases in ALIASES.items() for alias in aliases}


def find_header(sheet):
    """Only a header with an explicit product key is eligible, never a filename."""
    for row_no, row in enumerate(sheet.iter_rows(max_row=min(30, sheet.max_row), values_only=True), 1):
        fields = {}
        duplicates = set()
        for index, value in enumerate(row):
            field = LOOKUP.get(normalize(value))
            if field:
                if field in fields:
                    duplicates.add(field)
                fields[field] = index
        if "code" in fields:
            return row_no, row, fields, duplicates
    return None


class TableView:
    """Present mapped columns to legacy adapters, retaining original row numbers."""

    def __init__(self, sheet, header_row, headers, indexes, defaults=None):
        self.sheet = sheet
        self.title = sheet.title
        self.max_row = sheet.max_row
        self.header_row = header_row
        self.headers = tuple(headers)
        self.indexes = indexes
        self.defaults = defaults or {}

    def iter_rows(self, min_row=1, max_row=None, values_only=True):
        end = max_row or self.max_row
        if min_row == 1:
            yield self.headers
        if end < 2:
            return
        for row_no, row in enumerate(self.sheet.iter_rows(min_row=max(2, min_row), max_row=end, values_only=True), max(2, min_row)):
            if row_no <= self.header_row:
                yield (None,) * len(self.headers)
            else:
                yield tuple(row[index] if index is not None and index < len(row) else self.defaults.get(i)
                            for i, index in enumerate(self.indexes))


def flat_views(sheet, header):
    """One source row may supply multiple facts with independent dates/quantities."""
    row_no, raw, fields, _ = header
    views = []
    def add(kind, names, keys, defaults=None):
        views.append((kind, TableView(sheet, row_no, names, [fields.get(k) for k in keys], defaults)))

    is_sale = {"date", "quantity", "document", "name", "unit", "warehouse"} <= fields.keys()
    if is_sale:
        add("sales_detail", ["Дата", "Номер", "Документ", "Код", "Номенклатура", "Ед.", "Склад", "Количество", "customer_id"],
            ["date", "number", "document", "code", "name", "unit", "warehouse", "quantity", "customer"])
    if "stock" in fields and "warehouse" in fields and ("stock_date" in fields or ("date" in fields and not is_sale)):
        add("current_stock", ["Код", "Остаток", "Дата", "Склад", "Ед."],
            ["code", "stock", "stock_date" if "stock_date" in fields else "date", "warehouse", "unit"])
    if "moq" in fields:
        add("moq", ["№", "Код 1с", "Артикул поставщика", "Наименование", "Мин. разр. к отгр."],
            ["_none", "code", "article", "name", "moq"])
    if "category" in fields:
        add("categories", ["Код", "Категория"], ["code", "category"])
    if {"start", "end"} <= fields.keys():
        add("stockouts", ["Код", "Начало", "Конец", "Склад"], ["code", "start", "end", "warehouse"])
    if {"arrival_qty", "arrival_date"} <= fields.keys():
        add("inbound_rows", ["Код", "Количество", "Дата", "Документ", "Артикул", "Ед.", "Склад"],
            ["code", "arrival_qty", "arrival_date", "arrival_doc", "article", "unit", "warehouse"])
    return views
