// ==UserScript==
// @name         English Reader for Stay
// @namespace    https://github.com/ShangqiJIN/english-reader
// @version      0.1.0
// @description  Select English text in Safari to translate, listen, and save it locally.
// @author       ShangqiJIN
// @match        http://*/*
// @match        https://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      translate.googleapis.com
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(() => {
  "use strict";

  const storageKey = "english-reader-library-v1";
  const maxEntries = 1000;
  const selectionLimit = 5000;
  const collocationRules = [
    ["according to", "根据；按照"], ["as a result", "因此；结果"], ["as well as", "以及；也"],
    ["be able to", "能够"], ["be based on", "基于"], ["be responsible for", "负责"],
    ["because of", "因为；由于"], ["carry out", "执行；开展"], ["come up with", "提出；想出"],
    ["depend on", "取决于"], ["due to", "由于"], ["even though", "即使；尽管"],
    ["figure out", "弄清楚；解决"], ["focus on", "专注于"], ["in addition to", "除……之外还"],
    ["in order to", "为了"], ["in terms of", "就……而言"], ["lead to", "导致"],
    ["make use of", "利用"], ["rather than", "而不是"], ["refer to", "指的是；提到"],
    ["result in", "导致"], ["take advantage of", "利用"], ["take into account", "把……考虑在内"],
    ["with regard to", "关于"]
  ];

  const host = document.createElement("div");
  host.id = "english-reader-stay-root";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .card { position: fixed; z-index: 2147483647; left: 12px; right: 12px; bottom: max(14px, env(safe-area-inset-bottom));
      max-height: min(62vh, 520px); overflow: auto; box-sizing: border-box; padding: 17px;
      border: 1px solid #d7d4ca; border-radius: 18px; background: #fffdf7; color: #24221d;
      box-shadow: 0 12px 42px rgba(37,31,19,.25); font: 16px/1.55 -apple-system, BlinkMacSystemFont, sans-serif; }
    .hidden { display: none; } .top { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .actions { display:flex; gap:8px; } .label { color:#796e5b; font-size:13px; font-weight:700; letter-spacing:.08em; }
    h2 { margin:7px 0 10px; font-size:24px; line-height:1.3; overflow-wrap:anywhere; }
    h2 strong { color:#17634d; text-decoration:underline; text-decoration-color:#a8cdbc; text-underline-offset:3px; }
    p { margin:8px 0; } ol { margin:8px 0; padding-left:24px; }
    button { min-width:42px; min-height:38px; border:0; border-radius:12px; padding:7px 10px; background:#ebe5d7; color:#24221d; font-size:18px; }
    .speaker { width:22px; height:22px; display:block; fill:#5d5a53; } .muted { color:#716a5e; font-size:13px; }
    .saved { color:#347453; font-size:13px; font-weight:700; } .error { color:#8d3b32; }
    .library { position:fixed; z-index:2147483647; inset:0; overflow:auto; box-sizing:border-box; padding:20px 14px max(30px,env(safe-area-inset-bottom)); background:#f6f2e8; color:#24221d; font:15px/1.5 -apple-system,BlinkMacSystemFont,sans-serif; }
    .library header { display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; background:#f6f2e8; padding:8px 0; }
    .library article { background:#fffdf7; border:1px solid #ddd6c7; border-radius:14px; margin:10px 0; padding:13px; }
    .library article h3 { margin:0 0 5px; font-size:17px; } .library .row { display:flex; gap:8px; flex-wrap:wrap; }
  `;
  const card = document.createElement("section");
  card.className = "card hidden";
  const libraryPanel = document.createElement("section");
  libraryPanel.className = "library hidden";
  shadow.append(style, card, libraryPanel);
  document.documentElement.appendChild(host);

  let armed = true;
  let timer = 0;
  let serial = 0;

  document.addEventListener("pointerdown", (event) => {
    if (event.composedPath().includes(host)) return;
    armed = true;
    window.clearTimeout(timer);
    hideCard();
  }, true);
  document.addEventListener("pointerup", (event) => {
    if (event.composedPath().includes(host)) return;
    schedule(160);
  }, true);
  document.addEventListener("selectionchange", () => {
    if (armed) schedule(350);
  });

  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("English Reader：打开学习库", openLibrary);
    GM_registerMenuCommand("English Reader：导出学习库", exportLibrary);
  }

  function schedule(delay) {
    window.clearTimeout(timer);
    timer = window.setTimeout(readSelection, delay);
  }

  function readSelection() {
    if (!armed) return;
    const selection = window.getSelection();
    const text = normalize(selection?.toString());
    if (!text || text.length > selectionLimit || selectionInsideUi(selection)) return;
    armed = false;
    analyze(text);
  }

  function selectionInsideUi(selection) {
    return [selection?.anchorNode, selection?.focusNode].some((node) => node?.getRootNode?.() === shadow);
  }

  async function analyze(text) {
    const current = ++serial;
    renderLoading(text);
    try {
      const translation = await googleTranslate(text, "en", "zh-CN");
      if (current !== serial) return;
      const result = createResult(text, translation);
      await saveResult(result);
      renderResult(result);
    } catch (error) {
      if (current !== serial) return;
      renderError(text, error?.message || "翻译请求失败，请稍后重试。");
    }
  }

  function googleTranslate(text, sourceLanguage, targetLanguage) {
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t"
      + `&sl=${encodeURIComponent(sourceLanguage)}&tl=${encodeURIComponent(targetLanguage)}`
      + `&q=${encodeURIComponent(text)}`;
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: 12000,
        headers: { Accept: "application/json" },
        onload(response) {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(`Google 翻译返回错误（${response.status}）。`));
            return;
          }
          try {
            const payload = JSON.parse(response.responseText);
            const translated = Array.isArray(payload?.[0])
              ? payload[0].map((part) => part?.[0] || "").join("")
              : "";
            if (!translated) throw new Error("翻译结果为空。");
            resolve(translated);
          } catch (error) {
            reject(new Error(error?.message || "无法读取 Google 翻译结果。"));
          }
        },
        ontimeout() { reject(new Error("Google 翻译连接超时。")); },
        onerror() { reject(new Error("无法连接 Google 翻译；请检查网络或代理。")); }
      });
    });
  }

  function createResult(text, translation) {
    const sentence = classify(text) === "sentence";
    const base = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind: sentence ? "sentence" : "vocabulary",
      text,
      createdAt: new Date().toISOString(),
      translationProvider: "google-web-experimental",
      source: { pageUrl: location.href, pageTitle: document.title }
    };
    if (!sentence) return {
      ...base,
      normalizedText: text.toLocaleLowerCase("en-US"),
      entryType: text.includes(" ") ? "phrase" : "word",
      chineseDefinition: translation
    };
    return {
      ...base,
      translationZh: translation,
      segments: text.split(/(?<=[,;:])\s+|\s+(?=(?:and|but|because|although|which|that|who|when|if)\b)/i).filter(Boolean),
      collocations: detectCollocations(text)
    };
  }

  function classify(text) {
    return text.split(" ").length >= 7 || /[.!?]["'\u201d\u2019)]?$/.test(text) ? "sentence" : "vocabulary";
  }

  function detectCollocations(text) {
    const lower = text.toLocaleLowerCase("en-US");
    return collocationRules.filter(([phrase]) => lower.includes(phrase))
      .map(([phrase, meaningZh]) => ({ phrase, meaningZh }));
  }

  async function readLibrary() {
    const value = await Promise.resolve(GM_getValue(storageKey, { vocabulary: [], sentences: [] }));
    return value && typeof value === "object"
      ? { vocabulary: value.vocabulary || [], sentences: value.sentences || [] }
      : { vocabulary: [], sentences: [] };
  }

  async function saveResult(result) {
    const library = await readLibrary();
    const key = result.kind === "sentence" ? "sentences" : "vocabulary";
    const duplicate = library[key].findIndex((item) => result.kind === "sentence"
      ? item.text === result.text
      : item.normalizedText === result.normalizedText);
    if (duplicate >= 0) library[key].splice(duplicate, 1);
    library[key].unshift(result);
    library[key] = library[key].slice(0, maxEntries);
    await Promise.resolve(GM_setValue(storageKey, library));
  }

  function renderLoading(text) {
    card.classList.remove("hidden");
    card.replaceChildren(header("正在翻译", text), heading(text), paragraph("正在连接 Google 网页翻译…", "muted"),
      paragraph("所选文本将发送给 Google。", "muted"));
  }

  function renderResult(result) {
    const fragment = document.createDocumentFragment();
    fragment.append(header(result.kind === "sentence" ? "长难句" : result.entryType === "phrase" ? "短语" : "单词", result.text));
    fragment.append(highlightedHeading(result.text, result.collocations || []));
    fragment.append(paragraph(result.kind === "sentence" ? result.translationZh : result.chineseDefinition));
    if (result.kind === "sentence" && result.segments.length > 1) {
      const list = document.createElement("ol");
      result.segments.forEach((segment) => { const item = document.createElement("li"); item.textContent = segment; list.appendChild(item); });
      fragment.appendChild(list);
    }
    if (result.collocations?.length) {
      fragment.append(paragraph("固定搭配", "label"));
      const list = document.createElement("ol");
      result.collocations.forEach(({ phrase, meaningZh }) => { const item = document.createElement("li"); item.textContent = `${phrase} — ${meaningZh}`; list.appendChild(item); });
      fragment.appendChild(list);
    }
    fragment.append(paragraph("已保存到 Stay 本地学习库", "saved"), paragraph("翻译来源：Google Web（实验性）", "muted"));
    card.replaceChildren(fragment);
  }

  function renderError(text, message) {
    card.classList.remove("hidden");
    card.replaceChildren(header("翻译失败", text), heading(text), paragraph(message, "error"), paragraph("本次内容没有保存。", "muted"));
  }

  async function openLibrary() {
    const library = await readLibrary();
    libraryPanel.classList.remove("hidden");
    const title = document.createElement("h2");
    title.textContent = `学习库（${library.vocabulary.length} 个词语 · ${library.sentences.length} 个句子）`;
    const close = button("关闭", () => libraryPanel.classList.add("hidden"));
    const exportButton = button("导出 JSON", () => exportLibrary(library));
    const headerNode = document.createElement("header");
    const actions = document.createElement("div"); actions.className = "row"; actions.append(exportButton, close);
    headerNode.append(title, actions);
    const fragment = document.createDocumentFragment(); fragment.appendChild(headerNode);
    [...library.vocabulary, ...library.sentences].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).forEach((item) => {
      const article = document.createElement("article");
      const headingNode = document.createElement("h3"); headingNode.textContent = item.text;
      const detail = paragraph(item.kind === "sentence" ? item.translationZh : item.chineseDefinition);
      const remove = button("删除", async () => { await deleteResult(item.id); openLibrary(); });
      article.append(headingNode, detail, remove); fragment.appendChild(article);
    });
    libraryPanel.replaceChildren(fragment);
  }

  async function deleteResult(id) {
    const library = await readLibrary();
    library.vocabulary = library.vocabulary.filter((item) => item.id !== id);
    library.sentences = library.sentences.filter((item) => item.id !== id);
    await Promise.resolve(GM_setValue(storageKey, library));
  }

  async function exportLibrary(existingLibrary) {
    const library = existingLibrary || await readLibrary();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...library }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `english-reader-stay-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function header(label, speechText) {
    const row = document.createElement("div"); row.className = "top";
    const title = document.createElement("span"); title.className = "label"; title.textContent = label;
    const actions = document.createElement("div"); actions.className = "actions";
    actions.append(button("朗读", () => speak(speechText), true), button("×", hideCard));
    row.append(title, actions); return row;
  }

  function button(label, action, speaker = false) {
    const node = document.createElement("button"); node.type = "button"; node.title = label; node.setAttribute("aria-label", label);
    if (speaker) node.appendChild(speakerIcon()); else node.textContent = label;
    node.addEventListener("click", action); return node;
  }

  function speakerIcon() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg"); svg.setAttribute("viewBox", "0 0 24 24"); svg.classList.add("speaker");
    ["M3 9v6h4l5 4V5L7 9H3z", "M14 8.5v2.1a2 2 0 0 1 0 2.8v2.1a5 5 0 0 0 0-7zm0-4v2.05a7 7 0 0 1 0 10.9v2.05a9 9 0 0 0 0-15z"].forEach((path) => {
      const node = document.createElementNS(ns, "path"); node.setAttribute("d", path); svg.appendChild(node);
    });
    return svg;
  }

  function highlightedHeading(text, collocations) {
    const node = heading("");
    const phrases = collocations.map((item) => item.phrase).sort((a, b) => b.length - a.length);
    if (!phrases.length) { node.textContent = text; return node; }
    const pattern = new RegExp(`(${phrases.map(escapeRegExp).join("|")})`, "gi");
    text.split(pattern).filter(Boolean).forEach((part) => {
      const child = document.createElement(phrases.some((phrase) => phrase.toLowerCase() === part.toLowerCase()) ? "strong" : "span");
      child.textContent = part; node.appendChild(child);
    });
    return node;
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "en-US"; utterance.rate = text.includes(" ") ? .88 : .8;
    window.speechSynthesis.speak(utterance);
  }

  function hideCard() { serial += 1; card.classList.add("hidden"); }
  function normalize(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
  function escapeRegExp(text) { return text.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"); }
  function heading(text) { const node = document.createElement("h2"); node.textContent = text; return node; }
  function paragraph(text, className = "") { const node = document.createElement("p"); node.className = className; node.textContent = text; return node; }
})();
