import type { Food, StockItem } from "../types";
export type RecipeDraft = { ingredientId: string; quantity: string };
export type MenuEdit = {
  name: string;
  category: string;
  price: number;
  emoji: string;
  lines: { ingredientId: number; quantity: number }[];
};
export function stockId(stock: StockItem, index: number) {
  return stock.id ?? index + 1;
}
export function recipeDraft(food: Food, stock: StockItem[]): RecipeDraft[] {
  if (food.recipe)
    return food.recipe.map((l) => ({
      ingredientId: String(l.ingredientId),
      quantity: String(l.quantity),
    }));
  return stock.flatMap((s, i) => {
    const quantity =
      s.name === "Daging ayam"
        ? food.chicken
        : s.name === "Beras premium"
          ? food.rice
          : 0;
    return quantity > 0
      ? [{ ingredientId: String(stockId(s, i)), quantity: String(quantity) }]
      : [];
  });
}
export function validateMenuEdit(
  name: string,
  category: string,
  price: string,
  rows: RecipeDraft[],
  stock: StockItem[],
): MenuEdit {
  if (!name.trim() || name.trim().length > 100)
    throw Error("Nama menu wajib diisi, maksimal 100 karakter.");
  if (!category.trim() || category.trim().length > 60)
    throw Error("Kategori wajib diisi, maksimal 60 karakter.");
  const amount = Number(price);
  if (
    !price.trim() ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 100000000 ||
    !/^[0-9]+(?:\.[0-9]{1,2})?$/.test(price)
  )
    throw Error("Harga harus angka positif atau nol, maksimal 2 desimal.");
  if (rows.length > 100) throw Error("Maksimal 100 bahan per resep.");
  const seen = new Set<number>();
  const lines = rows.map((row) => {
    const id = Number(row.ingredientId);
    if (!stock.some((s, i) => stockId(s, i) === id))
      throw Error("Pilih bahan inventory yang valid.");
    if (seen.has(id))
      throw Error("Bahan yang sama tidak boleh ditambahkan dua kali.");
    seen.add(id);
    const quantity = Number(row.quantity);
    if (
      !row.quantity.trim() ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 1000000 ||
      !/^[0-9]+(?:\.[0-9]{1,6})?$/.test(row.quantity)
    )
      throw Error("Jumlah bahan harus lebih dari nol, maksimal 6 desimal.");
    return { ingredientId: id, quantity };
  });
  return {
    name: name.trim(),
    category: category.trim(),
    price: amount,
    emoji: "",
    lines,
  };
}
export function applyMenuEdit(
  food: Food,
  edit: MenuEdit,
  stock: StockItem[],
): Food {
  const recipe = edit.lines.map((l) => {
    const ingredient = stock.find((s, i) => stockId(s, i) === l.ingredientId)!;
    return { ...l, name: ingredient.name, unit: ingredient.unit };
  });
  return {
    ...food,
    name: edit.name,
    category: edit.category,
    price: edit.price,
    recipe,
    chicken: recipe.find((l) => l.name === "Daging ayam")?.quantity ?? 0,
    rice: recipe.find((l) => l.name === "Beras premium")?.quantity ?? 0,
  };
}
