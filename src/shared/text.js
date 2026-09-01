const sentenceEndPattern = /[.!?][\"'\u201d\u2019)]?$/;

const collocationRules = [
  ["according to", "根据；按照"],
  ["as a result", "因此；结果"],
  ["as well as", "以及；也"],
  ["be able to", "能够"],
  ["be based on", "基于"],
  ["be concerned with", "与……有关"],
  ["be responsible for", "负责"],
  ["behind the scenes", "在幕后"],
  ["because of", "因为；由于"],
  ["carry out", "执行；开展"],
  ["come up with", "提出；想出"],
  ["depend on", "取决于"],
  ["due to", "由于"],
  ["even though", "即使；尽管"],
  ["figure out", "弄清楚；解决"],
  ["focus on", "专注于"],
  ["in addition to", "除……之外还"],
  ["in order to", "为了"],
  ["in terms of", "就……而言"],
  ["open source", "开源"],
  ["plastered onto", "贴满；贴在……上"],
  ["lead to", "导致"],
  ["make use of", "利用"],
  ["not only", "不仅"],
  ["rather than", "而不是"],
  ["refer to", "指的是；提到"],
  ["result in", "导致"],
  ["take advantage of", "利用"],
  ["take into account", "把……考虑在内"],
  ["there is no doubt", "毫无疑问"],
  ["with regard to", "关于"]
];

export function normalizeSelection(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

export function classifySelection(text) {
  const normalized = normalizeSelection(text);
  const wordCount = normalized ? normalized.split(" ").length : 0;
  const looksLikeSentence = wordCount >= 5 || sentenceEndPattern.test(normalized);
  return looksLikeSentence ? "sentence" : "vocabulary";
}

export function createVocabularyResult(text) {
  const normalized = normalizeSelection(text);
  const isPhrase = normalized.includes(" ");

  return {
    id: crypto.randomUUID(),
    kind: "vocabulary",
    text: normalized,
    normalizedText: normalized.toLocaleLowerCase("en-US"),
    entryType: isPhrase ? "phrase" : "word",
    ipa: "",
    partOfSpeech: isPhrase ? "phrase" : "unknown",
    chineseDefinition: "正在等待 Chrome 本地翻译…",
    englishDefinition: "",
    phraseMeaning: isPhrase ? "待分析短语整体含义" : "",
    createdAt: new Date().toISOString()
  };
}

export function createSentenceResult(text) {
  const normalized = normalizeSelection(text);
  const segments = segmentSentence(normalized);

  return {
    id: crypto.randomUUID(),
    kind: "sentence",
    text: normalized,
    translationZh: "正在等待 Chrome 本地翻译…",
    segments: segments.length ? segments : [normalized],
    structureSummary: "",
    clauses: [],
    collocations: detectCollocations(normalized),
    learningVocabulary: [],
    difficultyNotes: [],
    analysisStatus: "complete",
    createdAt: new Date().toISOString()
  };
}

export function segmentSentence(text) {
  const normalized = normalizeSelection(text);
  if (!normalized) return [];
  // ponytail: readable clause heuristics, not a full parser; DeepSeek mode handles unusual syntax.
  return normalized
    .split(/(?<=[,;:])\s+|\s+(?=(?:but|because|although|which|that|who|when|if)\b)|\s+(?=to\s+[a-z]+\b)|\s+(?=(?:give|help|show|tell|offer|provide)\s+(?:them|him|her|us|you|it)\b)/i)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function keepVerbatimSegments(text, segments) {
  const source = normalizeSelection(text).toLocaleLowerCase();
  const candidates = Array.isArray(segments) ? segments.map(normalizeSelection).filter(Boolean).slice(0, 12) : [];
  return candidates.length && candidates.every((segment) => source.includes(segment.toLocaleLowerCase())) ? candidates : [];
}

export function extractWordWindow(fullText, selectedText, occurrence = 0) {
  const text = String(fullText ?? "");
  const selected = normalizeSelection(selectedText);
  const start = occurrence >= 0 ? occurrence : text.indexOf(selected);
  if (!selected || start < 0) return { before: [], after: [] };
  const beforeSentence = text.slice(0, start).split(/[.!?。！？][\s"'’”)]*/).pop() ?? "";
  const afterSentence = text.slice(start + selected.length).split(/[.!?。！？]/)[0] ?? "";
  const words = (value) => value.match(/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu) ?? [];
  return { before: words(beforeSentence).slice(-3), after: words(afterSentence).slice(0, 3) };
}

export function rankMeaningsByContext(meanings, window) {
  const before = (window?.before ?? []).map((word) => word.toLocaleLowerCase("en-US"));
  const after = (window?.after ?? []).map((word) => word.toLocaleLowerCase("en-US"));
  const previous = before.at(-1) ?? "";
  const subjectBefore = ["i", "you", "we", "they", "he", "she", "it"].includes(previous);
  const verbBefore = ["to", "can", "could", "may", "might", "must", "shall", "should", "will", "would", "do", "does", "did"].includes(previous) || subjectBefore;
  const nounBefore = ["a", "an", "the", "this", "that", "these", "those", "my", "your", "his", "her", "our", "their"].includes(previous);
  const adjectiveBefore = ["be", "am", "is", "are", "was", "were", "seem", "seems", "feel", "feels"].includes(previous);
  return [...meanings].map((meaning, index) => {
    let score = 0;
    if (meaning.partOfSpeech === "verb" && verbBefore) score += 5;
    if (meaning.partOfSpeech === "noun" && nounBefore) score += 5;
    if (meaning.partOfSpeech === "adjective" && adjectiveBefore) score += 5;
    const example = String(meaning.example ?? "").toLocaleLowerCase("en-US");
    score += [...before, ...after].filter((word) => word.length > 2 && example.includes(word)).length;
    return { meaning, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(({ meaning }) => meaning);
}

export function detectCollocations(text) {
  const lowerText = normalizeSelection(text).toLocaleLowerCase("en-US");
  return collocationRules
    .filter(([phrase]) => lowerText.includes(phrase))
    .map(([phrase, meaningZh]) => ({ phrase, meaningZh }));
}
