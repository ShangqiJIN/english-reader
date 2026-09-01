document.querySelector("#version").textContent = `v${chrome.runtime.getManifest().version}`;
checkCurrentPage();
checkTranslator();
loadProviderSettings();

document.querySelector("#provider").addEventListener("change", updateProviderVisibility);
document.querySelector("#save-provider").addEventListener("click", saveProviderSettings);
document.querySelector("#extension-enabled").addEventListener("change", setExtensionEnabled);

document.querySelector("#open").addEventListener("click", async () => {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: currentWindow.id });
    window.close();
  } catch (error) {
    document.querySelector("#status").textContent = error.message || "无法打开学习库。";
  }
});

async function checkCurrentPage() {
  const connection = document.querySelector("#connection");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url ?? "")) {
      throw new Error("Unsupported page.");
    }
    const response = await chrome.tabs.sendMessage(tab.id, { type: "english-reader-ping" });
    if (!response?.ok) throw new Error("Content script did not respond.");
    const currentVersion = chrome.runtime.getManifest().version;
    if (response.version !== currentVersion) {
      connection.textContent = `网页仍在运行旧版 ${response.version || "未知"}；请刷新这个网页以启用 v${currentVersion}。`;
      connection.className = "connection error";
      return;
    }
    connection.textContent = response.enabled === false ? "当前网页已连接；划词功能已关闭。" : "当前网页已连接，可以划词。";
    connection.className = "connection ok";
  } catch (_error) {
    connection.textContent = "当前网页未连接。请重载扩展后刷新这个网页。";
    connection.className = "connection error";
  }
}

async function checkTranslator() {
  const status = document.querySelector("#translator");
  const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? "未知";
  if (!("LanguageDetector" in self) || !("Translator" in self)) {
    status.textContent = `Chrome ${chromeVersion}：不支持内置语言识别或翻译 API（需要 138+）。`;
    status.className = "connection error";
    return;
  }

  try {
    const availability = await self.Translator.availability({
      sourceLanguage: "en",
      targetLanguage: "zh"
    });
    const labels = {
      available: "语言识别可用；英中语言包可用",
      downloadable: "语言识别可用；英中语言包需要首次下载",
      downloading: "语言识别可用；英中语言包正在下载",
      unavailable: "语言识别可用；英中语言包不可用"
    };
    status.textContent = `Chrome ${chromeVersion}：${labels[availability] ?? availability}`;
    status.className = availability === "unavailable" ? "connection error" : "connection ok";
  } catch (error) {
    status.textContent = `Chrome ${chromeVersion}：Translator 检查失败：${error.message}`;
    status.className = "connection error";
  }
}

async function loadProviderSettings() {
  const settings = await chrome.storage.local.get(["extensionEnabled", "translationProvider", "deepseekApiKey"]);
  document.querySelector("#extension-enabled").checked = settings.extensionEnabled !== false;
  document.querySelector("#provider").value = settings.translationProvider || "chrome";
  document.querySelector("#deepseek-key").value = settings.deepseekApiKey || "";
  updateProviderVisibility();
}

async function setExtensionEnabled(event) {
  const enabled = event.target.checked;
  await chrome.storage.local.set({ extensionEnabled: enabled });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "set-extension-enabled", enabled }).catch(() => {});
  document.querySelector("#status").textContent = enabled ? "网页划词已开启。" : "网页划词已关闭；学习库仍可使用。";
  checkCurrentPage();
}

function updateProviderVisibility() {
  document.querySelector("#deepseek-settings").hidden = !usesDeepSeek();
}

function usesDeepSeek() {
  return document.querySelector("#provider").value === "deepseek";
}

async function saveProviderSettings() {
  const provider = document.querySelector("#provider").value;
  const key = document.querySelector("#deepseek-key").value.trim();
  if (usesDeepSeek() && !key) {
    document.querySelector("#status").textContent = "请先填写 DeepSeek API Key。";
    return;
  }
  if (usesDeepSeek()) {
    const granted = await chrome.permissions.request({ origins: ["https://api.deepseek.com/*"] });
    if (!granted) {
      document.querySelector("#status").textContent = "未授予 DeepSeek 网站访问权限，设置没有启用。";
      return;
    }
  }
  await chrome.storage.local.set({ translationProvider: provider, deepseekApiKey: key });
  if (!usesDeepSeek()) {
    document.querySelector("#status").textContent = "词汇和句子均使用 Chrome 本地翻译。";
    return;
  }
  document.querySelector("#status").textContent = "正在测试 DeepSeek…";
  const response = await chrome.runtime.sendMessage({ type: "deepseek-test" });
  document.querySelector("#status").textContent = response?.ok ? "DeepSeek 连接和 Key 验证成功。" : response?.error || "DeepSeek 测试失败。";
}
