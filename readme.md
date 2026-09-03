# Poke Poke / 戳戳

[English](#english) · [中文](#中文)

## English

Poke Poke helps users look up vocabulary, understand sentences, and save useful expressions without leaving the current webpage. Poke a word. Poke a sentence. Keep reading. This repository contains separate Chrome and Stay/Safari editions.

### Chrome edition

- Select a word, phrase, or sentence to open a compact learning card.
- Translate supported languages into Simplified Chinese with Chrome's on-device Translator and Language Detector APIs.
- Optionally enhance sentence analysis with DeepSeek using the user's own API key.
- Rank vocabulary meanings from nearby context without crossing sentence boundaries.
- Read selected text aloud, split sentences with `/`, and highlight common fixed expressions.
- Store vocabulary and sentences locally; search, hide translations, batch-delete, and export selected records as CSV or HTML.

Chrome 138 or later is recommended. The first translation for a language may download an on-device language pack. Chrome internal pages, the Chrome Web Store, and some protected documents do not allow content-script injection.

### Stay / Safari edition

The iPhone/iPad Safari edition is the standalone userscript [`platforms/stay/english-reader.user.js`](platforms/stay/english-reader.user.js). It currently supports English-to-Chinese reading and stores its learning library locally in Stay without an account or cross-device sync.

Tap the green **戳** floating button to:

- enable or disable selection handling;
- choose **Google** or **DeepSeek** translation mode;
- enter and test a personal DeepSeek API key only when DeepSeek is selected;
- open the local vocabulary and sentence library.

Google Web translation is experimental and may be rate-limited or changed. When DeepSeek is selected, chosen text is sent to DeepSeek; the API key remains in Stay's local storage.

### Install

Chrome:

1. Download and extract this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the folder containing `manifest.json`.

Stay on iPhone/iPad:

1. Install Stay and enable its Safari extension under **Settings → Apps → Safari → Extensions**.
2. Open the raw userscript link on GitHub or import `platforms/stay/english-reader.user.js` into Stay.
3. Enable the script, open a normal English `https://` page in Safari, reload once, and select text.

See [`docs/stay-testing.md`](docs/stay-testing.md) for detailed mobile testing instructions.

### Development

Run checks with Node.js 20 or later:

```sh
node --test tests/*.test.mjs
```

All repository paths and filenames remain lowercase for compatibility with the case-insensitive exFAT project disk.

## 中文

Poke Poke（戳戳）是一款网页阅读学习工具，让用户无需离开当前页面即可查词、理解句子并积累词汇和固定搭配。戳词，戳句，继续读。本仓库分别维护 Chrome 版和 Stay/Safari 版。

### Chrome 版

- 在网页中选择单词、短语或句子后显示紧凑学习卡片。
- 使用 Chrome 内置 Translator API 与 Language Detector API，将支持的语言翻译为简体中文。
- 可选择使用用户自己的 DeepSeek API Key 增强句子分析。
- 参考选区附近的上下文判断词义，并避免跨越句号取词。
- 使用系统语音朗读选区、用 `/` 分句，并识别、高亮常见固定搭配。
- 在本地保存单词和句子，支持搜索、隐藏翻译、批量删除，以及按选择导出 CSV 或 HTML。

建议使用 Chrome 138 或更高版本。首次翻译某种语言时，Chrome 可能下载本地语言包。Chrome 内部页面、Chrome 应用商店和部分受保护页面不允许注入扩展脚本。

### Stay / Safari 版

iPhone/iPad Safari 版是独立用户脚本 [`platforms/stay/english-reader.user.js`](platforms/stay/english-reader.user.js)。目前专注英语到中文，学习库仅保存在 Stay 本地，不需要账户，也不做跨设备同步。

点击绿色 **戳** 悬浮球可以：

- 通过开关启用或停用网页划词；
- 选择 **Google** 或 **DeepSeek** 翻译模式；
- 仅在选择 DeepSeek 时填写并测试个人 API Key；
- 打开本地单词库和句子库。

Google Web 翻译属于实验性接口，可能限流或发生变化。选择 DeepSeek 后，所选文本会发送给 DeepSeek，API Key 只保存在 Stay 的本地存储中。

### 安装

Chrome：

1. 下载并解压本仓库。
2. 打开 `chrome://extensions`，开启“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择包含 `manifest.json` 的目录。

iPhone/iPad Stay：

1. 安装 Stay，并在 **设置 → App → Safari 浏览器 → 扩展** 中启用 Stay。
2. 打开 GitHub 上的 Raw 用户脚本链接，或者把 `platforms/stay/english-reader.user.js` 导入 Stay。
3. 启用脚本，在 Safari 打开普通英文 `https://` 网页，刷新一次后选择文字。

更详细的手机测试方法见 [`docs/stay-testing.md`](docs/stay-testing.md)。

### 本地检查

使用 Node.js 20 或更高版本：

```sh
node --test tests/*.test.mjs
```

为兼容项目所在的大小写不敏感 exFAT 磁盘，仓库内所有路径和文件名均保持小写。
