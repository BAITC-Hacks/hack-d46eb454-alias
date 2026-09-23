import type { ReactNode } from "react";
import {
  Database,
  Files,
  FlaskConical,
  ListFilter,
} from "lucide-react";
import type { Design, Page } from "../types";

export const navigation = [
  { id: "data", label: "Данные", icon: Database },
  { id: "recommendations", label: "Рекомендации", icon: ListFilter },
  { id: "orders", label: "Заказы", icon: Files },
] satisfies { id: Page; label: string; icon: typeof Database }[];
const titles: Record<Page, [string, string, string]> = {
  overview: [
    "Рабочее пространство",
    "Сегодня в закупках",
    "Алматы · данные выбранного расчёта",
  ],
  recommendations: [
    "Планирование запасов",
    "Рекомендации закупок",
    "Сначала — позиции, которым скоро понадобится пополнение.",
  ],
  orders: [
    "Закупки по поставщикам",
    "Заказы поставщикам",
    "Проверьте количество и подтвердите готовый заказ.",
  ],
  data: [
    "Источники и качество",
    "Данные для расчёта",
    "Продажи, остатки и поставки — в одном рабочем пространстве.",
  ],
  catalog: [
    "Номенклатура",
    "Каталог товаров",
    "Состояние и обоснование каждой позиции.",
  ],
  suppliers: [
    "Условия пополнения",
    "Поставщики",
    "Сроки поставки и параметры планирования.",
  ],
};
function Brand() {
  return (
    <div className="ek-brand">
      <span className="ek-brandmark" aria-hidden="true" />
      ekt
      <small>
        закупки
        <br />и запасы
      </small>
    </div>
  );
}
interface Props {
  children: ReactNode;
  page: Page;
  design: Design;
  dense: boolean;
  onNavigate: (page: Page) => void;
  action: ReactNode;
  health: { status: "ok"; version: string } | null;
  dataOrigin: "synthetic" | "partner" | null;
}
export function AppShell({
  children,
  page,
  design,
  dense,
  onNavigate,
  action,
  health,
  dataOrigin,
}: Props) {
  return (
    <div id="ekt-atelier" data-direction={design} data-dense={dense}>
      <div className="ek-app">
        <aside className="ek-side">
          <Brand />
          <div className="ek-side-label">ЗАКУПКИ И ЗАПАСЫ</div>
          <nav aria-label="Боковое меню">
            {navigation.map((item) => (
              <button
                type="button"
                key={item.id}
                className={page === item.id ? "is-active" : ""}
                aria-current={page === item.id ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="ek-side-bottom">
            Электрокомплект
            <br />
            Алматы, Казахстан
            <br />
            Рабочее место закупщика
          </div>
        </aside>
        <header className="ek-header">
          <Brand />
          <nav className="ek-nav" aria-label="Разделы приложения">
            {navigation.map((item) => (
              <a
                key={item.id}
                href={`#/${item.id}`}
                className={page === item.id ? "is-active" : ""}
                aria-current={page === item.id ? "page" : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </header>
        <div className="ek-body">
          <main id="main-content" className="ek-main">
            <div className="ek-titlebar">
              <div>
                <div className="ek-focus-intro" />
                <div className="ek-kicker">{titles[page][0]}</div>
                <h1>{titles[page][1]}</h1>
                <p className="ek-subtitle">{titles[page][2]}</p>
              </div>
              <div className="ek-actions">{action}</div>
            </div>
            <div className="ek-demo-banner">
              <FlaskConical size={15} />
              <span>
                {dataOrigin === "synthetic" ? "Синтетические данные · расчёт на сервере" :
                  dataOrigin === "partner" ? "Локальные данные партнёра · расчёт на сервере" :
                    "Загрузите данные или запустите синтетический расчёт"}
                {health ? ` · API ${health.version}` : " · сервер недоступен"}
              </span>
            </div>
            {children}
            <footer className="ek-footer">
              <span>
                <FlaskConical size={13} />
                EKT · интерактивный frontend
              </span>
              <span>Алматы / 2026</span>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
