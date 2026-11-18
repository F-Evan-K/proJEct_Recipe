require("dotenv/config");
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { Test } = require("@nestjs/testing");
const { AppModule, configureApp } = require("../dist/app");
const { PrismaService } = require("../dist/prisma.service");
const { BacktestService } = require("../dist/forecast/backtest.service");
const { hashPassword } = require("../dist/auth/password");
const { jakartaBusinessDate } = require("../dist/records/sale-rules");

test("backtest validates, snapshots, retries and retains evaluation results", async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  configureApp(app);
  await app.init();
  const db = app.get(PrismaService);
  const worker = app.get(BacktestService);
  const server = app.getHttpServer();
  const originalFetch = global.fetch;
  const originalKey = process.env.ML_SERVICE_KEY;
  const token = "backtest-" + Date.now();
  const password = "Synthetic-test-only-password";
  const today = jakartaBusinessDate();
  const todayDate = new Date(today + "T00:00:00Z");
  const day = (offset) => new Date(todayDate.getTime() + offset * 86400000);
  const iso = (offset) => day(offset).toISOString().slice(0, 10);
  let user, menu;
  try {
    user = await db.user.create({
      data: { name: "Backtest test", email: token + "@example.test", passwordHash: await hashPassword(password), active: true, role: "STAFF" },
    });
    menu = await db.menuItem.create({ data: { name: token, category: "Temporary test", price: 0 } });
    await db.dailySale.createMany({
      data: Array.from({ length: 77 }, (_, index) => ({
        menuId: menu.id, businessDate: day(index - 77), quantity: 30,
      })),
    });
    const client = request.agent(server).set("X-KitchenFlow-Request", "1");
    const path = "/api/v1/forecast-backtests";
    const payload = { startDate: iso(-7), endDate: iso(-1), menuIds: [menu.id] };
    await client.post("/api/v1/auth/login").send({ email: user.email, password }).expect(201);
    await request(server).get(path).expect(401);
    await client.post(path).send({ ...payload, endDate: today }).expect(400);
    await client.post(path).send({ ...payload, startDate: iso(-4) }).expect(400);
    await client.post(path).send({ ...payload, menuIds: [menu.id, menu.id] }).expect(400);
    await client.post(path).send({ ...payload, menuIds: [2147483647] }).expect(400);

    const attempts = await Promise.all([client.post(path).send(payload), client.post(path).send(payload)]);
    const [{ body: first }, duplicate] = attempts;
    assert.deepEqual(attempts.map(response => response.status), [201, 201]);
    assert.equal(first.status, "QUEUED");
    assert.equal(first.id, duplicate.body.id);
    assert.equal(first.snapshot, undefined);
    assert.match(first.sourceHash, /^[a-f0-9]{64}$/);
    await client.post("/api/v1/sales").send({ menuId: menu.id, businessDate: payload.startDate, quantity: 200 }).expect(201);

    if (process.env.RUN_BACKTEST_ML !== "1") {
      process.env.ML_SERVICE_KEY = "synthetic-service-key";
      global.fetch = async (url, options) => {
        assert.match(url, /\/backtest$/);
        assert.equal(options.headers["X-ML-Key"], "synthetic-service-key");
        const input = JSON.parse(options.body);
        const row = input.sales.find(item => item.businessDate === payload.startDate);
        return Response.json({
          protocol: "walk-forward-v1", modelVersion: "daily-sales-v1",
          startDate: input.startDate, endDate: input.endDate, summary: { scored: 7 },
          menus: [{ days: [{ actual: row.quantity }] }],
        });
      };
    }
    await worker.processNext();
    const { body: report } = await client.get(path + "/" + first.id).expect(200);
    assert.equal(report.status, "COMPLETED");
    assert.equal(report.result.summary.scored, 7);
    assert.equal(report.result.menus[0].days[0].actual, 30);
    assert.equal(report.snapshot, undefined);
    if (process.env.RUN_BACKTEST_ML === "1") {
      assert.equal(report.result.summary.scores.selected.mae, 0);
      assert.equal(report.result.menus[0].days[0].selected, 30);
    }
    const { body: listed } = await client.get(path).expect(200);
    assert.ok(listed.items.some(item => item.id === first.id));
    assert.ok(listed.items.every(item => item.result === undefined));

    const { body: next } = await client.post(path).send(payload).expect(201);
    assert.notEqual(next.sourceHash, first.sourceHash);
    assert.notEqual(next.id, first.id);
    global.fetch = async () => new Response(null, { status: 429 });
    for (let index = 0; index < 3; index++) {
      await db.forecastBacktest.update({ where: { id: next.id }, data: { availableAt: new Date(0) } });
      await worker.processNext();
    }
    const { body: failed } = await client.get(path + "/" + next.id).expect(200);
    assert.equal(failed.status, "FAILED");
    assert.equal(failed.attempts, 3);
    const { body: retried } = await client.post(path + "/" + next.id + "/retry").expect(201);
    assert.equal(retried.status, "QUEUED");
    assert.equal(retried.sourceHash, next.sourceHash);
    await db.forecastBacktest.update({
      where: { id: next.id },
      data: { status: "RUNNING", attempts: 1, leaseUntil: new Date(0), leaseToken: "obsolete-worker" },
    });
    const completedFetch = process.env.RUN_BACKTEST_ML === "1" ? originalFetch : async (_url, options) => {
      const input = JSON.parse(options.body);
      return Response.json({
        protocol: "walk-forward-v1", modelVersion: "daily-sales-v1",
        startDate: input.startDate, endDate: input.endDate, summary: { scored: 7 },
        menus: [{ days: [{ actual: 200 }] }],
      });
    };
    global.fetch = completedFetch;
    await worker.processNext();
    const { body: recovered } = await client.get(path + "/" + next.id).expect(200);
    assert.equal(recovered.status, "COMPLETED");
    assert.equal(recovered.attempts, 2);
    assert.equal(recovered.result.menus[0].days[0].actual, 200);
    const { body: stillOriginal } = await client.get(path + "/" + first.id).expect(200);
    assert.equal(stillOriginal.result.menus[0].days[0].actual, 30);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ML_SERVICE_KEY;
    else process.env.ML_SERVICE_KEY = originalKey;
    if (user) await db.forecastBacktest.deleteMany({ where: { startedById: user.id } });
    if (menu) {
      await db.dailySale.deleteMany({ where: { menuId: menu.id } });
      await db.menuItem.delete({ where: { id: menu.id } });
    }
    if (user) await db.user.delete({ where: { id: user.id } });
    await app.close();
  }
});
