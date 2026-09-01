import assert from "node:assert/strict";
import test from "node:test";
import { createCsv, createLibraryJson } from "../src/shared/export.js";

test("exports a versioned library json document", () => {
  const parsed = JSON.parse(createLibraryJson({ vocabulary: [{ id: "1" }], sentences: [] }));
  assert.equal(parsed.format, "english-reader-library");
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.vocabulary[0].id, "1");
});

test("escapes commas and quotes in csv", () => {
  const csv = createCsv([{
    kind: "vocabulary",
    text: 'take "care", now',
    chineseDefinition: "当心"
  }]);
  assert.match(csv, /"take ""care"", now"/);
});
