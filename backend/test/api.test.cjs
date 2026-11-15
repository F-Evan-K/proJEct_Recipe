require("dotenv/config");
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { Test } = require("@nestjs/testing");
const { AppModule, configureApp } = require("../dist/app");
const { PrismaService } = require("../dist/prisma.service");
const { Prisma } = require("@prisma/client");
const { calculatePlan } = require("../dist/planner/calculate");
test("decimal recipe aggregation and shared ingredient shortage", () => {
  const ingredient = {
    id: 1,
    name: "Chicken",
    unit: "kg",
    quantity: new Prisma.Decimal("4.5"),
  };
  const result = calculatePlan(
    [
      { menuId: 1, portions: 30 },
      { menuId: 2, portions: 20 },
    ],
    [
      {
        id: 1,
        name: "A",
        active: true,
        recipe: [{ quantity: new Prisma.Decimal("0.1"), ingredient }],
      },
      {
        id: 2,
        name: "B",
        active: true,
        recipe: [{ quantity: new Prisma.Decimal("0.15"), ingredient }],
      },
    ],
  );
  assert.equal(result.ingredients[0].required, 6);
  assert.equal(result.ingredients[0].shortage, 1.5);
  assert.throws(
    () =>
      calculatePlan(
        [
          { menuId: 1, portions: 1 },
          { menuId: 1, portions: 2 },
        ],
        [],
      ),
    /Duplicate/,
  );
});
test("real MySQL API lifecycle, validation, idempotency, and persistence", async (t) => {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = module.createNestApplication();
  configureApp(app);
  await app.init();
  const db = app.get(PrismaService),
    server = app.getHttpServer();
  const key = "test-" + Date.now();
  const ingredients = [],
    menus = [],
    plans = [];
  const post = (url, body) =>
    request(server)
      .post("/api/v1" + url)
      .send(body);
  try {
    await request(server).get("/api/v1/health/ready").expect(200);
    await t.test("rejects unknown fields and invalid quantities", async () => {
      await post("/ingredients", {
        name: "bad",
        category: "test",
        unit: "kg",
        minimum: -1,
      }).expect(400);
      await post("/menus", {
        name: "bad",
        category: "test",
        price: 1,
        quantity: 9,
      }).expect(400);
      await post("/ingredients", {
        name: "   ",
        category: "test",
        unit: "kg",
        minimum: 0,
      }).expect(400);
    });
    const ingredient = (
      await post("/ingredients", {
        name: key + " chicken",
        category: "test",
        unit: "kg",
        minimum: 2,
      }).expect(201)
    ).body;
    ingredients.push(ingredient.id);
    const movement = {
      ingredientId: ingredient.id,
      quantity: 5,
      reason: "test opening",
      idempotencyKey: key + "-opening",
    };
    await post("/stock-movements", movement).expect(201);
    await post("/stock-movements", movement).expect(201);
    await post("/stock-movements", { ...movement, quantity: 6 }).expect(409);
    assert.equal(
      Number(
        (await db.ingredient.findUnique({ where: { id: ingredient.id } }))
          .quantity,
      ),
      5,
    );
    await t.test("negative stock rejected with rollback", async () => {
      await post("/stock-movements", {
        ...movement,
        quantity: -6,
        idempotencyKey: key + "-negative",
      }).expect(409);
      assert.equal(
        await db.stockMovement.count({
          where: { ingredientId: ingredient.id },
        }),
        1,
      );
    });
    const menu = (
      await post("/menus", {
        name: key + " menu",
        category: "test",
        price: 12000,
      }).expect(201)
    ).body;
    menus.push(menu.id);
    await request(server)
      .put("/api/v1/menus/" + menu.id + "/recipe")
      .send({ lines: [{ ingredientId: ingredient.id, quantity: 0.15 }] })
      .expect(200);
    await t.test(
      "invalid replacement leaves existing recipe intact",
      async () => {
        await request(server)
          .put("/api/v1/menus/" + menu.id + "/recipe")
          .send({
            lines: [
              { ingredientId: ingredient.id, quantity: 1 },
              { ingredientId: ingredient.id, quantity: 2 },
            ],
          })
          .expect(400);
        await request(server)
          .put("/api/v1/menus/" + menu.id + "/recipe")
          .send({ lines: [{ ingredientId: 2147483647, quantity: 1 }] })
          .expect(400);
        assert.equal(
          Number(
            (await db.recipeLine.findFirst({ where: { menuId: menu.id } }))
              .quantity,
          ),
          0.15,
        );
      },
    );
    const items = [{ menuId: menu.id, portions: 40 }];
    const preview = (
      await post("/kitchen-plans/preview", { items }).expect(201)
    ).body;
    assert.equal(preview.ingredients[0].required, 6);
    assert.equal(preview.ingredients[0].shortage, 1);
    await post("/kitchen-plans/preview", {
      items: [{ menuId: menu.id, portions: -1 }],
    }).expect(400);
    const planBody = {
      items,
      businessDate: "2026-11-16",
      idempotencyKey: key + "-plan",
    };
    const plan = (await post("/kitchen-plans", planBody).expect(201)).body;
    plans.push(plan.id);
    assert.equal(
      (await post("/kitchen-plans", planBody).expect(201)).body.id,
      plan.id,
    );
    await post("/kitchen-plans", {
      ...planBody,
      items: [{ menuId: menu.id, portions: 41 }],
    }).expect(409);
    await post("/kitchen-plans/" + plan.id + "/approve", {}).expect(201);
    await post("/kitchen-plans/" + plan.id + "/approve", {}).expect(201);
    assert.equal(
      Number(
        (await db.ingredient.findUnique({ where: { id: ingredient.id } }))
          .quantity,
      ),
      5,
    );
    await t.test("waste decreases stock exactly once", async () => {
      const waste = {
        ingredientId: ingredient.id,
        quantity: 1,
        reason: "test waste",
        idempotencyKey: key + "-waste",
      };
      await post("/waste-records", waste).expect(201);
      await post("/waste-records", waste).expect(201);
      await post("/waste-records", {
        ...waste,
        quantity: -1,
        idempotencyKey: key + "-badwaste",
      }).expect(400);
      assert.equal(
        Number(
          (await db.ingredient.findUnique({ where: { id: ingredient.id } }))
            .quantity,
        ),
        4,
      );
    });
    await t.test(
      "concurrent duplicate restocks never double count",
      async () => {
        const body = {
          ingredientId: ingredient.id,
          quantity: 1,
          reason: "concurrent",
          idempotencyKey: key + "-parallel",
        };
        const results = await Promise.all([
          post("/stock-movements", body),
          post("/stock-movements", body),
        ]);
        assert.ok(results.every((r) => [201, 409].includes(r.status)));
        assert.ok(results.some((r) => r.status === 201));
        assert.equal(
          Number(
            (await db.ingredient.findUnique({ where: { id: ingredient.id } }))
              .quantity,
          ),
          5,
        );
      },
    );
    await t.test(
      "daily sale replaces aggregate instead of doubling",
      async () => {
        const body = {
          menuId: menu.id,
          businessDate: "2026-11-15",
          quantity: 3,
        };
        await post("/sales", body).expect(201);
        await post("/sales", body).expect(201);
        assert.equal(
          await db.dailySale.count({ where: { menuId: menu.id } }),
          1,
        );
        await post("/sales", { ...body, closed: true }).expect(400);
        await post("/sales", { ...body, businessDate: "2026-02-30" }).expect(
          400,
        );
      },
    );
    await post("/forecast-runs", {}).expect(503);
    const fresh = new PrismaService();
    try {
      await fresh.$connect();
      assert.equal(
        Number(
          (await fresh.ingredient.findUnique({ where: { id: ingredient.id } }))
            .quantity,
        ),
        5,
      );
    } finally {
      await fresh.$disconnect();
    }
  } finally {
    await db.kitchenPlan.deleteMany({ where: { id: { in: plans } } });
    await db.dailySale.deleteMany({ where: { menuId: { in: menus } } });
    await db.menuItem.deleteMany({ where: { id: { in: menus } } });
    await db.wasteRecord.deleteMany({
      where: { ingredientId: { in: ingredients } },
    });
    await db.stockMovement.deleteMany({
      where: { ingredientId: { in: ingredients } },
    });
    await db.ingredient.deleteMany({ where: { id: { in: ingredients } } });
    await app.close();
  }
});
