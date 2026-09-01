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
    .title-row h2 { flex: 1 1 auto; margin: 0; }
    .title-row .speak { flex: 0 0 auto; }
    h2 strong { color: #17634d; text-decoration: underline; text-decoration-color: #a8cdbc; text-underline-offset: 3px; }
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
  let selectionArmed = true;
  let selectingWithMouse = false;

  document.addEventListener("mouseup", (event) => {
    selectingWithMouse = false;
    if (event.composedPath().includes(host)) return;
    scheduleSelection(0);
  });
  document.addEventListener("selectionchange", () => {
    if (!selectionArmed || selectingWithMouse) return;
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
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type === "analyze-external-selection") analyze(message.text, null);
    return false;
  });

  function readSelection() {
    if (!selectionArmed) return;
    const selection = window.getSelection();
    if (isPopoverSelection(selection)) return;
    const text = selection?.toString().replace(/\s+/g, " ").trim();
    if (!text || text.length > 5000 || selection.rangeCount === 0) return;
    selectionArmed = false;
    analyze(text, selection.getRangeAt(0).getBoundingClientRect());
  }

  function scheduleSelection(delay) {
    window.clearTimeout(selectionTimer);
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

  async function analyze(text, rect) {
    const serial = ++requestSerial;
    position(rect);
    renderLoading(text);
    let result = createImmediateResult(text);
    renderResult(result);
    const context = getContext(text);
    const localTranslation = detectAndTranslate(text, context, (status) => {
      if (serial === requestSerial) renderLoading(text, status);
    });
    const response = await withTimeout(chrome.runtime.sendMessage({
      type: "analyze-selection",
      payload: { text, context }
    }), 2500).catch((error) => ({ ok: false, error: error.message }));
    if (serial !== requestSerial) return;
    if (response.ok) result = response.result;
    else result.storageWarning = "后台暂未响应；本次结果可能尚未保存。";
    renderResult(result);
    try {
      const translation = await localTranslation;
      if (serial !== requestSerial) return;
      if (result.kind === "sentence") result.translationZh = translation.text;
      else result.chineseDefinition = translation.text;
      result.sourceLanguage = translation.sourceLanguage;
      result.sourceLanguageConfidence = translation.confidence;
      result.translationProvider = "chrome-built-in";
      await chrome.runtime.sendMessage({ type: "save-result", payload: result });
      if (serial === requestSerial) renderResult(result);
    } catch (error) {
      if (serial !== requestSerial) return;
      result.translationError = friendlyTranslationError(error);
      if (result.kind === "sentence") result.translationZh = "本地翻译未完成。";
      else result.chineseDefinition = "本地翻译未完成。";
      renderResult(result);
    }
  }

  function createImmediateResult(text) {
    const normalized = text.replace(/\s+/g, " ").trim();
    const words = normalized.split(" ");
    const isSentence = words.length >= 7 || /[.!?][\"'\u201d\u2019)]?$/.test(normalized);
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
      ["because of", "因为；由于"], ["carry out", "执行；开展"], ["come up with", "提出；想出"],
      ["depend on", "取决于"], ["due to", "由于"], ["even though", "即使；尽管"],
      ["figure out", "弄清楚；解决"], ["focus on", "专注于"], ["in addition to", "除……之外还"],
      ["in order to", "为了"], ["in terms of", "就……而言"], ["lead to", "导致"],
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

  function position(rect) {
    card.classList.remove("hidden");
    const left = rect ? Math.min(Math.max(12, rect.left), window.innerWidth - 372) : 24;
    const top = rect ? Math.min(rect.bottom + 10, window.innerHeight - 300) : 80;
    card.style.left = `${Math.max(12, left)}px`;
    card.style.top = `${Math.max(12, top)}px`;
  }

  function renderLoading(text, status = "正在生成本地预览…") {
    card.replaceChildren(header("正在分析"), heading(text), paragraph(status, "muted"));
  }

  function renderResult(result) {
    card.dataset.sourceLanguage = result.sourceLanguage || "en";
    const fragment = document.createDocumentFragment();
    fragment.append(header(result.kind === "sentence" ? "长难句" : result.entryType === "phrase" ? "短语" : "单词"));
    fragment.append(headingWithSpeech(result.text, result.collocations ?? [], result.sourceLanguage || "en"));
    if (result.kind === "vocabulary") {
      fragment.append(paragraph(result.chineseDefinition));
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
    if (result.storageWarning) fragment.append(paragraph(result.storageWarning, "muted"));
    if (result.sourceLanguage) fragment.append(paragraph(`识别语言：${languageName(result.sourceLanguage)}`, "muted"));
    fragment.append(paragraph("已保存到本地学习库", "saved"));
    card.replaceChildren(fragment);
  }

  function renderError(message) {
    card.replaceChildren(header("无法分析"), paragraph(message || "发生未知错误。"));
  }

  function friendlyTranslationError(error) {
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
    return "本地翻译暂时不可用，请稍后重试。";
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
      const child = document.createElement(matched ? "strong" : "span");
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
})();
