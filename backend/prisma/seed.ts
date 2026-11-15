import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const ingredients = [
    {
      name: "Daging ayam",
      category: "Protein",
      unit: "kg",
      minimum: 22,
      opening: 18,
    },
    {
      name: "Beras premium",
      category: "Dry goods",
      unit: "kg",
      minimum: 15,
      opening: 32,
    },
    {
      name: "Cabai hijau",
      category: "Sayuran",
      unit: "kg",
      minimum: 4,
      opening: 2.5,
    },
    {
      name: "Minyak goreng",
      category: "Dry goods",
      unit: "liter",
      minimum: 6,
      opening: 12,
    },
    {
      name: "Mie telur",
      category: "Dry goods",
      unit: "kg",
      minimum: 5,
      opening: 9,
    },
  ];
  const ids: number[] = [];
  for (const i of ingredients) {
    const item = await db.ingredient.upsert({
      where: { name: i.name },
      update: {},
      create: {
        name: i.name,
        category: i.category,
        unit: i.unit,
        minimum: i.minimum,
      },
    });
    ids.push(item.id);
    await db.$transaction(async (tx) => {
      const key = "seed-opening-" + item.id;
      if (await tx.stockMovement.findUnique({ where: { idempotencyKey: key } }))
        return;
      await tx.stockMovement.create({
        data: {
          ingredientId: item.id,
          quantity: i.opening,
          reason: "Demo opening balance",
          idempotencyKey: key,
        },
      });
      await tx.ingredient.update({
        where: { id: item.id },
        data: { quantity: { increment: i.opening } },
      });
    });
  }
  const menus = [
    {
      name: "Ayam Geprek Sambal Ijo",
      category: "Main course",
      price: 28000,
      emoji: "🍗",
      chicken: 0.15,
      rice: 0.1,
    },
    {
      name: "Nasi Goreng Kampung",
      category: "Main course",
      price: 25000,
      emoji: "🍛",
      chicken: 0.05,
      rice: 0.15,
    },
    {
      name: "Chicken Rice Bowl",
      category: "Rice bowl",
      price: 32000,
      emoji: "🥗",
      chicken: 0.12,
      rice: 0.1,
    },
    {
      name: "Mie Goreng Spesial",
      category: "Noodles",
      price: 26000,
      emoji: "🍜",
      chicken: 0.04,
      rice: 0,
    },
  ];
  for (const m of menus) {
    await db.menuItem.upsert({
      where: { name: m.name },
      update: {},
      create: {
        name: m.name,
        category: m.category,
        price: m.price,
        emoji: m.emoji,
        recipe: {
          create: [
            { ingredientId: ids[0], quantity: new Prisma.Decimal(m.chicken) },
            ...(m.rice
              ? [{ ingredientId: ids[1], quantity: new Prisma.Decimal(m.rice) }]
              : []),
          ],
        },
      },
    });
  }
  console.log(
    "Demo seed ready. Recipes only include chicken/rice and are incomplete for real operations. Existing data was not overwritten.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
