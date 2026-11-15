import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
export type RecipeMenu = {
  id: number;
  name: string;
  active: boolean;
  recipe: {
    quantity: Prisma.Decimal;
    ingredient: {
      id: number;
      name: string;
      unit: string;
      quantity: Prisma.Decimal;
    };
  }[];
};
export function calculatePlan(
  items: { menuId: number; portions: number }[],
  menus: RecipeMenu[],
) {
  if (new Set(items.map((i) => i.menuId)).size !== items.length)
    throw new BadRequestException("Duplicate menu in plan");
  const requirements = new Map<
    number,
    {
      ingredientId: number;
      name: string;
      unit: string;
      required: Prisma.Decimal;
      available: Prisma.Decimal;
    }
  >();
  const planned = items.map((item) => {
    const menu = menus.find((m) => m.id === item.menuId);
    if (!menu || !menu.active)
      throw new BadRequestException("Unknown or inactive menu: " + item.menuId);
    if (item.portions > 0 && !menu.recipe.length)
      throw new BadRequestException("Recipe is missing for menu: " + menu.name);
    for (const line of menu.recipe) {
      const i = line.ingredient;
      const current = requirements.get(i.id) ?? {
        ingredientId: i.id,
        name: i.name,
        unit: i.unit,
        required: new Prisma.Decimal(0),
        available: i.quantity,
      };
      current.required = current.required.plus(
        line.quantity.times(item.portions),
      );
      requirements.set(i.id, current);
    }
    return {
      ...item,
      name: menu.name,
      recipe: menu.recipe.map((l) => ({
        ingredientId: l.ingredient.id,
        name: l.ingredient.name,
        unit: l.ingredient.unit,
        quantityPerPortion: l.quantity.toNumber(),
      })),
    };
  });
  return {
    totalPortions: items.reduce((sum, i) => sum + i.portions, 0),
    items: planned,
    ingredients: [...requirements.values()].map((i) => ({
      ...i,
      required: i.required.toNumber(),
      available: i.available.toNumber(),
      shortage: Prisma.Decimal.max(0, i.required.minus(i.available)).toNumber(),
    })),
    stockConsumed: false,
    notice:
      "Approval records a plan only; it does not reserve or consume stock. Availability is a snapshot.",
  };
}
