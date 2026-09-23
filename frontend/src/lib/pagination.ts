import { useEffect, useState } from "react";

export const pageSizes = [10, 20, 50] as const;

export function pageBounds(total: number, size: number, requested: number) {
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(pages, Math.max(1, requested));
  const start = (page - 1) * size;
  return { page, pages, start, end: Math.min(total, start + size) };
}

export function usePagination<T>(rows: T[], resetKey: string) {
  const [size, setSize] = useState(20);
  const [position, setPosition] = useState({ key: resetKey, page: 1 });
  useEffect(() => { setPosition({ key: resetKey, page: 1 }); }, [resetKey]);
  const bounds = pageBounds(rows.length, size, position.key === resetKey ? position.page : 1);
  return {
    ...bounds, size, total: rows.length, rows: rows.slice(bounds.start, bounds.end),
    onPage: (page: number) => setPosition({ key: resetKey, page }),
    onSize: (next: number) => {
      if (!pageSizes.some(size => size === next)) return;
      setSize(next);
      setPosition({ key: resetKey, page: 1 });
    },
  };
}
