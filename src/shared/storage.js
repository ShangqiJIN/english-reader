const vocabularyKey = "vocabulary";
const sentenceKey = "sentences";
const maxLocalEntries = 1000;

async function readList(key) {
  const result = await chrome.storage.local.get(key);
  return Array.isArray(result[key]) ? result[key] : [];
}

export async function saveResult(result) {
  if (!result || !["vocabulary", "sentence"].includes(result.kind) || !result.id) {
    throw new Error("Invalid learning result.");
  }
  const key = result.kind === "sentence" ? sentenceKey : vocabularyKey;
  const items = await readList(key);
  const duplicateIndex = items.findIndex((item) =>
    result.kind === "sentence"
      ? item.text === result.text
      : item.normalizedText === result.normalizedText
  );

  if (duplicateIndex >= 0) {
    if (result.kind === "sentence") result.id = items[duplicateIndex].id;
    items.splice(duplicateIndex, 1);
  }
  items.unshift(result);
  await chrome.storage.local.set({ [key]: items.slice(0, maxLocalEntries) });
  return result;
}

export async function getLibrary() {
  const result = await chrome.storage.local.get([vocabularyKey, sentenceKey]);
  return {
    vocabulary: Array.isArray(result[vocabularyKey]) ? result[vocabularyKey] : [],
    sentences: Array.isArray(result[sentenceKey]) ? result[sentenceKey] : []
  };
}

export async function deleteResults(kind, ids) {
  const key = kind === "sentence" ? sentenceKey : vocabularyKey;
  const idSet = new Set(Array.isArray(ids) ? ids : []);
  const items = await readList(key);
  const remaining = items.filter((item) => !idSet.has(item.id));
  await chrome.storage.local.set({ [key]: remaining });
  return { deleted: items.length - remaining.length };
}

export async function syncSentenceCollocations(sentence) {
  if (!sentence?.id) throw new Error("Invalid sentence collocation source.");
  const items = (await readList(vocabularyKey)).filter((item) => item.sourceSentenceId !== sentence.id);
  const known = new Set(items.map((item) => item.normalizedText));
  const selected = (sentence.collocations ?? []).filter((item) => item.selected !== false && item.phrase);
  for (const [index, item] of selected.entries()) {
    const normalizedText = String(item.phrase).toLocaleLowerCase("en-US");
    if (known.has(normalizedText)) continue;
    known.add(normalizedText);
    items.unshift({
      id: `${sentence.id}:collocation:${index}`,
      kind: "vocabulary",
      text: String(item.phrase),
      normalizedText,
      entryType: "phrase",
      chineseDefinition: String(item.meaningZh ?? ""),
      meanings: [{ partOfSpeech: "phrase", definitionZh: String(item.meaningZh ?? "") }],
      sourceLanguage: sentence.sourceLanguage ?? "en",
      sourceSentenceId: sentence.id,
      source: sentence.source,
      createdAt: sentence.createdAt ?? new Date().toISOString()
    });
  }
  await chrome.storage.local.set({ [vocabularyKey]: items.slice(0, maxLocalEntries) });
  return { saved: selected.length };
}
