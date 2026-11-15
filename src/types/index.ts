export type Page =
  | "Dashboard"
  | "Inventory"
  | "Menu & Resep"
  | "AI Forecasting"
  | "Kitchen Planner"
  | "Waste Analytics";
export type ModalType = "stock" | "menu" | "waste" | "recipe" | null;
export type Food = {
  id: number;
  name: string;
  category: string;
  price: number;
  forecast: number;
  portions: number;
  chicken: number;
  rice: number;
  emoji: string;
};
export type StockItem = {
  name: string;
  category: string;
  qty: number;
  unit: string;
  min: number;
};
export type WasteRecord = {
  name: string;
  qty: number;
  reason: string;
};
