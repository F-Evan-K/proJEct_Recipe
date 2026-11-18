require("dotenv/config");
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { Test } = require("@nestjs/testing");
const { AppModule, configureApp } = require("../dist/app");
const { PrismaService } = require("../dist/prisma.service");
const { hashPassword } = require("../dist/auth/password");

test("sales import validates CSV, prevents stale overwrites, and saves changes as a batch", async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  configureApp(app);
  await app.init();
  const db = app.get(PrismaService);
  const server = app.getHttpServer();
  const key = "csv-test-" + Date.now();
  const password = "Synthetic-test-only-password";
  let user, menu;
  try {
    user = await db.user.create({
      data: { name: "CSV test", email: key + "@example.test", passwordHash: await hashPassword(password), role: "STAFF", active: true },
    });
    menu = await db.menuItem.create({ data: { name: key, category: "Temporary synthetic fixture", price: 0 } });
    const client = request.agent(server).set("X-KitchenFlow-Request", "1");
    await client.post("/api/v1/auth/login").send({ email: user.email, password }).expect(201);
    const preview = csv => client.post("/api/v1/sales/import/preview").send({ csv });
    const commit = (csv, fingerprint) => client.post("/api/v1/sales/import").send({ csv, fingerprint });
    const list = () => db.dailySale.findMany({ where: { menuId: menu.id }, orderBy: { businessDate: "asc" } });
    const manual = quantity => client.post("/api/v1/sales").send({ menuId: menu.id, businessDate: "2025-01-01", quantity });
    const id = menu.id;
    const csv = `\uFEFFtanggal;menu_id;kondisi;porsi\r\n"2025-01-01";${id};normal;12\r\n2025-01-02;${id};tutup;0\r\n2025-01-03;${id};stockout;7\r\n`;

    await request(server).post("/api/v1/sales/import/preview").set("X-KitchenFlow-Request", "1").send({ csv }).expect(401);
    await manual(5).expect(201);
    const { body: first } = await preview(csv).expect(201);
    assert.deepEqual(first.counts, { create: 2, update: 1, unchanged: 0 });
    assert.equal(first.rows[0].previous.quantity, 5);
    assert.equal((await list()).length, 1);

    await manual(8).expect(201);
    await commit(csv, first.fingerprint).expect(409);
    assert.deepEqual((await list()).map(row => row.quantity), [8]);
    const { body: latest } = await preview(csv).expect(201);
    assert.equal(latest.rows[0].previous.quantity, 8);

    const invalid = [
      "menu_id,tanggal,porsi,kondisi",
      `${id},2025-01-01,12,normal`,
      `${id},2025-01-01,10,normal`,
      `${id},2025-02-30,7,normal`,
      `${id},2025-01-04,1,tutup`,
      `${id},9999-01-01,1,normal`,
      "2147483647,2025-01-04,1,normal",
      `${id},2025-01-06,"5,2",normal`,
      `${id},2025-01-07,"5,normal`,
    ].join("\n");
    const { body: rejected } = await preview(invalid).expect(201);
    assert.deepEqual(rejected.issues.map(issue => issue.line), [3, 4, 5, 6, 7, 8, 9]);
    assert.equal(rejected.fingerprint, null);
    await commit(invalid, latest.fingerprint).expect(400);
    assert.deepEqual((await list()).map(row => row.quantity), [8]);

    await commit(csv.replace(";12", ";13"), latest.fingerprint).expect(409);
    const { body: imported } = await commit(csv, latest.fingerprint).expect(201);
    assert.deepEqual(imported, { create: 2, update: 1, unchanged: 0 });
    assert.deepEqual((await list()).map(row => [row.quantity, row.closed, row.stockout]), [
      [12, false, false], [0, true, false], [7, false, true],
    ]);
    const { body: repeated } = await preview(csv).expect(201);
    assert.deepEqual(repeated.counts, { create: 0, update: 0, unchanged: 3 });
    await commit(csv, repeated.fingerprint).expect(201);
    assert.equal((await list()).length, 3);
  } finally {
    if (menu) {
      await db.dailySale.deleteMany({ where: { menuId: menu.id } });
      await db.menuItem.delete({ where: { id: menu.id } });
    }
    if (user) await db.user.delete({ where: { id: user.id } });
    await app.close();
  }
});
