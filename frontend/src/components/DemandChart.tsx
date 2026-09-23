import { useId, useState } from "react";
import type { DemandPoint } from "../types";

export function DemandChart({
  series,
  unit,
}: {
  series: DemandPoint[];
  unit: string;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const labelId = useId();
  const fields = [
    "adjusted_demand_qty",
    "forecast_qty",
    ...(showRaw ? ["observed_sales_qty"] : []),
  ] as const;
  const maximum = Math.max(
    1,
    ...series.flatMap((p) =>
      fields
        .map((f) => p[f as keyof DemandPoint])
        .filter((v): v is number => typeof v === "number"),
    ),
  );
  const ceiling = Math.ceil(maximum / 20) * 20;
  const x = (index: number) =>
    42 + (index / Math.max(1, series.length - 1)) * 394;
  const y = (value: number) => 164 - (value / ceiling) * 140;
  const path = (
    key: "adjusted_demand_qty" | "forecast_qty" | "observed_sales_qty",
  ) => {
    let drawing = false;
    return series
      .map((point, index) => {
        const value = point[key];
        if (value === null) {
          drawing = false;
          return "";
        }
        const command = drawing ? "L" : "M";
        drawing = true;
        return `${command}${x(index)},${y(value)}`;
      })
      .join(" ");
  };
  return (
    <div className="ek-demandchart">
      <svg viewBox="0 0 458 205" role="img" aria-labelledby={labelId}>
        <title id={labelId}>
          Синтетический пример спроса по месяцам, {unit}. Сентябрь и октябрь —
          прогноз.
        </title>
        {[0, ceiling / 2, ceiling].map((value) => (
          <g key={value}>
            <line
              x1="42"
              x2="436"
              y1={y(value)}
              y2={y(value)}
              stroke="var(--ekt-line)"
            />
            <text x="34" y={y(value) + 4} textAnchor="end">
              {value}
            </text>
          </g>
        ))}
        <path
          d={path("adjusted_demand_qty")}
          stroke="var(--ekt-blue)"
          fill="none"
          strokeWidth="2.5"
        />
        <path
          d={path("forecast_qty")}
          stroke="var(--ekt-yellow)"
          fill="none"
          strokeWidth="2.5"
          strokeDasharray="5 4"
        />
        {showRaw && (
          <path
            d={path("observed_sales_qty")}
            stroke="#9ba8b0"
            fill="none"
            strokeWidth="1.5"
          />
        )}
        {series.map((point, i) => (
          <g key={point.date}>
            <text x={x(i)} y="190" textAnchor="middle">
              {new Intl.DateTimeFormat("ru", { month: "short" }).format(
                new Date(point.date + "T12:00:00"),
              )}
            </text>
            <circle
              cx={x(i)}
              cy={y(point.adjusted_demand_qty ?? point.forecast_qty ?? 0)}
              r="3"
              fill={
                point.forecast_qty === null
                  ? "var(--ekt-blue)"
                  : "var(--ekt-yellow)"
              }
            >
              <title>
                {point.date}: {point.adjusted_demand_qty ?? point.forecast_qty}{" "}
                {unit}
              </title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="ek-chart-head">
        <span className="ek-key">Очищенный спрос, {unit}</span>
        <span className="ek-key ek-forecast">Прогноз</span>
        <label className="ek-chart-toggle">
          <input
            type="checkbox"
            checked={showRaw}
            onChange={(e) => setShowRaw(e.target.checked)}
          />
          Сырые продажи
        </label>
      </div>
    </div>
  );
}
