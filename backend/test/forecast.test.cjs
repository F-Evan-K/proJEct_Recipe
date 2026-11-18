require("dotenv/config");
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { Test } = require("@nestjs/testing");
const { AppModule, configureApp } = require("../dist/app");
const { PrismaService } = require("../dist/prisma.service");
const { hashPassword } = require("../dist/auth/password");

test("forecast pipeline uses authenticated, date-filtered database sales and handles ML outages", async t => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication(); configureApp(app); await app.init();
  const db = app.get(PrismaService), server = app.getHttpServer();
  const key = "forecast-test-" + Date.now();
  const originalFetch = global.fetch, originalKey = process.env.ML_SERVICE_KEY;
  let owner, menu;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const target = new Date(today + "T00:00:00Z"); target.setUTCDate(target.getUTCDate() + 1);
  const targetDate = target.toISOString().slice(0, 10);
  try {
    const password = "Synthetic-test-only-password";
    owner = await db.user.create({ data: { name: "Synthetic forecast test", email: key + "@example.test", passwordHash: await hashPassword(password), role: "STAFF", active: true } });
    menu = await db.menuItem.create({ data: { name: key, category: "Temporary synthetic fixture", price: 0 } });
    const rows = Array.from({ length: 70 }, (_, i) => ({ menuId: menu.id, businessDate: new Date(target.getTime() - (70-i)*86400000), quantity: 30, stockout: false, closed: false }));
    const client = request.agent(server).set("X-KitchenFlow-Request", "1");
    await client.post("/api/v1/auth/login").send({ email: owner.email, password }).expect(201);
    const csv = [
      "menu_id,tanggal,porsi,kondisi",
      ...rows.map(row => `${row.menuId},${row.businessDate.toISOString().slice(0, 10)},${row.quantity},normal`),
    ].join("\n");
    const preview = await client.post("/api/v1/sales/import/preview").send({ csv }).expect(201);
    assert.deepEqual(preview.body.counts, { create: 70, update: 0, unchanged: 0 });
    await client.post("/api/v1/sales/import").send({ csv, fingerprint: preview.body.fingerprint }).expect(201);
    await t.test("authentication, business dates, and contradictory sale flags are validated", async () => {
      await request(server).post("/api/v1/forecast-runs").set("X-KitchenFlow-Request", "1").send({ targetDate }).expect(401);
      await client.post("/api/v1/forecast-runs").send({ targetDate: today }).expect(400);
      await client.post("/api/v1/forecast-runs").send({ targetDate, extra: true }).expect(400);
      await client.post("/api/v1/sales").send({ menuId: menu.id, businessDate: targetDate, quantity: 1 }).expect(400);
      await client.post("/api/v1/sales").send({ menuId: menu.id, businessDate: today, quantity: 0, closed: true, stockout: true }).expect(400);
    });
    if (process.env.RUN_ML_INTEGRATION === "1") {
      await t.test("real FastAPI and scikit-learn return a reproducible synthetic baseline", async () => {
        const { body } = await client.post("/api/v1/forecast-runs").send({ targetDate }).expect(201);
        const item = body.items.find(i => i.menuId === menu.id);
        assert.equal(item.status, "READY"); assert.equal(item.quantity, 30);
        assert.equal(item.method, "weekday_mean"); assert.equal(item.evaluation.baseline.mae, 0);
        assert.match(body.dataHash, /^[a-f0-9]{64}$/);
      });
    }
    await t.test("full history goes to ML without frontend pagination or user credentials", async () => {
      process.env.ML_SERVICE_KEY = "synthetic-service-key";
      global.fetch = async (url, options) => {
        const payload = JSON.parse(options.body);
        assert.equal(payload.targetDate, targetDate);
        assert.equal(payload.sales.filter(s => s.menuId === menu.id).length, 70);
        assert.ok(payload.sales.every(s => s.businessDate < targetDate));
        assert.ok(!options.body.includes("password") && !options.body.includes(owner.email));
        assert.equal(options.headers["X-ML-Key"], "synthetic-service-key");
        return new Response(JSON.stringify({ status: "INSUFFICIENT_DATA", items: [] }), { status: 200 });
      };
      await client.post("/api/v1/forecast-runs").send({ targetDate }).expect(201);
    });
    await t.test("outage returns a clear error and releases the processing lock", async () => {
      global.fetch = async () => new Response(null, { status: 429 });
      await client.post("/api/v1/forecast-runs").send({ targetDate }).expect(429);
      global.fetch = async () => { throw Error("synthetic network outage"); };
      await client.post("/api/v1/forecast-runs").send({ targetDate }).expect(503);
      await client.post("/api/v1/forecast-runs").send({ targetDate }).expect(503);
      assert.equal(await db.dailySale.count({ where: { menuId: menu.id } }), 70);
    });
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ML_SERVICE_KEY; else process.env.ML_SERVICE_KEY = originalKey;
    if (menu) { await db.dailySale.deleteMany({ where: { menuId: menu.id } }); await db.menuItem.delete({ where: { id: menu.id } }); }
    if (owner) await db.user.delete({ where: { id: owner.id } });
    await app.close();
  }
});
