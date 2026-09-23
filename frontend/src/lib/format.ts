export const formatNumber = (value: number | null | undefined): string =>
  value == null
    ? "—"
    : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 }).format(
        value,
      );
export const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Almaty",
  }).format(new Date(value.length === 10 ? value + "T12:00:00+05:00" : value));
