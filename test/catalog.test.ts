import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CATEGORIES, RULES, RULE_BY_ID } from "../src/catalog.js";

describe("catálogo", () => {
  it("toda regra tem id único, receita ruim→bom e categoria conhecida", () => {
    const seen = new Set<string>();
    for (const rule of RULES) {
      assert.equal(RULE_BY_ID.get(rule.id), rule, rule.id);
      assert.ok(!seen.has(rule.id), `id duplicado ${rule.id}`);
      seen.add(rule.id);
      assert.match(rule.id, /^effect-doctor\/[a-z0-9-]+$/);
      assert.ok(rule.message.length > 8, rule.id);
      assert.ok(rule.hint.length > 8, rule.id);
      assert.ok(rule.bad.length > 0, rule.id);
      assert.ok(rule.good.length > 0, rule.id);
      assert.ok(rule.bad !== rule.good, rule.id);
      assert.ok((CATEGORIES as readonly string[]).includes(rule.category), `${rule.id} ${rule.category}`);
    }
    assert.ok(RULES.length >= 150, String(RULES.length));
  });
});
