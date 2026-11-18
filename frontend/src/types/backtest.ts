export type ModelKey = "baseline" | "randomForest" | "selected";
export type BacktestScore = { mae: number; wape: number | null; bias: number };
export type SkipReason = "MISSING_ACTUAL" | "CLOSED" | "STOCKOUT" | "INSUFFICIENT_HISTORY" | "STALE_HISTORY";
export type BacktestSummary = {
  scored: number;
  expected: number;
  skipped: Partial<Record<SkipReason, number>>;
  scores: Record<ModelKey, BacktestScore> | null;
};

type Day = { date: string; historyCount: number; lastHistoryDate: string | null; actual: number | null };
export type BacktestDay = Day & (
  | { status: SkipReason }
  | {
    status: "SCORED";
    actual: number;
    baseline: number;
    randomForest: number;
    selected: number;
    selectedMethod: "random_forest" | "weekday_mean";
  }
);

export type BacktestResult = {
  protocol: string;
  modelVersion: string;
  startDate: string;
  endDate: string;
  summary: BacktestSummary;
  menus: { menuId: number; name: string; summary: BacktestSummary; days: BacktestDay[] }[];
};

export type BacktestRun = {
  id: number;
  protocol: string;
  sourceHash: string;
  startDate: string;
  endDate: string;
  menuCount: number;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  attempts: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};
export type BacktestDetail = BacktestRun & { result: BacktestResult | null };
