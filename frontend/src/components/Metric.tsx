import type { ReactNode } from "react";
export function Metric({
  title,
  value,
  unit,
  note,
  icon,
  amber = false,
}: {
  title: string;
  value: string;
  unit: string;
  note: string;
  icon: ReactNode;
  amber?: boolean;
}) {
  return (
    <section className="metric card">
      <div className="metric-top">
        <span>{title}</span>
        <span className={"metric-icon " + (amber ? "warn" : "")}>{icon}</span>
      </div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>
        <span className={amber ? "dot amber-dot" : "dot"} />
        {note}
      </p>
    </section>
  );
}
