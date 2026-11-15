import type { Food, StockItem, WasteRecord } from "../types";
// Illustration only: no database or ML inference is connected.
export const initialFoods: Food[] = [
  {
    id: 1,
    name: "Ayam Geprek Sambal Ijo",
    category: "Main course",
    price: 28000,
    forecast: 84,
    portions: 84,
    chicken: 0.15,
    rice: 0.1,
    emoji: "🍗",
  },
  {
    id: 2,
    name: "Nasi Goreng Kampung",
    category: "Main course",
    price: 25000,
    forecast: 62,
    portions: 62,
    chicken: 0.05,
    rice: 0.15,
    emoji: "🍛",
  },
  {
    id: 3,
    name: "Chicken Rice Bowl",
    category: "Rice bowl",
    price: 32000,
    forecast: 48,
    portions: 48,
    chicken: 0.12,
    rice: 0.1,
    emoji: "🥗",
  },
  {
    id: 4,
    name: "Mie Goreng Spesial",
    category: "Noodles",
    price: 26000,
    forecast: 36,
    portions: 36,
    chicken: 0.04,
    rice: 0,
    emoji: "🍜",
  },
];
export const initialStock: StockItem[] = [
  { name: "Daging ayam", category: "Protein", qty: 18, unit: "kg", min: 22 },
  {
    name: "Beras premium",
    category: "Dry goods",
    qty: 32,
    unit: "kg",
    min: 15,
  },
  { name: "Cabai hijau", category: "Sayuran", qty: 2.5, unit: "kg", min: 4 },
  {
    name: "Minyak goreng",
    category: "Dry goods",
    qty: 12,
    unit: "liter",
    min: 6,
  },
  { name: "Mie telur", category: "Dry goods", qty: 9, unit: "kg", min: 5 },
];
export const initialWastes: WasteRecord[] = [
  { name: "Nasi putih", qty: 1.2, reason: "Produksi berlebih" },
  { name: "Sayuran", qty: 0.8, reason: "Kualitas menurun" },
  { name: "Ayam", qty: 0.4, reason: "Sisa persiapan" },
];
