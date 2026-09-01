import { createCsv, createLibraryJson } from "../shared/export.js";

let library = { vocabulary: [], sentences: [] };
let activeTab = "vocabulary";
let searchQuery = "";
let activeLanguage = "all";
let visibleItems = [];
const selectedIds = new Set();
const languageNames = { en: "英语", fr: "法语", de: "德语", ko: "韩语", es: "西班牙语", ja: "日语", it: "意大利语", pt: "葡萄牙语", ru: "俄语" };

document.querySelectorAll("nav button").forEach((button) => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.tab;
    selectedIds.clear();
    document.querySelectorAll("nav button").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

document.querySelector("#search").addEventListener("input", (event) => {
  searchQuery = event.target.value.trim().toLocaleLowerCase();
  selectedIds.clear();
  render();
});

document.querySelector("#language-filter").addEventListener("change", (event) => {
  activeLanguage = event.target.value;
  selectedIds.clear();
  render();
});

document.querySelector("#select-all").addEventListener("click", () => {
  const allSelected = visibleItems.length > 0 && visibleItems.every((item) => selectedIds.has(item.id));
  visibleItems.forEach((item) => allSelected ? selectedIds.delete(item.id) : selectedIds.add(item.id));
  render();
});

document.querySelector("#export-json").addEventListener("click", () => {
  downloadText(createLibraryJson(library), exportFilename("json"), "application/json");
  setNotice("已生成完整 JSON 备份。");
});

document.querySelector("#export-csv").addEventListener("click", () => {
  downloadText(createCsv(visibleItems), exportFilename("csv"), "text/csv;charset=utf-8");
  setNotice(`已导出当前显示的 ${visibleItems.length} 条记录。`);
});

document.querySelector("#delete-selected").addEventListener("click", async () => {
  if (!selectedIds.size) return;
  const count = selectedIds.size;
  if (!window.confirm(`确定从学习库删除选中的 ${count} 条记录吗？请先导出备份；此操作无法在插件内撤销。`)) return;
  const response = await chrome.runtime.sendMessage({
    type: "delete-library-items",
    payload: {
      kind: activeTab === "sentences" ? "sentence" : "vocabulary",
      ids: [...selectedIds]
    }
  });
  if (!response?.ok) {
    setNotice(response?.error ?? "删除失败。", true);
    return;
  }
  selectedIds.clear();
  setNotice(`已删除 ${response.summary.deleted} 条记录。`);
  await load();
});

chrome.storage.onChanged.addListener(load);
load();

async function load() {
  const response = await chrome.runtime.sendMessage({ type: "get-library" });
  if (!response?.ok) {
    setNotice(response?.error ?? "无法读取学习库。", true);
    return;
  }
  library = response.library;
  const existingIds = new Set([...library.vocabulary, ...library.sentences].map((item) => item.id));
  [...selectedIds].forEach((id) => {
    if (!existingIds.has(id)) selectedIds.delete(id);
  });
  document.querySelector("#summary").textContent =
    `${library.vocabulary.length} 个词语 · ${library.sentences.length} 个句子`;
  updateLanguageFilter();
  render();
}

function itemLanguage(item) {
  return item.sourceLanguage || "en";
}

function languageLabel(code) {
  return languageNames[code] ?? `其他语言（${code}）`;
}

function updateLanguageFilter() {
  const select = document.querySelector("#language-filter");
  const counts = new Map();
  [...library.vocabulary, ...library.sentences].forEach((item) => {
    const language = itemLanguage(item);
    counts.set(language, (counts.get(language) || 0) + 1);
  });
  const available = [...counts.keys()].sort((a, b) => languageLabel(a).localeCompare(languageLabel(b), "zh-CN"));
  if (activeLanguage !== "all" && !counts.has(activeLanguage)) activeLanguage = "all";
  select.replaceChildren(new Option("全部语言", "all"));
  available.forEach((language) => select.appendChild(new Option(`${languageLabel(language)}（${counts.get(language)}）`, language)));
  select.value = activeLanguage;
}

function render() {
  const list = document.querySelector("#list");
  visibleItems = (library[activeTab] ?? []).filter((item) => {
    if (activeLanguage !== "all" && itemLanguage(item) !== activeLanguage) return false;
    if (!searchQuery) return true;
    const searchable = [
      item.text,
      item.chineseDefinition,
      item.translationZh,
      item.sourceLanguage,
      item.source?.pageTitle,
      ...(item.collocations ?? []).flatMap((entry) => [entry.phrase, entry.meaningZh])
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return searchable.includes(searchQuery);
  });

  list.replaceChildren();
  updateSelectionControls();

  if (!visibleItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = searchQuery
      ? "没有找到匹配的学习记录。"
      : activeTab === "vocabulary"
        ? "在网页中选择英文词语后，它会出现在这里。"
        : "选择一个英文句子开始分析。";
    list.appendChild(empty);
    return;
  }

  let renderedLanguage = "";
  const groupedItems = [...visibleItems].sort((a, b) => {
    const languageOrder = languageLabel(itemLanguage(a)).localeCompare(languageLabel(itemLanguage(b)), "zh-CN");
    return languageOrder || String(b.createdAt).localeCompare(String(a.createdAt));
  });
  groupedItems.forEach((item) => {
    const itemLanguageCode = itemLanguage(item);
    if (itemLanguageCode !== renderedLanguage) {
      renderedLanguage = itemLanguageCode;
      const group = document.createElement("h2");
      group.className = "language-group";
      const count = groupedItems.filter((candidate) => itemLanguage(candidate) === itemLanguageCode).length;
      group.textContent = `${languageLabel(itemLanguageCode)} · ${count}`;
      list.appendChild(group);
    }
    const article = document.createElement("article");
    article.className = "item";
    const head = document.createElement("div");
    head.className = "item-head";
    const selection = document.createElement("label");
    selection.className = "item-select";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedIds.has(item.id);
    checkbox.setAttribute("aria-label", `选择 ${item.text}`);
    checkbox.addEventListener("change", () => {
      checkbox.checked ? selectedIds.add(item.id) : selectedIds.delete(item.id);
      updateSelectionControls();
    });
    const title = document.createElement("h2");
    title.textContent = item.text;
    selection.append(checkbox, title);
    const speak = document.createElement("button");
    speak.className = "speak";
    speak.appendChild(createSpeakerIcon());
    speak.title = "朗读原文";
    speak.setAttribute("aria-label", "朗读原文");
    speak.addEventListener("click", () => speakText(item.text, item.sourceLanguage || "en"));
    head.append(selection, speak);
    const detail = document.createElement("p");
    detail.textContent = item.kind === "sentence" ? item.translationZh : item.chineseDefinition;
    article.append(head, detail);
    if (item.collocations?.length) {
      const collocations = document.createElement("ul");
      collocations.className = "collocations";
      item.collocations.forEach(({ phrase, meaningZh }) => {
        const row = document.createElement("li");
        const strong = document.createElement("strong");
        strong.textContent = phrase;
        row.append(strong, document.createTextNode(" — " + meaningZh));
        collocations.appendChild(row);
      });
      article.appendChild(collocations);
    }
    const meta = document.createElement("p");
    meta.className = "meta";
    const date = item.createdAt ? new Date(item.createdAt).toLocaleString("zh-CN") : "时间未知";
    const language = languageLabel(itemLanguage(item));
    meta.textContent = [language, item.source?.pageTitle, date].filter(Boolean).join(" · ");
    article.appendChild(meta);
    list.appendChild(article);
  });
}

function updateSelectionControls() {
  const selectedVisible = visibleItems.filter((item) => selectedIds.has(item.id)).length;
  const selectAll = document.querySelector("#select-all");
  selectAll.disabled = visibleItems.length === 0;
  selectAll.textContent = selectedVisible === visibleItems.length && visibleItems.length
    ? "取消全选"
    : "全选当前结果";
  const deleteButton = document.querySelector("#delete-selected");
  deleteButton.disabled = selectedIds.size === 0;
  deleteButton.textContent = selectedIds.size ? `删除选中项（${selectedIds.size}）` : "删除选中项";
}

function createSpeakerIcon() {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const speaker = document.createElementNS(namespace, "path");
  speaker.setAttribute("d", "M3 9v6h4l5 4V5L7 9H3z");
  const waves = document.createElementNS(namespace, "path");
  waves.setAttribute("d", "M14 8.5v2.1a2 2 0 0 1 0 2.8v2.1a5 5 0 0 0 0-7zm0-4v2.05a7 7 0 0 1 0 10.9v2.05a9 9 0 0 0 0-15z");
  svg.append(speaker, waves);
  return svg;
}

function downloadText(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportFilename(extension) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `english-reader-${activeTab}-${stamp}.${extension}`;
}

function setNotice(message, isError = false) {
  const notice = document.querySelector("#notice");
  notice.textContent = message;
  notice.style.color = isError ? "#8d3b32" : "#347453";
}

function speakText(text, language = "en") {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voiceLocales = { en: "en-US", fr: "fr-FR", de: "de-DE", ko: "ko-KR", es: "es-ES", ja: "ja-JP", it: "it-IT", pt: "pt-PT", ru: "ru-RU" };
  utterance.lang = voiceLocales[language] ?? language;
  const sentenceRates = { ko: 0.92, ja: 0.9, de: 0.9, fr: 0.92, en: 0.88 };
  const wordRates = { ko: 0.82, ja: 0.82, de: 0.8, fr: 0.82, en: 0.8 };
  utterance.rate = text.includes(" ") ? (sentenceRates[language] ?? 0.9) : (wordRates[language] ?? 0.82);
  utterance.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const requestedLocale = utterance.lang.toLocaleLowerCase();
  const matchingVoices = voices.filter((voice) => voice.lang.toLocaleLowerCase().startsWith(language));
  utterance.voice = matchingVoices.sort((a, b) => voiceScore(b, requestedLocale, language) - voiceScore(a, requestedLocale, language))[0] ?? null;
  window.speechSynthesis.speak(utterance);
}

function voiceScore(voice, requestedLocale, language) {
  const locale = voice.lang.toLocaleLowerCase();
  const preferredNames = { ko: ["yuna"], ja: ["kyoko", "otoya"], de: ["anna"], fr: ["amelie", "thomas"], en: ["samantha", "alex"] };
  const preferred = (preferredNames[language] || []).some((name) => voice.name.toLocaleLowerCase().includes(name));
  return (locale === requestedLocale ? 100 : 0) + (preferred ? 60 : 0) + (voice.localService ? 20 : 0) + (voice.default ? 5 : 0);
}
