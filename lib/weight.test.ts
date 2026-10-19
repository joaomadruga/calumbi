import test from "node:test";
import assert from "node:assert/strict";
import { weightInKg, weightLabel } from "./weight.ts";
test("live and carcass arrobas convert to the stored live kilograms", () => {
  assert.equal(weightInKg(450, "kg", 50), 450);
  assert.equal(weightInKg(30, "arroba-vivo", 50), 450);
  assert.equal(weightInKg(15, "arroba-carcaca", 50), 450);
  assert.equal(weightInKg(15, "arroba-carcaca", 60), 375);
  assert.equal(
    weightLabel(450, 50),
    "450 kg vivo · 30 @ vivo · 15 @ carcaça estimada",
  );
  assert.equal(weightLabel(0, 50), "Peso não informado");
  assert.throws(() => weightInKg(-1, "kg", 50));
  assert.throws(() => weightInKg(15, "arroba-carcaca", 0));
});
