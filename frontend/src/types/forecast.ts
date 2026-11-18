export type ForecastMetric = { mae: number; wape: number | null };
export type ForecastResult = {
  targetDate: string; version: string; dataHash: string; windowStart: string; windowEnd: string;
  status: "READY" | "PARTIAL" | "INSUFFICIENT_DATA";
  items: {
    menuId: number; name: string; status: "READY" | "INSUFFICIENT_DATA"; reason?: string;
    quantity: number | null; observations: number; missingDays: number; excludedDays: number;
    warnings: string[]; method: "random_forest" | "weekday_mean" | null;
    evaluation: {
      baseline: ForecastMetric; randomForest: ForecastMetric;
      trainCount: number; testCount: number; testStart: string; testEnd: string; protocol: string;
    } | null;
  }[];
};
export type Sale = { menuId: number; businessDate: string; quantity: number; closed: boolean; stockout: boolean; menu: { name: string } };
export function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}
export function tomorrowDate() {
  const date = new Date(jakartaToday() + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
