import assert from "node:assert/strict";
import test from "node:test";
import { createCsv, createHtml, createLibraryJson } from "../src/shared/export.js";

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

test("exports language ipa and numbered meanings to csv", () => {
  const csv = createCsv([{
    kind: "vocabulary",
    sourceLanguage: "en",
    text: "attempt",
    ipa: "/əˈtɛmpt/",
    chineseDefinition: "尝试",
    meanings: [{ partOfSpeech: "noun", definitionZh: "尝试" }, { partOfSpeech: "verb", definitionZh: "试图" }]
  }]);
  assert.match(csv, /^id,sub_id,type,language,text,ipa/);
  assert.match(csv, /\/əˈtɛmpt\//);
  assert.match(csv, /1\. noun: 尝试/);
  assert.match(csv, /2\. verb: 试图/);
});

test("exports only the sentence and collocations under one parent id", () => {
  const csv = createCsv([{
    kind: "sentence",
    sourceLanguage: "en",
    text: "He passed by a billboard.",
    translationZh: "他经过了一块广告牌。",
    segments: ["He passed by", "a billboard."],
    collocations: [{ phrase: "pass by", meaningZh: "经过；路过" }],
    source: { pageUrl: "https://example.com/reading/article" }
  }]);
  assert.match(csv, /1,0,sentence,en/);
  assert.match(csv, /1,1,fixed_collocation,en,pass by,经过；路过,https:\/\/example\.com/);
  assert.doesNotMatch(csv, /sentence_segment/);
  assert.equal(csv.split("\n").length, 3);
  assert.doesNotMatch(csv, /source_title|source_url|created_at/);
  assert.doesNotMatch(csv.split("\n")[0], /ipa|numbered_meanings/);
  assert.doesNotMatch(csv, /\/reading\/article/);
});

test("drops columns that are empty for every exported row", () => {
  const csv = createCsv([{ kind: "vocabulary", text: "organic", chineseDefinition: "有机的" }]);
  const header = csv.split("\n")[0];
  assert.equal(header, "id,sub_id,type,text,translation");
  assert.doesNotMatch(header, /language|ipa|numbered_meanings|source/);
});

test("creates a standalone html view with escaped cards and collocations", () => {
  const html = createHtml([{
    kind: "sentence",
    text: "A < B",
    translationZh: "A 小于 B",
    collocations: [{ phrase: "pass by", meaningZh: "经过" }]
  }], "句子库");
  assert.match(html, /<!doctype html>/);
  assert.match(html, /A &lt; B/);
  assert.match(html, /固定搭配/);
  assert.match(html, /pass by/);
});
