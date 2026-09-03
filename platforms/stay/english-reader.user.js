// ==UserScript==
// @name         English Reader for Stay
// @namespace    https://github.com/ShangqiJIN/english-reader
// @version      0.3.7
// @description  Select English text in Safari to translate, listen, and save it locally.
// @author       ShangqiJIN
// @match        http://*/*
// @match        https://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      translate.googleapis.com
// @connect      translate.google.com
// @connect      api.deepseek.com
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(() => {
  "use strict";

  const storageKey = "english-reader-library-v1";
  const settingsKey = "english-reader-settings-v1";
  const maxEntries = 1000;
  const selectionLimit = 5000;
  const host = document.createElement("div");
  host.id = "english-reader-stay-root";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .card { position: fixed; z-index: 2147483647; width: min(300px, calc(100vw - 24px)); right: 12px; bottom: max(10px, env(safe-area-inset-bottom));
      max-height: min(44vh, 360px); overflow: auto; box-sizing: border-box; padding: 10px;
      border: 1px solid #d7d4ca; border-radius: 14px; background: #fffdf7; color: #24221d;
      box-shadow: 0 10px 32px rgba(37,31,19,.22); font: 12px/1.4 -apple-system, BlinkMacSystemFont, sans-serif; }
    .card.sentence-card { width:min(66.667vw,520px); }
    @media (max-width:480px) { .card.sentence-card { width:calc(100vw - 24px); } }
    .hidden { display: none; } .top { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .actions { display:flex; gap:5px; } .label { color:#796e5b; font-size:11px; font-weight:700; letter-spacing:.06em; }
    h2 { margin:4px 0 6px; font-size:16px; line-height:1.25; overflow-wrap:anywhere; }
    h2 strong { color:#17634d; text-decoration:underline; text-decoration-color:#a8cdbc; text-underline-offset:3px; }
    p { margin:5px 0; } ol { margin:6px 0; padding-left:21px; }
    button { min-width:30px; min-height:28px; border:0; border-radius:8px; padding:4px 7px; background:#ebe5d7; color:#24221d; font-size:12px; }
    .speaker { width:16px; height:16px; display:block; fill:#5d5a53; } .muted { color:#716a5e; font-size:10px; }
    .saved { color:#347453; font-size:10px; font-weight:700; } .error { color:#8d3b32; }
    .library { position:fixed; z-index:2147483647; inset:0; overflow:auto; box-sizing:border-box; padding:10px 8px max(20px,env(safe-area-inset-bottom)); background:#f6f2e8; color:#24221d; font:12px/1.4 -apple-system,BlinkMacSystemFont,sans-serif; }
    .library header { display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; background:#f6f2e8; padding:8px 0; }
    .library article { background:#fffdf7; border:1px solid #ddd6c7; border-radius:11px; margin:7px 0; padding:10px; }
    .library article h3 { margin:0 0 4px; font-size:13px; } .library .row { display:flex; gap:5px; flex-wrap:wrap; }
    .library input[type="search"] { width:100%; padding:10px; border:1px solid #ccc3b4; border-radius:10px; font-size:16px; }
    .library-bar { display:flex; align-items:center; gap:5px; margin:7px 0; }
    .library-bar input[type="search"] { flex:1; min-width:0; padding:7px; font-size:13px; }
    .library-tabs button { flex:1; } .library-tabs .active { background:#17634d; color:white; }
    .translations-hidden .translation { display:none; }
    .fab { position:fixed; z-index:2147483646; left:10px; bottom:max(86px,calc(env(safe-area-inset-bottom) + 56px)); width:38px; height:38px; min-width:38px; padding:0; border-radius:50%; background:#17634d; color:white; box-shadow:0 5px 16px rgba(0,0,0,.24); font:bold 11px/38px -apple-system,BlinkMacSystemFont,sans-serif; }
    .controls { position:fixed; z-index:2147483647; left:10px; bottom:max(132px,calc(env(safe-area-inset-bottom) + 102px)); width:190px; box-sizing:border-box; padding:10px; border:1px solid #d7d4ca; border-radius:12px; background:#fffdf7; color:#24221d; box-shadow:0 8px 26px rgba(37,31,19,.22); font:12px/1.4 -apple-system,BlinkMacSystemFont,sans-serif; }
    .controls-title { display:flex; align-items:center; justify-content:space-between; margin-bottom:7px; font-weight:700; }
    .controls-title input { width:34px; height:20px; margin:0; accent-color:#17634d; }
    .controls .row { display:flex; flex-wrap:wrap; gap:5px; }
    .controls select { min-height:28px; border:0; border-radius:8px; padding:4px 7px; background:#ebe5d7; color:#24221d; font-size:12px; }
  `;
  const card = document.createElement("section");
  card.className = "card hidden";
  const libraryPanel = document.createElement("section");
  libraryPanel.className = "library hidden";
  const controls = document.createElement("section");
  controls.className = "controls hidden";
  const fab = document.createElement("button");
  fab.className = "fab"; fab.type = "button"; fab.textContent = "ER"; fab.setAttribute("aria-label", "English Reader 菜单");
  shadow.append(style, card, libraryPanel, controls, fab);
  document.documentElement.appendChild(host);

  let armed = true;
  let timer = 0;
  let serial = 0;
  let enabled = true;

  Promise.resolve(GM_getValue(settingsKey, {})).then((settings) => { enabled = settings.enabled !== false; renderControls(); });
  fab.addEventListener("click", () => { controls.classList.toggle("hidden"); if (!controls.classList.contains("hidden")) renderControls(); });

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
    GM_registerMenuCommand("English Reader：导出 JSON", exportLibrary);
    GM_registerMenuCommand("English Reader：导入 JSON", importLibrary);
    GM_registerMenuCommand("English Reader：设置 DeepSeek", configureDeepSeek);
    GM_registerMenuCommand("English Reader：开关", toggleEnabled);
  }

  function schedule(delay) {
    window.clearTimeout(timer);
    timer = window.setTimeout(readSelection, delay);
  }

  function readSelection() {
    if (!armed || !enabled) return;
    const selection = window.getSelection();
    const text = normalize(selection?.toString());
    if (!text || text.length > selectionLimit || selectionInsideUi(selection)) return;
    armed = false;
    analyze(text, getWordWindow(selection.getRangeAt(0)));
  }

  function selectionInsideUi(selection) {
    return [selection?.anchorNode, selection?.focusNode].some((node) => node?.getRootNode?.() === shadow);
  }

  async function analyze(text, wordWindow) {
    const current = ++serial;
    const settings = await Promise.resolve(GM_getValue(settingsKey, {}));
    let providerWarning = "";
    const provider = settings.translationProvider || (settings.deepseekApiKey ? "deepseek" : "google");
    if (provider === "deepseek" && settings.deepseekApiKey) {
      renderLoading(text, "DeepSeek");
      const result = createResult(text, ""); result.wordWindow = wordWindow;
      const enhanced = await enhanceWithDeepSeek(result, settings.deepseekApiKey, current);
      if (enhanced.ok || current !== serial) return;
      providerWarning = `DeepSeek 调用失败（${enhanced.error}），已回退 Google。`;
    }
    renderLoading(text, "Google");
    try {
      const translation = await googleTranslate(text, "en", "zh-CN");
      if (current !== serial) return;
      const result = createResult(text, translation);
      result.wordWindow = wordWindow;
      result.providerWarning = providerWarning;
      await saveResult(result);
      if (result.kind === "sentence") await syncCollocations(result);
      renderResult(result);
    } catch (error) {
      if (current !== serial) return;
      renderError(text, error?.message || "翻译请求失败，请稍后重试。");
    }
  }

  async function enhanceWithDeepSeek(result, apiKey, current) {
    try {
      const sentence = result.kind === "sentence";
      const context = [...(result.wordWindow?.before || []), result.text, ...(result.wordWindow?.after || [])].join(" ");
      const prompt = sentence
        ? 'Return JSON {"translationZh":"中文翻译","segments":["verbatim English clause"],"collocations":[{"phrase":"verbatim fixed expression","meaningZh":"中文含义"}]}. Use 2–4 complete clauses; do not split lists or short phrases. Include only established expressions present verbatim in the sentence.'
        : result.entryType === "phrase"
          ? 'Return JSON {"meanings":[{"partOfSpeech":"phrase","definitionZh":"完整短语在上下文中的中文含义"}]}. Explain the complete phrase, not individual words.'
          : 'Return JSON {"meanings":[{"partOfSpeech":"词性","definitionZh":"语境中最贴切的中文义"}]}. Return at most two distinct ordinary meanings, with the contextual meaning first.';
      const parsed = await deepSeek(prompt, { selectedText: result.text, nearbyContext: context }, apiKey);
      if (current !== serial) return;
      if (sentence) {
        if (!parsed.translationZh) throw new Error("没有返回句子翻译");
        result.translationZh = parsed.translationZh;
        const segments = (parsed.segments || []).map(normalize).filter((part) => part && result.text.toLowerCase().includes(part.toLowerCase()));
        if (segments.length > 1 && segments.length <= 4) result.segments = segments;
        result.collocations = (parsed.collocations || []).filter((item) => item.phrase && item.meaningZh && result.text.toLowerCase().includes(item.phrase.toLowerCase()));
      } else if (parsed.meanings?.length) {
        result.meanings = parsed.meanings.slice(0, result.entryType === "phrase" ? 1 : 2);
        result.chineseDefinition = result.meanings[0].definitionZh;
      } else throw new Error("没有返回词义");
      result.translationProvider = "deepseek";
      await saveResult(result);
      if (result.kind === "sentence") await syncCollocations(result);
      renderResult(result);
      return { ok: true };
    } catch (error) { return { ok: false, error: error?.message || "连接失败" }; }
  }

  function deepSeek(system, payload, apiKey) {
    return new Promise((resolve, reject) => gmRequest({
      method: "POST", url: "https://api.deepseek.com/chat/completions", timeout: 30000,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      data: JSON.stringify({ model: "deepseek-v4-flash", thinking: { type: "disabled" }, max_tokens: 600, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify(payload) }] }),
      onload(response) { try { if (response.status !== 200) throw new Error(String(response.status)); resolve(JSON.parse(JSON.parse(response.responseText).choices[0].message.content)); } catch (error) { reject(error); } },
      ontimeout() { reject(new Error("连接超时")); },
      onerror(response) { reject(new Error(response?.status ? `HTTP ${response.status}` : "网络或网站权限")); }
    }));
  }

  function gmRequest(options) {
    if (typeof GM !== "undefined" && typeof GM.xmlHttpRequest === "function") {
      return GM.xmlHttpRequest(options);
    }
    return GM_xmlhttpRequest(options);
  }

  function googleTranslate(text, sourceLanguage, targetLanguage) {
    const query = `/translate_a/single?client=gtx&dt=t&sl=${encodeURIComponent(sourceLanguage)}&tl=${encodeURIComponent(targetLanguage)}&q=${encodeURIComponent(text)}`;
    return googleRequest(`https://translate.google.com${query}`)
      .catch(() => googleRequest(`https://translate.googleapis.com${query}`));
  }

  function googleRequest(url) {
    return new Promise((resolve, reject) => {
      gmRequest({
        method: "GET",
        url,
        timeout: 7000,
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
      collocations: []
    };
  }

  function classify(text) {
    return text.split(" ").length >= 7 || /[.!?]["'\u201d\u2019)]?$/.test(text) ? "sentence" : "vocabulary";
  }

  function getWordWindow(range) {
    try {
      const before = document.createRange(); before.selectNodeContents(document.body); before.setEnd(range.startContainer, range.startOffset);
      const after = document.createRange(); after.selectNodeContents(document.body); after.setStart(range.endContainer, range.endOffset);
      const words = (value) => value.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || [];
      return {
        before: words(before.toString().split(/[.!?]/).pop() || "").slice(-3),
        after: words(after.toString().split(/[.!?]/)[0] || "").slice(0, 3)
      };
    } catch (_error) { return { before: [], after: [] }; }
  }

  async function configureDeepSeek() {
    const settings = await Promise.resolve(GM_getValue(settingsKey, {}));
    const value = window.prompt("填写自己的 DeepSeek API Key；留空将关闭增强。Key 只保存在 Stay 本地。", settings.deepseekApiKey || "");
    if (value === null) return;
    await Promise.resolve(GM_setValue(settingsKey, { ...settings, translationProvider: "deepseek", deepseekApiKey: value.trim() }));
    renderControls();
    if (value.trim()) await testDeepSeek();
    else window.alert("DeepSeek 增强已关闭。");
  }

  async function testDeepSeek() {
    const settings = await Promise.resolve(GM_getValue(settingsKey, {}));
    if (!settings.deepseekApiKey) {
      window.alert("请先设置 AI Key。");
      return;
    }
    try {
      const response = await new Promise((resolve, reject) => gmRequest({
        method: "GET",
        url: "https://api.deepseek.com/models",
        timeout: 15000,
        headers: { Authorization: `Bearer ${settings.deepseekApiKey}` },
        onload: resolve,
        ontimeout() { reject(new Error("连接超时")); },
        onerror(value) { reject(new Error(value?.status ? `HTTP ${value.status}` : "网络或网站权限")); }
      }));
      if (response.status >= 200 && response.status < 300) {
        window.alert("DeepSeek 连接成功。现在选择词或句子即可使用 AI。");
      } else if (response.status === 401 || response.status === 403) {
        window.alert(`DeepSeek 鉴权失败（${response.status}），请重新填写 Key。`);
      } else {
        window.alert(`DeepSeek 已连接，但服务返回 ${response.status}。`);
      }
    } catch (error) {
      window.alert(`DeepSeek 连接失败：${error?.message || "未知错误"}。请在 iPhone 设置中允许 Stay 访问所有网站，并重新载入脚本。`);
    }
  }

  async function toggleEnabled() {
    enabled = !enabled;
    const settings = await Promise.resolve(GM_getValue(settingsKey, {}));
    await Promise.resolve(GM_setValue(settingsKey, { ...settings, enabled }));
    hideCard(); renderControls();
  }

  async function changeTranslationProvider(event) {
    const settings = await Promise.resolve(GM_getValue(settingsKey, {}));
    await Promise.resolve(GM_setValue(settingsKey, { ...settings, translationProvider: event.target.value }));
    renderControls();
  }

  async function renderControls() {
    const settings = await Promise.resolve(GM_getValue(settingsKey, {}));
    const provider = settings.translationProvider || (settings.deepseekApiKey ? "deepseek" : "google");
    const title = document.createElement("label"); title.className = "controls-title";
    const titleText = document.createElement("span"); titleText.textContent = "English Reader";
    const enabledSwitch = document.createElement("input"); enabledSwitch.type = "checkbox"; enabledSwitch.checked = enabled;
    enabledSwitch.setAttribute("role", "switch"); enabledSwitch.setAttribute("aria-label", "开启 English Reader");
    enabledSwitch.addEventListener("change", toggleEnabled); title.append(titleText, enabledSwitch);
    const row = document.createElement("div"); row.className = "row";
    const providerSelect = document.createElement("select"); providerSelect.setAttribute("aria-label", "翻译模式");
    [["google", "Google"], ["deepseek", "DeepSeek"]].forEach(([value, label]) => {
      const option = document.createElement("option"); option.value = value; option.textContent = label; option.selected = provider === value;
      providerSelect.appendChild(option);
    });
    providerSelect.addEventListener("change", changeTranslationProvider);
    row.append(
      providerSelect,
      ...(provider === "deepseek" ? [button(settings.deepseekApiKey ? "更换 / 测试 Key" : "设置 / 测试 Key", configureDeepSeek)] : []),
      button("学习库", () => { controls.classList.add("hidden"); openLibrary(); })
    );
    controls.replaceChildren(title, row);
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

  async function syncCollocations(sentence) {
    const library = await readLibrary();
    library.vocabulary = library.vocabulary.filter((item) => item.sourceSentenceId !== sentence.id);
    (sentence.collocations || []).filter((item) => item.selected !== false).forEach((item, index) => library.vocabulary.unshift({
      id: `${sentence.id}:collocation:${index}`, kind: "vocabulary", entryType: "phrase", text: item.phrase,
      normalizedText: item.phrase.toLowerCase(), chineseDefinition: item.meaningZh, sourceSentenceId: sentence.id,
      source: sentence.source, createdAt: sentence.createdAt
    }));
    library.vocabulary = library.vocabulary.slice(0, maxEntries);
    await Promise.resolve(GM_setValue(storageKey, library));
  }

  function renderLoading(text, provider = "Google") {
    card.classList.toggle("sentence-card", createResult(text, "").kind === "sentence");
    card.classList.remove("hidden");
    card.replaceChildren(header("正在翻译", text), heading(text), paragraph(`正在连接 ${provider}…`, "muted"),
      paragraph(`所选文本将发送给 ${provider}。`, "muted"));
  }

  function renderResult(result) {
    const fragment = document.createDocumentFragment();
    card.classList.toggle("sentence-card", result.kind === "sentence");
    fragment.append(header(result.kind === "sentence" ? "句子" : result.entryType === "phrase" ? "短语" : "单词", result.text));
    const displayText = result.kind === "sentence" && result.segments.length > 1 ? result.segments.join(" / ") : result.text;
    fragment.append(highlightedHeading(displayText, result.collocations || []));
    if (result.kind === "vocabulary" && result.meanings?.length) {
      const meanings = document.createElement("ol");
      result.meanings.forEach((meaning) => {
        const item = document.createElement("li");
        item.textContent = `${partName(meaning.partOfSpeech)} ${meaning.definitionZh}`;
        meanings.appendChild(item);
      });
      fragment.appendChild(meanings);
    } else {
      fragment.append(paragraph(result.kind === "sentence" ? result.translationZh : result.chineseDefinition));
    }
    if (result.collocations?.length) {
      fragment.append(paragraph("固定搭配", "label"));
      const list = document.createElement("ol");
      result.collocations.forEach((collocation) => {
        const item = document.createElement("li"); const label = document.createElement("label");
        const check = document.createElement("input"); check.type = "checkbox"; check.checked = collocation.selected !== false;
        check.onchange = async () => { collocation.selected = check.checked; await saveResult(result); await syncCollocations(result); };
        label.append(check, document.createTextNode(` ${collocation.phrase} — ${collocation.meaningZh}`)); item.appendChild(label); list.appendChild(item);
      });
      fragment.appendChild(list);
    }
    fragment.append(paragraph("已保存到 Stay 本地学习库", "saved"), paragraph(result.translationProvider === "deepseek" ? "翻译来源：DeepSeek" : "翻译来源：Google Web（实验性）", "muted"));
    if (result.providerWarning) fragment.append(paragraph(result.providerWarning, "error"));
    card.replaceChildren(fragment);
  }

  function renderError(text, message) {
    card.classList.remove("hidden");
    card.replaceChildren(header("翻译失败", text), heading(text), paragraph(message, "error"), paragraph("本次内容没有保存。", "muted"));
  }

  async function openLibrary() {
    const library = await readLibrary();
    libraryPanel.classList.remove("hidden");
    let activeKind = "vocabulary";
    const selected = new Set();
    const title = document.createElement("h2");
    title.textContent = "学习库";
    const close = button("关闭", () => libraryPanel.classList.add("hidden"));
    const toggle = button("隐藏翻译", () => { libraryPanel.classList.toggle("translations-hidden"); toggle.textContent = libraryPanel.classList.contains("translations-hidden") ? "显示翻译" : "隐藏翻译"; });
    const headerNode = document.createElement("header");
    headerNode.append(title, close);
    const tabs = document.createElement("div"); tabs.className = "library-bar library-tabs";
    const wordTab = button(`单词 ${library.vocabulary.length}`, () => { activeKind = "vocabulary"; selected.clear(); render(); });
    const sentenceTab = button(`句子 ${library.sentences.length}`, () => { activeKind = "sentences"; selected.clear(); render(); });
    tabs.append(wordTab, sentenceTab);
    const search = document.createElement("input"); search.type = "search"; search.placeholder = "搜索词语、句子或翻译";
    const searchRow = document.createElement("div"); searchRow.className = "library-bar"; searchRow.append(search, toggle);
    const actions = document.createElement("div"); actions.className = "library-bar";
    const visible = () => library[activeKind].filter((item) => JSON.stringify(item).toLowerCase().includes(search.value.toLowerCase()));
    const exportScope = () => {
      const items = visible().filter((item) => !selected.size || selected.has(item.id));
      return { vocabulary: activeKind === "vocabulary" ? items : [], sentences: activeKind === "sentences" ? items : [] };
    };
    const selectAll = button("全选", () => { const items = visible(); const all = items.length && items.every((item) => selected.has(item.id)); items.forEach((item) => all ? selected.delete(item.id) : selected.add(item.id)); render(); });
    const csvButton = button("CSV", () => exportCsv(exportScope()));
    const htmlButton = button("HTML", () => exportHtml(exportScope()));
    const removeSelected = button("删除", async () => { if (!selected.size || !confirm(`删除 ${selected.size} 条记录？`)) return; for (const id of selected) await deleteResult(id); openLibrary(); });
    actions.append(selectAll, csvButton, htmlButton, removeSelected);
    const fragment = document.createDocumentFragment(); fragment.append(headerNode, tabs, searchRow, actions);
    const list = document.createElement("div"); fragment.appendChild(list);
    const render = () => { list.replaceChildren(); wordTab.classList.toggle("active", activeKind === "vocabulary"); sentenceTab.classList.toggle("active", activeKind === "sentences"); visible().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).forEach((item) => {
      const article = document.createElement("article");
      const headingNode = document.createElement("h3");
      const check = document.createElement("input"); check.type = "checkbox"; check.checked = selected.has(item.id); check.onchange = () => check.checked ? selected.add(item.id) : selected.delete(item.id);
      headingNode.append(check, document.createTextNode(` ${item.text}`));
      const detail = paragraph(item.kind === "sentence" ? item.translationZh : item.chineseDefinition, "translation");
      article.append(headingNode, detail); list.appendChild(article);
    }); };
    search.oninput = render; render();
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

  function importLibrary() {
    const input = document.createElement("input"); input.type = "file"; input.accept = "application/json,.json";
    input.onchange = async () => {
      try {
        const parsed = JSON.parse(await input.files[0].text());
        if (!Array.isArray(parsed.vocabulary) || !Array.isArray(parsed.sentences)) throw new Error("格式不正确");
        await Promise.resolve(GM_setValue(storageKey, { vocabulary: parsed.vocabulary.slice(0, maxEntries), sentences: parsed.sentences.slice(0, maxEntries) }));
        window.alert("学习库导入完成。");
      } catch (error) { window.alert(`导入失败：${error.message}`); }
    };
    input.click();
  }

  async function exportCsv(existingLibrary) {
    const library = existingLibrary || await readLibrary();
    const rows = [["type", "text", "translation"]];
    [...library.vocabulary, ...library.sentences].forEach((item) => rows.push([item.kind, item.text, item.kind === "sentence" ? item.translationZh : item.chineseDefinition]));
    download(rows.map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(",")).join("\n"), "csv", "text/csv;charset=utf-8");
  }

  async function exportHtml(existingLibrary) {
    const library = existingLibrary || await readLibrary();
    const escape = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
    const cards = [...library.vocabulary, ...library.sentences].map((item) => `<article><h2>${escape(item.text)}</h2><p class="translation">${escape(item.kind === "sentence" ? item.translationZh : item.chineseDefinition)}</p></article>`).join("");
    download(`<!doctype html><meta charset="utf-8"><title>English Reader 学习库</title><style>body{max-width:800px;margin:auto;padding:20px;font-family:sans-serif;background:#f6f2e8}article{background:white;padding:14px;margin:10px;border-radius:12px}.hidden .translation{display:none}</style><button onclick="document.body.classList.toggle('hidden')">显示/隐藏翻译</button>${cards}`, "html", "text/html;charset=utf-8");
  }

  function download(content, extension, type) {
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = `english-reader-stay-${Date.now()}.${extension}`;
    document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
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
  function partName(value) { return ({ phrase: "短语", noun: "名词", verb: "动词", adjective: "形容词", adverb: "副词" })[value] || value || ""; }
  function escapeRegExp(text) { return text.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"); }
  function heading(text) { const node = document.createElement("h2"); node.textContent = text; return node; }
  function paragraph(text, className = "") { const node = document.createElement("p"); node.className = className; node.textContent = text; return node; }
})();
