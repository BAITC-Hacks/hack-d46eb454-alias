/** Защита текстовых ячеек от формул Excel, включая начальные пробелы. */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  const safe =
    /^[\s]*[=+@-]/u.test(value) || /^[\t\r\n]/u.test(value)
      ? "'" + value
      : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function makeCsv(rows: (string | number | null)[][]): string {
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
export function downloadCsv(
  filename: string,
  rows: (string | number | null)[][],
): void {
  const url = URL.createObjectURL(
    new Blob([makeCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
