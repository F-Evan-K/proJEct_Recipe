require("dotenv/config");
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { Test } = require("@nestjs/testing");
const { AppModule, configureApp } = require("../dist/app");
const { PrismaService } = require("../dist/prisma.service");
const { hashPassword, verifyPassword } = require("../dist/auth/password");
test("password hashes use random salts and reject incorrect passwords", async () => {
  const a = await hashPassword("Testing-only-password"),
    b = await hashPassword("Testing-only-password");
  assert.notEqual(a, b);
  assert.ok(!a.includes("Testing-only-password"));
  assert.ok(await verifyPassword("Testing-only-password", a));
  assert.equal(await verifyPassword("wrong", a), false);
});
test("multiple accounts, owner approval, roles and session lifecycle", async (t) => {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = module.createNestApplication();
  configureApp(app);
  await app.init();
  const db = app.get(PrismaService),
    server = app.getHttpServer();
  const key = "auth-" + Date.now();
  const ids = [];
  const password = "Test-only-" + key;
  const agent = () => request.agent(server).set("X-KitchenFlow-Request", "1");
  const ownerClient = agent(),
    first = agent(),
    second = agent();
  try {
    const owner = await db.user.create({
      data: {
        name: "Owner test",
        email: key + "-owner@example.test",
        passwordHash: await hashPassword(password),
        role: "ADMIN",
        active: true,
      },
    });
    ids.push(owner.id);
    await t.test(
      "anonymous and cross-origin mutations are blocked",
      async () => {
        await request(server).get("/api/v1/menus").expect(401);
        await request(server)
          .post("/api/v1/auth/login")
          .send({ email: owner.email, password })
          .expect(403);
        await agent()
          .post("/api/v1/auth/login")
          .set("Origin", "https://untrusted.example")
          .send({ email: owner.email, password })
          .expect(403);
      },
    );
    const login = await ownerClient
      .post("/api/v1/auth/login")
      .send({ email: owner.email, password })
      .expect(201);
    const cookie = login.headers["set-cookie"][0];
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.equal(login.body.user.passwordHash, undefined);
    await t.test(
      "public signup cannot choose admin or use a short password",
      async () => {
        await first
          .post("/api/v1/auth/register")
          .send({
            name: "Test",
            email: key + "-evil@example.test",
            password,
            role: "ADMIN",
          })
          .expect(400);
        await first
          .post("/api/v1/auth/register")
          .send({
            name: "Test",
            email: key + "-short@example.test",
            password: "short",
          })
          .expect(400);
      },
    );
    const email1 = key + "-one@example.test",
      email2 = key + "-two@example.test";
    const one = (
      await first
        .post("/api/v1/auth/register")
        .send({ name: "Staff One", email: email1.toUpperCase(), password })
        .expect(201)
    ).body.user;
    ids.push(one.id);
    assert.equal(one.role, "STAFF");
    assert.equal(one.active, false);
    assert.equal(one.passwordHash, undefined);
    const two = (
      await second
        .post("/api/v1/auth/register")
        .send({ name: "Staff Two", email: email2, password })
        .expect(201)
    ).body.user;
    ids.push(two.id);
    await t.test(
      "pending accounts cannot login; duplicate normalized email is rejected",
      async () => {
        await first
          .post("/api/v1/auth/login")
          .send({ email: email1, password })
          .expect(403);
        await first
          .post("/api/v1/auth/register")
          .send({ name: "Duplicate", email: email1, password })
          .expect(409);
      },
    );
    for (const id of [one.id, two.id])
      await ownerClient
        .patch("/api/v1/auth/users/" + id + "/access")
        .send({ active: true })
        .expect(200);
    await first
      .post("/api/v1/auth/login")
      .send({ email: email1, password })
      .expect(201);
    await second
      .post("/api/v1/auth/login")
      .send({ email: email2, password })
      .expect(201);
    assert.equal(
      (await first.get("/api/v1/auth/me").expect(200)).body.user.id,
      one.id,
    );
    assert.equal(
      (await second.get("/api/v1/auth/me").expect(200)).body.user.id,
      two.id,
    );
    await t.test(
      "staff may read but cannot edit catalog, approve plans or manage accounts",
      async () => {
        await first.get("/api/v1/menus").expect(200);
        for (const url of [
          "/menus",
          "/ingredients",
          "/stock-movements",
          "/kitchen-plans/1/approve",
        ])
          await first
            .post("/api/v1" + url)
            .send({})
            .expect(403);
        await first.put("/api/v1/menus/1/details").send({}).expect(403);
        await first.delete("/api/v1/menus/1").expect(403);
        await first.get("/api/v1/auth/users").expect(403);
        await first
          .patch("/api/v1/auth/users/" + one.id + "/access")
          .send({ active: true })
          .expect(403);
        await ownerClient
          .patch("/api/v1/auth/users/" + owner.id + "/access")
          .send({ active: false })
          .expect(403);
      },
    );
    await t.test(
      "session tokens are hashed in storage and password hashes never appear in user lists",
      async () => {
        const session = await db.session.findFirst({
          where: { userId: owner.id },
        });
        const token = cookie.split(";")[0].split("=")[1];
        assert.notEqual(session.tokenHash, token);
        assert.match(session.tokenHash, /^[a-f0-9]{64}$/);
        const users = (await ownerClient.get("/api/v1/auth/users").expect(200))
          .body;
        assert.ok(
          users.every(
            (u) => u.passwordHash === undefined && u.sessions === undefined,
          ),
        );
      },
    );
    await t.test(
      "logout affects only that session; disabling another user revokes their sessions",
      async () => {
        await first.post("/api/v1/auth/logout").send({}).expect(201);
        await first.get("/api/v1/auth/me").expect(401);
        await second.get("/api/v1/auth/me").expect(200);
        await ownerClient
          .patch("/api/v1/auth/users/" + two.id + "/access")
          .send({ active: false })
          .expect(200);
        await second.get("/api/v1/auth/me").expect(401);
        assert.equal(await db.session.count({ where: { userId: two.id } }), 0);
      },
    );
    await t.test(
      "expired and forged cookies cannot access protected endpoints",
      async () => {
        await db.session.updateMany({
          where: { userId: owner.id },
          data: { expiresAt: new Date(0) },
        });
        await ownerClient.get("/api/v1/menus").expect(401);
        await agent()
          .get("/api/v1/menus")
          .set("Cookie", "kitchenflow.sid=" + "a".repeat(64))
          .expect(401);
      },
    );
    await t.test("repeated invalid logins are rate limited", async () => {
      const body = {
        email: key + "-missing@example.test",
        password: "incorrect",
      };
      for (let i = 0; i < 10; i++)
        await agent().post("/api/v1/auth/login").send(body).expect(401);
      await agent().post("/api/v1/auth/login").send(body).expect(429);
    });
  } finally {
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  }
});
