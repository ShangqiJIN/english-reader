import assert from "node:assert/strict";
import test from "node:test";
import { classifySelection, detectCollocations, normalizeSelection } from "../src/shared/text.js";

test("normalizes repeated whitespace", () => {
  assert.equal(normalizeSelection("  difficult\n  sentence "), "difficult sentence");
});

test("classifies a word and phrase as vocabulary", () => {
  assert.equal(classifySelection("ephemeral"), "vocabulary");
  assert.equal(classifySelection("in light of"), "vocabulary");
});

test("classifies a complete sentence", () => {
  assert.equal(classifySelection("Although it was raining, they continued their journey."), "sentence");
});

test("detects packaged collocations", () => {
  assert.deepEqual(
    detectCollocations("We need to take into account the risks in order to proceed."),
    [
      { phrase: "in order to", meaningZh: "为了" },
      { phrase: "take into account", meaningZh: "把……考虑在内" }
    ]
  );
});
