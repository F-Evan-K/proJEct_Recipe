const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const source = fs.readFileSync(
  path.join(__dirname, "../src/utils/recipe-editor.ts"),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const mod = { exports: {} };
new Function("exports", "require", "module", compiled)(
  mod.exports,
  require,
  mod,
);
const { recipeDraft, validateMenuEdit, applyMenuEdit } = mod.exports;
const stock = [
  { id: 10, name: "Daging ayam", unit: "kg" },
  { id: 20, name: "Beras premium", unit: "kg" },
  { id: 30, name: "Minyak goreng", unit: "liter" },
];
const food = {
  id: 1,
  name: "Menu A",
  category: "Lunch",
  price: 10000,
  chicken: 0.15,
  rice: 0.1,
  emoji: "x",
  forecast: 10,
  portions: 20,
};
test("legacy menu recipe prepopulates using real ingredient IDs", () => {
  assert.deepEqual(recipeDraft(food, stock), [
    { ingredientId: "10", quantity: "0.15" },
    { ingredientId: "20", quantity: "0.1" },
  ]);
});
test("shared recipe edits preserve portions and support non-chicken ingredients", () => {
  const edit = validateMenuEdit(
    " New menu ",
    " Lunch ",
    "12000.50",
    [{ ingredientId: "30", quantity: "0.02" }],
    stock,
  );
  const updated = applyMenuEdit(food, edit, stock);
  assert.equal(updated.name, "New menu");
  assert.equal(updated.portions, 20);
  assert.equal(updated.price, 12000.5);
  assert.equal(updated.chicken, 0);
  assert.equal(updated.rice, 0);
  assert.equal(updated.recipe[0].unit, "liter");
  assert.equal(updated.recipe[0].quantity * updated.portions, 0.4);
});
test("invalid ingredient, duplicate, zero, negative and excessive precision rejected", () => {
  for (const rows of [
    [{ ingredientId: "999", quantity: "1" }],
    [
      { ingredientId: "10", quantity: "1" },
      { ingredientId: "10", quantity: "2" },
    ],
    [{ ingredientId: "10", quantity: "0" }],
    [{ ingredientId: "10", quantity: "-1" }],
    [{ ingredientId: "10", quantity: "0.0000001" }],
    [{ ingredientId: "10", quantity: "" }],
  ])
    assert.throws(() => validateMenuEdit("Menu", "Lunch", "1000", rows, stock));
});
test("blank metadata and invalid monetary values rejected; free menu permitted", () => {
  for (const [name, category, price] of [
    [" ", "Lunch", "1000"],
    ["Menu", " ", "1000"],
    ["Menu", "Lunch", ""],
    ["Menu", "Lunch", "-1"],
    ["Menu", "Lunch", "2.555"],
  ])
    assert.throws(() => validateMenuEdit(name, category, price, [], stock));
  assert.equal(validateMenuEdit("Menu", "Lunch", "0", [], stock).price, 0);
});
test("empty saved recipe remains empty and never falls back to legacy quantities", () => {
  assert.deepEqual(recipeDraft({ ...food, recipe: [] }, stock), []);
  assert.deepEqual(
    applyMenuEdit(
      food,
      validateMenuEdit("Menu", "Lunch", "1000", [], stock),
      stock,
    ).recipe,
    [],
  );
});
