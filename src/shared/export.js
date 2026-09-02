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
  const headers = ["id", "sub_id", "type", "language", "text", "ipa", "translation", "numbered_meanings", "source"];
  const rows = items.flatMap((item, index) => {
    const id = index + 1;
    const source = sourceOrigin(item.source?.pageUrl);
    const parent = [
      id, 0, item.kind ?? "", item.sourceLanguage ?? "", item.text ?? "", item.ipa ?? "",
      item.kind === "sentence" ? item.translationZh ?? "" : item.chineseDefinition ?? "",
      (item.meanings ?? []).map((meaning, meaningIndex) => `${meaningIndex + 1}. ${meaning.partOfSpeech}: ${meaning.definitionZh ?? meaning.definitionEn ?? ""}`).join("\n"),
      source
    ];
    const collocations = (item.collocations ?? []).map(({ phrase, meaningZh }, collocationIndex) => [
      id, collocationIndex + 1, "fixed_collocation", item.sourceLanguage ?? "", phrase, "", meaningZh, "", source
    ]);
    return [parent, ...collocations];
  });
  const keptColumns = headers.map((_, index) => index).filter((index) => rows.some((row) => row[index] !== "" && row[index] != null));
  return [headers, ...rows].map((row) => keptColumns.map((index) => escapeCsvCell(row[index])).join(",")).join("\n");
}

export function createHtml(items, title = "English Reader 学习库") {
  const languageNames = { en: "英语", fr: "法语", de: "德语", ko: "韩语", es: "西班牙语", ja: "日语", it: "意大利语", pt: "葡萄牙语", ru: "俄语" };
  const cards = items.map((item) => {
    const language = languageNames[item.sourceLanguage] ?? item.sourceLanguage ?? "英语";
    const detail = item.meanings?.length
      ? `<ol class="meanings translation">${item.meanings.map((meaning) => `<li><strong>${escapeHtml(partName(meaning.partOfSpeech))}</strong> ${escapeHtml(meaning.definitionZh ?? meaning.definitionEn ?? "")}</li>`).join("")}</ol>`
      : `<p class="translation">${escapeHtml(item.kind === "sentence" ? item.translationZh ?? "" : item.chineseDefinition ?? "")}</p>`;
    const ipa = item.ipa ? `<p class="ipa">${escapeHtml(item.ipa)}</p>` : "";
    const collocations = item.collocations?.length ? `<div class="collocations"><strong>固定搭配</strong><ul>${item.collocations.map(({ phrase, meaningZh }) => `<li><strong>${escapeHtml(phrase)}</strong><span class="translation"> — ${escapeHtml(meaningZh)}</span></li>`).join("")}</ul></div>` : "";
    const date = item.createdAt ? new Date(item.createdAt).toLocaleString("zh-CN") : "";
    const sourceUrl = safeHttpUrl(item.source?.pageUrl);
    const sourceTitle = item.source?.pageTitle ? sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source.pageTitle)}</a>` : escapeHtml(item.source.pageTitle) : "";
    const meta = [escapeHtml(language), sourceTitle, escapeHtml(date)].filter(Boolean).join(" · ");
    return `<article class="item"><h2>${escapeHtml(item.text ?? "")}</h2>${detail}${ipa}${collocations}<p class="meta">${meta}</p></article>`;
  }).join("\n");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>:root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{max-width:860px;margin:0 auto;padding:24px;background:#f5f1e8;color:#25231e}header{margin:-24px -24px 20px;padding:24px;background:#173f35;color:white}header p{margin:6px 0 0;color:#d8e6df}button{margin-top:12px;border:0;border-radius:8px;padding:8px 12px;background:#e4ded0;cursor:pointer}.item{margin:10px 0;padding:16px;border:1px solid #ddd5c6;border-radius:12px;background:#fffdf8}.item h2{margin:0 0 8px;font-size:18px}.item p{color:#625d53}.ipa{color:#355f50;font-family:Georgia,serif}.meanings{padding-left:24px}.collocations{margin-top:12px;color:#355f50}.collocations ul{margin:5px 0;padding-left:22px}.meta{color:#938b7d!important;font-size:11px}.translations-hidden .translation{display:none}</style></head><body><header><h1>${escapeHtml(title)}</h1><p>${items.length} 条当前筛选记录</p><button id="toggle">隐藏翻译</button></header><main>${cards || "<p>没有学习记录。</p>"}</main><script>document.getElementById("toggle").onclick=function(){var hidden=document.body.classList.toggle("translations-hidden");this.textContent=hidden?"显示翻译":"隐藏翻译"}</script></body></html>`;
}

function sourceOrigin(value) {
  try {
    return new URL(value).origin;
  } catch (_error) {
    return "";
  }
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (_error) {
    return "";
  }
}

function partName(value) {
  return ({ preferred: "首选释义", contextPhrase: "语境短语", noun: "名词", verb: "动词", adjective: "形容词", adverb: "副词", phrase: "短语" })[value] ?? value ?? "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function escapeCsvCell(value) {
  const text = String(value).replace(/"/g, '""');
  return /[",\n\r]/.test(text) ? `"${text}"` : text;
}
