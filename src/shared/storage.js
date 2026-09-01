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

  if (duplicateIndex >= 0) items.splice(duplicateIndex, 1);
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
