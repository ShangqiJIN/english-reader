import assert from "node:assert/strict";
import test from "node:test";
import { classifySelection, detectCollocations, extractWordWindow, keepVerbatimSegments, normalizeSelection, rankMeaningsByContext, segmentSentence } from "../src/shared/text.js";

test("normalizes repeated whitespace", () => {
  assert.equal(normalizeSelection("  difficult\n  sentence "), "difficult sentence");
});

test("extracts three nearby words without crossing a sentence boundary", () => {
  const passage = "Ignore this. They made an attempt to solve it quickly. Next sentence.";
  assert.deepEqual(
    extractWordWindow(passage, "attempt", passage.indexOf("attempt")),
    { before: ["They", "made", "an"], after: ["to", "solve", "it"] }
  );
});

test("ranks a verb or noun sense from the preceding words", () => {
  const meanings = [{ partOfSpeech: "noun" }, { partOfSpeech: "verb" }];
  assert.equal(rankMeaningsByContext(meanings, { before: ["They", "will"], after: [] })[0].partOfSpeech, "verb");
  assert.equal(rankMeaningsByContext(meanings, { before: ["made", "an"], after: [] })[0].partOfSpeech, "noun");
});

test("segments infinitive purpose and following imperative clauses", () => {
  assert.deepEqual(
    segmentSentence("Contributors are working behind the scenes to make open source better for everyone give them the help and recognition they deserve."),
    [
      "Contributors are working behind the scenes",
      "to make open source better for everyone",
      "give them the help and recognition they deserve."
    ]
  );
});

test("classifies a word and phrase as vocabulary", () => {
  assert.equal(classifySelection("ephemeral"), "vocabulary");
  assert.equal(classifySelection("in light of"), "vocabulary");
});

test("classifies a complete sentence", () => {
  assert.equal(classifySelection("Although it was raining, they continued their journey."), "sentence");
  assert.equal(classifySelection("They walked right out without looking"), "sentence");
});

test("detects packaged collocations", () => {
  assert.deepEqual(
    detectCollocations("We need to take into account the risks in order to proceed."),
    [
      { phrase: "in order to", meaningZh: "为了", selected: true },
      { phrase: "take into account", meaningZh: "把……考虑在内", selected: true }
    ]
  );
});

test("detects a discontinuous not only but also construction", () => {
  assert.deepEqual(
    detectCollocations("She not only read the book but also reviewed it."),
    [{ phrase: "not only … but also", meaningZh: "不仅……而且……", parts: ["not only", "but also"], selected: true }]
  );
});

test("keeps only complete verbatim sentence segments", () => {
  const text = "He passed by his own face, plastered upon a billboard.";
  assert.deepEqual(keepVerbatimSegments(text, ["He passed by his own face,", "plastered upon a billboard."]), ["He passed by his own face,", "plastered upon a billboard."]);
  assert.deepEqual(keepVerbatimSegments(text, ["他经过了自己的脸", "贴在广告牌上"]), []);
});
