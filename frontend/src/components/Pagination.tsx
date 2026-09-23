import { pageSizes } from "../lib/pagination";
import { Button } from "./ui";

interface Props {
  label: string;
  page: number;
  pages: number;
  size: number;
  total: number;
  start: number;
  end: number;
  disabled?: boolean;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}

export function Pagination({ label, page, pages, size, total, start, end, disabled, onPage, onSize }: Props) {
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  return <nav className="ek-pagination" aria-label={label}>
    <span className="ek-small" aria-live="polite">{total ? start + 1 : 0}–{end} из {total} · Страница {page} из {pages}</span>
    <label className="ek-page-size">На странице
      <select className="ek-select" aria-label="Позиций на странице" value={size} disabled={disabled} onChange={e => onSize(Number(e.target.value))}>
        {pageSizes.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
    <div className="ek-page-buttons">
      <Button disabled={disabled || page === 1} onClick={() => onPage(page - 1)}>Назад</Button>
      {numbers.map((n, i) => <span className="ek-page-number" key={n}>
        {i > 0 && n - numbers[i - 1] > 1 && <span aria-hidden="true">…</span>}
        <Button variant={n === page ? "primary" : "default"} aria-label={`Страница ${n}`} aria-current={n === page ? "page" : undefined} disabled={disabled || !total} onClick={() => onPage(n)}>{n}</Button>
      </span>)}
      <Button disabled={disabled || page === pages} onClick={() => onPage(page + 1)}>Далее</Button>
    </div>
  </nav>;
}
