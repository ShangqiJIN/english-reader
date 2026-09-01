# English Reader

English Reader is a reading-learning prototype with separate Chrome and Stay/Safari editions.

## Features

- Select English text on an HTTP or HTTPS webpage to open the learning card.
- Pause or resume all webpage selection handling from the extension popup without affecting the learning library.
- Classify short selections as vocabulary and longer selections as sentences.
- Save results to `chrome.storage.local`.
- Browse saved vocabulary and sentences in the Chrome side panel.
- Translate detected source languages to Simplified Chinese locally with Chrome's built-in Translator API when available.
- Detect the selected language with Chrome's built-in Language Detector API before translating.
- Translate supported languages such as English, French, German, and Korean into Simplified Chinese.
- Keep Chrome's on-device Translator API as the default, with optional `deepseek-v4-flash` enhancement for vocabulary and sentences.
- Ask DeepSeek for at most two concise vocabulary meanings, ranked from the three words before and after the selection without crossing sentence boundaries.
- Read selected words, phrases, and sentences aloud with system voices.
- Detect and highlight a packaged set of common English collocations.
- Keep DeepSeek sentence chunks verbatim in the original language; only the overall translation is Chinese.
- Search, export, and selectively delete saved learning records.
- Export a complete JSON backup or the current filtered view as CSV.

Chrome 138 or later is required for built-in language detection and translation. The first use of a language may download its translation language pack. Chrome translation stays on-device. Enabling DeepSeek sends selected vocabulary with its three-word windows, or selected sentences with nearby context, to DeepSeek.

## Load locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Download this repository and extract it.
4. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.
5. Open an English webpage and select a word or sentence.

Chrome internal pages, the Chrome Web Store, and some protected documents do not allow content-script injection.

## Stay / Safari prototype

The iPhone, iPad, and macOS Safari prototype is a standalone userscript at
`platforms/stay/english-reader.user.js`. It runs through Stay and uses its local
storage for the learning library. Unlike the Chrome edition, selected text is
sent to an experimental Google Web Translation endpoint.

See `docs/stay-testing.md` for phone installation and testing instructions, and
`docs/project-structure.md` for the platform boundaries.

## Local checks

Use the bundled Node runtime or another Node 20+ installation:

```sh
node --test tests/*.test.mjs
```

All repository paths and filenames must remain lowercase because the SSD is formatted as case-insensitive exFAT.
