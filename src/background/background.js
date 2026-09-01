import {
  classifySelection,
  createSentenceResult,
  createVocabularyResult,
  normalizeSelection
} from "../shared/text.js";
import { deleteResults, getLibrary, saveResult } from "../shared/storage.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "english-reader-analyze",
    title: "用 English Reader 学习选中内容",
    contexts: ["selection"]
  });

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "english-reader-analyze" || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, {
    type: "analyze-external-selection",
    text: info.selectionText ?? ""
  }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;

  if (message.type === "analyze-selection") {
    handleSelection(message.payload, sender)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "get-library") {
    getLibrary()
      .then((library) => sendResponse({ ok: true, library }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "save-result") {
    saveResult(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "delete-library-items") {
    deleteResults(message.payload?.kind, message.payload?.ids)
      .then((summary) => sendResponse({ ok: true, summary }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "open-sidepanel") {
    const windowId = sender.tab?.windowId ?? message.windowId;
    if (!windowId) {
      sendResponse({ ok: false, error: "No active window." });
      return false;
    }
    chrome.sidePanel.open({ windowId })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function handleSelection(payload, sender) {
  const text = normalizeSelection(payload?.text);
  if (!text || text.length > 5000) throw new Error("请选择 1–5000 个字符的英文内容。");

  const kind = classifySelection(text);
  const result = kind === "sentence"
    ? createSentenceResult(text)
    : createVocabularyResult(text);

  result.source = {
    pageUrl: sender.tab?.url ?? "",
    pageTitle: sender.tab?.title ?? "",
    surroundingText: normalizeSelection(payload?.context).slice(0, 1000)
  };

  await saveResult(result);
  return { ok: true, result };
}
