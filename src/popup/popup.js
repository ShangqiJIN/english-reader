document.querySelector("#version").textContent = `v${chrome.runtime.getManifest().version}`;
checkCurrentPage();
checkTranslator();

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
    connection.textContent = "当前网页已连接，可以划词。";
    connection.className = "connection ok";
  } catch (_error) {
    connection.textContent = "当前网页未连接。请重载扩展后刷新这个网页。";
    connection.className = "connection error";
  }
}

async function checkTranslator() {
  const status = document.querySelector("#translator");
  const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? "未知";
  if (!("Translator" in self)) {
    status.textContent = `Chrome ${chromeVersion}：不支持内置 Translator API（需要 138+）。`;
    status.className = "connection error";
    return;
  }

  try {
    const availability = await self.Translator.availability({
      sourceLanguage: "en",
      targetLanguage: "zh"
    });
    const labels = {
      available: "英中语言包可用",
      downloadable: "英中语言包需要首次下载",
      downloading: "英中语言包正在下载",
      unavailable: "英中语言包不可用"
    };
    status.textContent = `Chrome ${chromeVersion}：${labels[availability] ?? availability}`;
    status.className = availability === "unavailable" ? "connection error" : "connection ok";
  } catch (error) {
    status.textContent = `Chrome ${chromeVersion}：Translator 检查失败：${error.message}`;
    status.className = "connection error";
  }
}
