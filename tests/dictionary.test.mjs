import assert from "node:assert/strict";
import test from "node:test";
import { dictionaryCandidates, parseDatamuseEntry, parseDictionaryEntry } from "../src/shared/dictionary.js";

test("extracts ipa and keeps noun and verb senses", () => {
  const entry = parseDictionaryEntry([{
    phonetics: [{ text: "/test/" }],
    meanings: [
      { partOfSpeech: "noun", definitions: [{ definition: "A trial." }] },
      { partOfSpeech: "verb", definitions: [{ definition: "To examine." }] }
    ]
  }]);
  assert.equal(entry.ipa, "/test/");
  assert.deepEqual(entry.meanings, [
    { partOfSpeech: "noun", definitionEn: "A trial.", example: "" },
    { partOfSpeech: "verb", definitionEn: "To examine.", example: "" }
  ]);
});

test("parses numbered Datamuse fallback definitions", () => {
  assert.deepEqual(parseDatamuseEntry([{ defs: ["v\tTo infer.", "n\tA guess."] }]).meanings, [
    { partOfSpeech: "verb", definitionEn: "To infer.", example: "" },
    { partOfSpeech: "noun", definitionEn: "A guess.", example: "" }
  ]);
});

test("falls back from common inflections to dictionary lemmas", () => {
  assert.deepEqual(dictionaryCandidates("plastered").slice(0, 2), ["plastered", "plaster"]);
  assert.ok(dictionaryCandidates("stopped").includes("stop"));
  assert.ok(dictionaryCandidates("studied").includes("study"));
});
