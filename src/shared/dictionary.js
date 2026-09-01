export function parseDictionaryEntry(payload, maximumDefinitions = 6) {
  const entries = Array.isArray(payload) ? payload : [];
  const ipa = entries.flatMap((entry) => entry.phonetics ?? [])
    .map((phonetic) => phonetic?.text)
    .find(Boolean) ?? entries.map((entry) => entry?.phonetic).find(Boolean) ?? "";
  const meanings = [];

  for (const entry of entries) {
    for (const meaning of entry?.meanings ?? []) {
      for (const definition of (meaning?.definitions ?? []).slice(0, 2)) {
        if (!definition?.definition) continue;
        meanings.push({
          partOfSpeech: meaning.partOfSpeech || "unknown",
          definitionEn: definition.definition,
          example: definition.example || ""
        });
        if (meanings.length >= maximumDefinitions) return { ipa, meanings };
      }
    }
  }

  return { ipa, meanings };
}

export function dictionaryCandidates(word) {
  const normalized = String(word ?? "").toLocaleLowerCase("en-US");
  const candidates = [normalized];
  if (normalized.endsWith("ied") && normalized.length > 4) candidates.push(`${normalized.slice(0, -3)}y`);
  if (normalized.endsWith("ed") && normalized.length > 3) {
    const stem = normalized.slice(0, -2);
    candidates.push(stem, `${normalized.slice(0, -1)}`);
    if (/(.)\1$/.test(stem)) candidates.push(stem.slice(0, -1));
  }
  if (normalized.endsWith("ing") && normalized.length > 5) {
    const stem = normalized.slice(0, -3);
    candidates.push(stem, `${stem}e`);
    if (/(.)\1$/.test(stem)) candidates.push(stem.slice(0, -1));
  }
  if (normalized.endsWith("ies") && normalized.length > 4) candidates.push(`${normalized.slice(0, -3)}y`);
  else if (normalized.endsWith("s") && normalized.length > 3) candidates.push(normalized.slice(0, -1));
  return [...new Set(candidates.filter(Boolean))];
}

export function parseDatamuseEntry(payload) {
  const entry = Array.isArray(payload) ? payload[0] : null;
  const partNames = { n: "noun", v: "verb", adj: "adjective", adv: "adverb" };
  const meanings = (entry?.defs ?? []).slice(0, 6).map((definition) => {
    const [tag, ...text] = String(definition).split("\t");
    return { partOfSpeech: partNames[tag] ?? tag ?? "unknown", definitionEn: text.join(" ").trim(), example: "" };
  }).filter((meaning) => meaning.definitionEn);
  return { ipa: "", meanings };
}
