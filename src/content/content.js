(() => {
  const host = document.createElement("div");
  host.id = "english-reader-root";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .card { position: fixed; z-index: 2147483647; width: min(360px, calc(100vw - 24px));
      max-height: min(480px, calc(100vh - 24px)); overflow: auto; box-sizing: border-box;
      padding: 16px; border: 1px solid #d7d4ca; border-radius: 14px; background: #fffdf7;
      color: #24221d; box-shadow: 0 14px 44px rgba(37, 31, 19, .22); font: 14px/1.5 -apple-system, BlinkMacSystemFont, sans-serif; }
    .hidden { display: none; } .top { display: flex; justify-content: space-between; gap: 12px; }
    .label { color: #796e5b; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .actions { display: flex; align-items: center; gap: 6px; }
    h2 { margin: 5px 0 10px; font-size: 19px; line-height: 1.3; overflow-wrap: anywhere; }
    .title-row { display: flex; align-items: center; gap: 8px; margin: 5px 0 10px; }
    .title-row h2 { flex: 0 1 auto; margin: 0; }
    .title-row .speak { flex: 0 0 auto; }
    h2 strong { color: #17634d; text-decoration: underline; text-decoration-color: #a8cdbc; text-underline-offset: 3px; }
    h2 .collocation-mark { color: #184f3f; font-weight: 800; text-decoration: underline; text-decoration-color: #79a898; text-underline-offset: 3px; }
    .collocation-list strong { color: #184f3f; font-weight: 800; }
    p { margin: 7px 0; } ol { margin: 8px 0; padding-left: 22px; }
    button { border: 0; border-radius: 9px; padding: 7px 10px; background: #ebe5d7; color: #24221d; cursor: pointer; }
    button:hover { background: #ddd2bd; } .close, .speak { padding: 3px 8px; align-self: flex-start; }
    .speak svg { display: block; width: 21px; height: 21px; fill: #5d5a53; }
    .muted { color: #716a5e; } .saved { color: #347453; font-size: 12px; font-weight: 700; }
  `;
  const card = document.createElement("section");
  card.className = "card hidden";
  shadow.append(style, card);
  document.documentElement.appendChild(host);

  let requestSerial = 0;
  let selectionTimer = 0;
  const translatorPromises = new Map();
  let detectorPromise = null;
  let lastSelectionRect = null;
  let selectionArmed = true;
  let selectingWithMouse = false;
  let extensionEnabled = true;
  const settingsReady = chrome.storage.local.get("extensionEnabled").then((settings) => {
    extensionEnabled = settings.extensionEnabled !== false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.extensionEnabled) {
      extensionEnabled = changes.extensionEnabled.newValue !== false;
      if (!extensionEnabled) disableSelection();
      else selectionArmed = true;
    }
  });

  document.addEventListener("mouseup", (event) => {
    selectingWithMouse = false;
    if (!extensionEnabled || event.composedPath().includes(host)) return;
    scheduleSelection(0);
  });
  document.addEventListener("selectionchange", () => {
    if (!extensionEnabled || !selectionArmed || selectingWithMouse) return;
    const selection = window.getSelection();
    if (isPopoverSelection(selection)) return;
    scheduleSelection(180);
  });
  document.addEventListener("keyup", (event) => {
    if (event.key === "Escape") hide();
    else if (event.key === "Shift" || event.key.startsWith("Arrow")) {
      selectionArmed = true;
      scheduleSelection(0);
    }
  });
  document.addEventListener("mousedown", (event) => {
    if (event.composedPath().includes(host)) return;
    selectingWithMouse = true;
    selectionArmed = true;
    window.clearTimeout(selectionTimer);
    hide();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "english-reader-ping") {
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version, enabled: extensionEnabled });
      return false;
    }
    if (message?.type === "set-extension-enabled") {
      extensionEnabled = message.enabled !== false;
      if (!extensionEnabled) disableSelection();
      else selectionArmed = true;
      return false;
    }
    if (message?.type === "analyze-external-selection" && extensionEnabled) analyze(message.text, null, { before: [], after: [] });
    return false;
  });

  async function readSelection() {
    await settingsReady;
    extensionEnabled = (await chrome.storage.local.get("extensionEnabled")).extensionEnabled !== false;
    if (!extensionEnabled || !selectionArmed) return;
    const selection = window.getSelection();
    if (isPopoverSelection(selection)) return;
    const text = selection?.toString().replace(/\s+/g, " ").trim();
    if (!text || text.length > 5000 || selection.rangeCount === 0) return;
    selectionArmed = false;
    const range = selection.getRangeAt(0);
    analyze(text, range.getBoundingClientRect(), getWordWindow(range));
  }

  function scheduleSelection(delay) {
    window.clearTimeout(selectionTimer);
    if (!extensionEnabled) return;
    selectionTimer = window.setTimeout(readSelection, delay);
  }

  function isPopoverSelection(selection) {
    const anchorNode = selection?.anchorNode;
    const focusNode = selection?.focusNode;
    if (anchorNode && (anchorNode === host || shadow.contains(anchorNode))) return true;
    if (focusNode && (focusNode === host || shadow.contains(focusNode))) return true;
    const anchorRoot = anchorNode?.getRootNode?.();
    const focusRoot = focusNode?.getRootNode?.();
    return anchorRoot === shadow || focusRoot === shadow;
  }

  async function analyze(text, rect, wordWindow) {
    extensionEnabled = (await chrome.storage.local.get("extensionEnabled")).extensionEnabled !== false;
    if (!extensionEnabled) {
      disableSelection();
      return;
    }
    const serial = ++requestSerial;
    position(rect);
    renderLoading(text);
    let result = createImmediateResult(text);
    const context = getContext(text);
    const translationTask = translateWithSelectedProvider(text, result.kind, context, wordWindow, (status) => {
      if (serial === requestSerial) renderLoading(text, status);
    });
    const response = await withTimeout(chrome.runtime.sendMessage({
      type: "analyze-selection",
      payload: { text, context, wordWindow }
    }), 2500).catch((error) => ({ ok: false, error: error.message }));
    if (serial !== requestSerial) return;
    if (response.ok) result = response.result;
    else result.storageWarning = "后台暂未响应；本次结果可能尚未保存。";
    try {
      const translation = await translationTask;
      if (serial !== requestSerial) return;
      if (result.kind === "sentence") result.translationZh = translation.analysis?.translationZh || translation.text;
      else result.chineseDefinition = translation.analysis?.translationZh || translation.text;
      result.sourceLanguage = translation.sourceLanguage;
      result.sourceLanguageConfidence = translation.confidence;
      result.translationProvider = translation.provider;
      result.providerWarning = translation.providerWarning || "";
      if (translation.analysis?.segments?.length && result.kind === "sentence") result.segments = translation.analysis.segments;
      if (translation.analysis?.collocations?.length && result.kind === "sentence") result.collocations = translation.analysis.collocations;
      if (translation.analysis?.meanings?.length && result.kind === "vocabulary") result.meanings = translation.analysis.meanings;
      renderResult(result);
      if (result.kind === "vocabulary" && result.sourceLanguage === "en") {
        await enrichVocabularyWithDeepSeek(result, serial);
      }
      const saveResponse = await chrome.runtime.sendMessage({ type: "save-result", payload: result });
      result.saved = Boolean(saveResponse?.ok);
      if (!result.saved) result.storageWarning = saveResponse?.error || "结果未能保存。";
      if (serial === requestSerial) renderResult(result);
      if (translation.aiPromise) {
        result.aiStatus = "pending";
        renderResult(result);
        const aiResponse = await translation.aiPromise;
        if (serial !== requestSerial) return;
        if (aiResponse.ok) {
          applyAiAnalysis(result, aiResponse.result);
          result.translationProvider = "deepseek";
          result.aiStatus = "complete";
          result.providerWarning = "";
          const finalSave = await chrome.runtime.sendMessage({ type: "save-result", payload: result });
          result.saved = Boolean(finalSave?.ok);
        } else {
          result.aiStatus = "failed";
          result.providerWarning = `${aiResponse.error} 已保留 Chrome 本地结果。`;
        }
        renderResult(result);
      }
    } catch (error) {
      if (serial !== requestSerial) return;
      result.translationError = friendlyTranslationError(error);
      if (result.kind === "sentence") result.translationZh = "翻译未完成。";
      else result.chineseDefinition = "翻译未完成。";
      renderResult(result);
    }
  }

  async function enrichVocabularyWithDeepSeek(result, serial) {
    const contextPhrase = [...(result.wordWindow?.before || []), result.text, ...(result.wordWindow?.after || [])].join(" ");
    result.meaningContext = contextPhrase;
    const { translationProvider = "chrome" } = await chrome.storage.local.get("translationProvider");
    if (translationProvider !== "deepseek") return;

    // DEEPSEEK VOCABULARY: this marked request is the single place to change or disable the enhancement.
    result.aiStatus = "pending";
    renderResult(result);
    const response = await withTimeout(chrome.runtime.sendMessage({
      type: "deepseek-analyze",
      payload: { kind: "vocabulary", text: result.text, context: contextPhrase, wordWindow: result.wordWindow }
    }), 30000).catch((error) => ({ ok: false, error: error.message }));
    if (serial !== requestSerial) return;
    if (response?.ok && response.result?.meanings?.length) {
      result.meanings = response.result.meanings.slice(0, 2);
      result.aiStatus = "complete";
      result.translationProvider = "chrome+deepseek";
    } else {
      result.meanings = [{ partOfSpeech: "preferred", definitionZh: result.chineseDefinition }];
      result.aiStatus = "failed";
      result.providerWarning = `${response?.error || "DeepSeek 没有返回词义。"} 已保留 Chrome 本地首选释义。`;
    }
    renderResult(result);
  }

  function applyAiAnalysis(result, analysis) {
    if (analysis?.translationZh) {
      if (result.kind === "sentence") result.translationZh = analysis.translationZh;
      else result.chineseDefinition = analysis.translationZh;
    }
    if (result.kind === "sentence" && analysis?.segments?.length) result.segments = analysis.segments;
    if (result.kind === "sentence" && analysis?.collocations?.length) result.collocations = analysis.collocations;
  }

  function createImmediateResult(text) {
    const normalized = text.replace(/\s+/g, " ").trim();
    const words = normalized.split(" ");
    const isSentence = words.length >= 5 || /[.!?][\"'\u201d\u2019)]?$/.test(normalized);
    if (!isSentence) {
      return {
        id: crypto.randomUUID(),
        kind: "vocabulary",
        text: normalized,
        normalizedText: normalized.toLocaleLowerCase("en-US"),
        entryType: words.length > 1 ? "phrase" : "word",
        chineseDefinition: "正在等待 Chrome 本地翻译…",
        englishDefinition: "",
        phraseMeaning: words.length > 1 ? "正在分析短语整体含义…" : "",
        createdAt: new Date().toISOString()
      };
    }

    return {
      id: crypto.randomUUID(),
      kind: "sentence",
      text: normalized,
        translationZh: "正在等待 Chrome 本地翻译…",
        segments: normalized.split(/(?<=[,;:])\s+/).filter(Boolean),
        collocations: detectLocalCollocations(normalized),
        structureSummary: "",
      createdAt: new Date().toISOString()
    };
  }

  function detectLocalCollocations(text) {
    const rules = [
      ["according to", "根据；按照"], ["as a result", "因此；结果"], ["as well as", "以及；也"],
      ["be able to", "能够"], ["be based on", "基于"], ["be responsible for", "负责"],
      ["behind the scenes", "在幕后"],
      ["because of", "因为；由于"], ["carry out", "执行；开展"], ["come up with", "提出；想出"],
      ["depend on", "取决于"], ["due to", "由于"], ["even though", "即使；尽管"],
      ["figure out", "弄清楚；解决"], ["focus on", "专注于"], ["in addition to", "除……之外还"],
      ["in order to", "为了"], ["in terms of", "就……而言"], ["lead to", "导致"],
      ["open source", "开源"], ["plastered onto", "贴满；贴在……上"],
      ["make use of", "利用"], ["rather than", "而不是"], ["refer to", "指的是；提到"],
      ["result in", "导致"], ["take advantage of", "利用"], ["take into account", "把……考虑在内"],
      ["with regard to", "关于"]
    ];
    const lowerText = text.toLocaleLowerCase("en-US");
    return rules.filter(([phrase]) => lowerText.includes(phrase))
      .map(([phrase, meaningZh]) => ({ phrase, meaningZh }));
  }

  function withTimeout(promise, milliseconds) {
    return Promise.race([
      promise,
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("Background timeout.")), milliseconds))
    ]);
  }

  async function detectAndTranslate(text, context, onStatus) {
    const detection = await detectSourceLanguage(text, context, onStatus);
    const sourceLanguage = normalizeLanguageCode(detection.detectedLanguage);
    if (sourceLanguage === "zh") throw new Error("already-chinese");
    const translated = await translateLocally(text, sourceLanguage, onStatus);
    return { text: translated, sourceLanguage, confidence: detection.confidence };
  }

  async function translateWithSelectedProvider(text, kind, context, wordWindow, onStatus) {
    const { translationProvider = "chrome" } = await chrome.storage.local.get("translationProvider");
    const detection = await detectSourceLanguage(text, context, onStatus);
    const sourceLanguage = normalizeLanguageCode(detection.detectedLanguage);
    if (sourceLanguage === "zh") throw new Error("already-chinese");
    if (translationProvider === "deepseek" && kind === "sentence") {
      onStatus("正在本地翻译；DeepSeek 将在后台补充分析…");
      const aiPromise = withTimeout(chrome.runtime.sendMessage({ type: "deepseek-analyze", payload: { kind, text, context, wordWindow } }), 30000)
        .then((response) => response?.ok ? { ok: true, result: response.result } : { ok: false, error: response?.error || "DeepSeek 分析失败。" })
        .catch((error) => ({ ok: false, error: error.message || "DeepSeek 分析失败。" }));
      try {
        const translated = await translateLocally(text, sourceLanguage, onStatus);
        return { text: translated, sourceLanguage, confidence: detection.confidence, provider: "chrome-preview", aiPromise };
      } catch (_error) {
        const aiResponse = await aiPromise;
        if (!aiResponse.ok) throw new Error(`${aiResponse.error} Chrome 本地翻译也不可用。`);
        return { text: aiResponse.result.translationZh, analysis: aiResponse.result, sourceLanguage, confidence: detection.confidence, provider: "deepseek" };
      }
    }
    try {
      const translated = await translateLocally(text, sourceLanguage, onStatus);
      return { text: translated, sourceLanguage, confidence: detection.confidence, provider: "chrome-built-in" };
    } catch (error) {
      const providerError = new Error(error?.message || "Chrome translation failed.");
      providerError.name = error?.name || "Error";
      providerError.chromeOnly = true;
      throw providerError;
    }
  }

  async function detectSourceLanguage(text, context, onStatus) {
    if (!("LanguageDetector" in self)) throw new Error("detector-not-supported");
    onStatus("正在识别所选语言…");
    if (!detectorPromise) {
      detectorPromise = self.LanguageDetector.create().catch((error) => {
        detectorPromise = null;
        throw error;
      });
    }
    const detector = await detectorPromise;
    let results = await detector.detect(text);
    let best = results?.[0];
    if ((!best || best.confidence < 0.55) && text.length < 24 && context) {
      results = await detector.detect(context.slice(0, 1200));
      best = results?.[0];
    }
    if (!best?.detectedLanguage || best.detectedLanguage === "und") throw new Error("language-undetected");
    return best;
  }

  async function translateLocally(text, sourceLanguage, onStatus) {
    if (!("Translator" in self)) {
      throw new Error("translator-not-supported");
    }

    const pairKey = `${sourceLanguage}->zh`;
    if (!translatorPromises.has(pairKey)) {
      // Call create() before the first await so Chrome can associate a possible
      // language-pack download with the user's selection gesture.
      onStatus(`正在启动${languageName(sourceLanguage)}翻译；首次使用可能需要下载语言包…`);
      const promise = self.Translator.create({
        sourceLanguage,
        targetLanguage: "zh",
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            onStatus(`正在下载翻译语言包：${Math.round(event.loaded * 100)}%`);
          });
        }
      }).catch((error) => {
        translatorPromises.delete(pairKey);
        throw error;
      });
      translatorPromises.set(pairKey, promise);
    }

    const translator = await translatorPromises.get(pairKey);
    onStatus(`正在将${languageName(sourceLanguage)}翻译成中文…`);
    return translator.translate(text);
  }

  function normalizeLanguageCode(code) {
    const lower = String(code ?? "").toLocaleLowerCase();
    if (lower.startsWith("zh")) return "zh";
    return lower.split("-")[0];
  }

  function languageName(code) {
    const names = { en: "英语", fr: "法语", de: "德语", ko: "韩语", es: "西班牙语", ja: "日语", it: "意大利语", pt: "葡萄牙语", ru: "俄语" };
    return names[code] ?? `源语言（${code}）`;
  }

  function getContext(text) {
    const bodyText = document.body?.innerText ?? "";
    const index = bodyText.indexOf(text);
    return index < 0 ? "" : bodyText.slice(Math.max(0, index - 300), index + text.length + 300);
  }

  function getWordWindow(range) {
    try {
      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(document.body);
      beforeRange.setEnd(range.startContainer, range.startOffset);
      const afterRange = document.createRange();
      afterRange.selectNodeContents(document.body);
      afterRange.setStart(range.endContainer, range.endOffset);
      const beforeSentence = beforeRange.toString().split(/[.!?。！？][\s"'’”)]*/).pop() || "";
      const afterSentence = afterRange.toString().split(/[.!?。！？]/)[0] || "";
      const words = (value) => value.match(/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu) || [];
      return { before: words(beforeSentence).slice(-3), after: words(afterSentence).slice(0, 3) };
    } catch (_error) {
      return { before: [], after: [] };
    }
  }

  function position(rect) {
    lastSelectionRect = rect;
    card.classList.remove("hidden");
    const left = rect ? Math.min(Math.max(12, rect.left), window.innerWidth - 372) : 24;
    const top = rect ? Math.min(rect.bottom + 10, window.innerHeight - 300) : 80;
    card.style.left = `${Math.max(12, left)}px`;
    card.style.top = `${Math.max(12, top)}px`;
    fitCardToViewport(rect);
  }

  function fitCardToViewport(rect) {
    window.requestAnimationFrame(() => {
      if (card.classList.contains("hidden")) return;
      const margin = 12;
      card.style.maxHeight = `${Math.max(180, window.innerHeight - margin * 2)}px`;
      const height = Math.min(card.scrollHeight, window.innerHeight - margin * 2);
      const below = rect?.bottom + 10;
      const above = rect?.top - height - 10;
      const top = rect && below + height <= window.innerHeight - margin ? below : rect && above >= margin ? above : margin;
      card.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - height - margin))}px`;
    });
  }

  function renderLoading(text, status = "正在生成本地预览…") {
    card.replaceChildren(header("正在分析"), heading(text), paragraph(status, "muted"));
    fitCardToViewport(lastSelectionRect);
  }

  function renderResult(result) {
    card.dataset.sourceLanguage = result.sourceLanguage || "en";
    const fragment = document.createDocumentFragment();
    fragment.append(header(result.kind === "sentence" ? "句子" : result.entryType === "phrase" ? "短语" : "单词"));
    fragment.append(headingWithSpeech(result.text, result.collocations ?? [], result.sourceLanguage || "en"));
    if (result.kind === "vocabulary") {
      if (result.meaningContext) fragment.append(paragraph(`判义上下文：${result.meaningContext}`, "muted"));
      if (result.ipa) fragment.append(paragraph(result.ipa, "muted"));
      if (result.meanings?.length) {
        const meanings = document.createElement("ol");
        result.meanings.forEach((meaning) => {
          const item = document.createElement("li");
          const part = document.createElement("strong");
          part.textContent = partOfSpeechName(meaning.partOfSpeech);
          item.append(part, document.createTextNode(` ${meaning.definitionZh || meaning.definitionEn}`));
          meanings.appendChild(item);
        });
        fragment.appendChild(meanings);
      } else {
        fragment.append(paragraph(result.chineseDefinition));
      }
      if (result.englishDefinition) fragment.append(paragraph(result.englishDefinition, "muted"));
      if (result.phraseMeaning) fragment.append(paragraph(result.phraseMeaning));
    } else {
      fragment.append(paragraph(result.translationZh));
      const list = document.createElement("ol");
      result.segments.forEach((segment) => {
        const item = document.createElement("li");
        item.textContent = segment;
        list.appendChild(item);
      });
      fragment.append(list);
      if (result.structureSummary) fragment.append(paragraph(result.structureSummary, "muted"));
      if (result.collocations?.length) {
        const title = paragraph("固定搭配", "label");
        const collocationList = document.createElement("ol");
        collocationList.className = "collocation-list";
        result.collocations.forEach(({ phrase, meaningZh }) => {
          const item = document.createElement("li");
          const strong = document.createElement("strong");
          strong.textContent = phrase;
          item.append(strong, document.createTextNode(" — " + meaningZh));
          collocationList.appendChild(item);
        });
        fragment.append(title, collocationList);
      }
    }
    if (result.translationError) fragment.append(paragraph(result.translationError, "muted"));
    if (result.aiStatus === "pending") fragment.append(paragraph("DeepSeek V4 Flash 正在分析…", "muted"));
    if (result.aiStatus === "complete") fragment.append(paragraph("DeepSeek V4 Flash 已完成", "saved"));
    if (result.kind === "sentence" && result.translationProvider === "chrome-built-in") fragment.append(paragraph("当前使用 Chrome 本地句子模式；DeepSeek 未启用。", "muted"));
    if (result.providerWarning) fragment.append(paragraph(result.providerWarning, "muted"));
    if (result.storageWarning) fragment.append(paragraph(result.storageWarning, "muted"));
    if (result.sourceLanguage) fragment.append(paragraph(`识别语言：${languageName(result.sourceLanguage)}`, "muted"));
    if (result.saved) fragment.append(paragraph("已保存到本地学习库", "saved"));
    card.replaceChildren(fragment);
    fitCardToViewport(lastSelectionRect);
  }

  function partOfSpeechName(partOfSpeech) {
    const names = { preferred: "首选释义", contextPhrase: "语境短语", noun: "名词", verb: "动词", adjective: "形容词", adverb: "副词", pronoun: "代词", preposition: "介词", conjunction: "连词", interjection: "感叹词" };
    return names[partOfSpeech] ?? partOfSpeech;
  }

  function renderError(message) {
    card.replaceChildren(header("无法分析"), paragraph(message || "发生未知错误。"));
    fitCardToViewport(lastSelectionRect);
  }

  function friendlyTranslationError(error) {
    if (/DeepSeek|API Key/.test(error?.message || "")) return error.message;
    if (error?.message === "detector-not-supported") {
      return "当前 Chrome 不支持内置语言识别，请升级 Chrome 后重试。";
    }
    if (error?.message === "language-undetected") {
      return "暂时无法确定所选文本的语言；请选择更长的词组或句子后重试。";
    }
    if (error?.message === "already-chinese") {
      return "检测到所选内容已经是中文，因此没有再次翻译。";
    }
    if (error?.message === "translator-not-supported") {
      return "当前 Chrome 不支持内置翻译，请升级到 Chrome 138 或更高版本。";
    }
    if (error?.message === "language-pair-unavailable") {
      return "当前 Chrome 无法使用该语言到中文的翻译包。";
    }
    if (error?.name === "NotAllowedError") {
      return "首次下载语言包需要用户操作，请重新选择一次文本。";
    }
    if (error?.chromeOnly) return "当前使用 Chrome 本地模式，但本地翻译未成功。若要使用 DeepSeek 句子增强，请在扩展按钮中启用并测试连接。";
    return "Chrome 本地翻译暂时不可用，请稍后重试。";
  }

  function header(label, speechText = "") {
    const row = document.createElement("div");
    row.className = "top";
    const title = document.createElement("span");
    title.className = "label";
    title.textContent = label;
    const actions = document.createElement("div");
    actions.className = "actions";
    if (speechText) {
      const speak = document.createElement("button");
      speak.className = "speak";
      speak.appendChild(createSpeakerIcon());
      speak.title = "朗读原文";
      speak.setAttribute("aria-label", "朗读原文");
      speak.addEventListener("click", () => speakText(speechText, card.dataset.sourceLanguage || "en"));
      actions.appendChild(speak);
    }
    const close = document.createElement("button");
    close.className = "close";
    close.textContent = "×";
    close.addEventListener("click", hide);
    actions.appendChild(close);
    row.append(title, actions);
    return row;
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

  function highlightedHeading(text, collocations) {
    const node = document.createElement("h2");
    const phrases = collocations.map((item) => item.phrase).sort((a, b) => b.length - a.length);
    if (!phrases.length) {
      node.textContent = text;
      return node;
    }
    const pattern = new RegExp("(" + phrases.map(escapeRegExp).join("|") + ")", "gi");
    text.split(pattern).filter(Boolean).forEach((part) => {
      const matched = phrases.some((phrase) => phrase.toLocaleLowerCase("en-US") === part.toLocaleLowerCase("en-US"));
      const child = document.createElement("span");
      if (matched) child.className = "collocation-mark";
      child.textContent = part;
      node.appendChild(child);
    });
    return node;
  }

  function headingWithSpeech(text, collocations, language) {
    const row = document.createElement("div");
    row.className = "title-row";
    const speak = document.createElement("button");
    speak.className = "speak";
    speak.appendChild(createSpeakerIcon());
    speak.title = "朗读原文";
    speak.setAttribute("aria-label", "朗读原文");
    speak.addEventListener("click", () => speakText(text, language));
    row.append(highlightedHeading(text, collocations), speak);
    return row;
  }

  function escapeRegExp(text) {
    return text.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
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

  function heading(text) {
    const node = document.createElement("h2");
    node.textContent = text;
    return node;
  }

  function paragraph(text, className = "") {
    const node = document.createElement("p");
    node.className = className;
    node.textContent = text;
    return node;
  }

  function hide() {
    requestSerial += 1;
    card.classList.add("hidden");
  }

  function disableSelection() {
    window.clearTimeout(selectionTimer);
    selectionArmed = false;
    hide();
  }
})();
