import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CircleAlert, Inbox } from "lucide-react";
import type { Urgency } from "../types";

export function Button({
  children,
  variant = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "yellow" | "link";
}) {
  return (
    <button
      type="button"
      className={`ek-button ${variant === "default" ? "" : "ek-" + variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export const urgencyLabels: Record<Urgency, string> = {
  critical: "Срочно",
  high: "На этой неделе",
  normal: "В норме",
  low: "Низкий",
  unknown: "Нужны данные",
};
export function RiskBadge({ urgency }: { urgency: Urgency }) {
  return (
    <span
      className={`ek-tag ek-${{ critical: "danger", high: "warn", normal: "ok", low: "quiet", unknown: "quiet" }[urgency]}`}
    >
      {urgencyLabels[urgency]}
    </span>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`ek-info ${error ? "ek-error" : ""}`}
      role={error ? "alert" : undefined}
    >
      <CircleAlert size={18} />
      <div>{children}</div>
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="ek-empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
