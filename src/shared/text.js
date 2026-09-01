const sentenceEndPattern = /[.!?][\"'\u201d\u2019)]?$/;

const collocationRules = [
  ["according to", "根据；按照"],
  ["as a result", "因此；结果"],
  ["as well as", "以及；也"],
  ["be able to", "能够"],
  ["be based on", "基于"],
  ["be concerned with", "与……有关"],
  ["be responsible for", "负责"],
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
  const looksLikeSentence = wordCount >= 7 || sentenceEndPattern.test(normalized);
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
  const segments = normalized
    .split(/(?<=[,;:])\s+|\s+(?=(?:and|but|because|although|which|that|who|when|if)\b)/i)
    .filter(Boolean);

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

export function detectCollocations(text) {
  const lowerText = normalizeSelection(text).toLocaleLowerCase("en-US");
  return collocationRules
    .filter(([phrase]) => lowerText.includes(phrase))
    .map(([phrase, meaningZh]) => ({ phrase, meaningZh }));
}
