export type Page =
  | "Dashboard"
  | "Inventory"
  | "Menu & Resep"
  | "AI Forecasting"
  | "Kitchen Planner"
  | "Waste Analytics"
  | "Kelola Akun";
export type ModalType =
  "stock" | "menu" | "waste" | "recipe" | "edit-menu" | null;
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
  recipe?: {
    ingredientId: number;
    name: string;
    unit: string;
    quantity: number;
  }[];
};
export type StockItem = {
  id?: number;
  name: string;
  category: string;
  qty: number;
  unit: string;
  min: number;
};
export type WasteRecord = {
  unit?: string;
  name: string;
  qty: number;
  reason: string;
};
