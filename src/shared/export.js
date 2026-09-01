export function createLibraryJson(library) {
  return JSON.stringify({
    format: "english-reader-library",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    vocabulary: library.vocabulary ?? [],
    sentences: library.sentences ?? []
  }, null, 2);
}

export function createCsv(items) {
  const headers = ["type", "text", "translation", "source_title", "source_url", "created_at"];
  const rows = items.map((item) => [
    item.kind ?? "",
    item.text ?? "",
    item.kind === "sentence" ? item.translationZh ?? "" : item.chineseDefinition ?? "",
    item.source?.pageTitle ?? "",
    item.source?.pageUrl ?? "",
    item.createdAt ?? ""
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function escapeCsvCell(value) {
  const text = String(value).replace(/"/g, '""');
  return /[",\n\r]/.test(text) ? `"${text}"` : text;
}
