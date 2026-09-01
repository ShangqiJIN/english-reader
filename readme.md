# English Reader

English Reader is a local-first Chrome Manifest V3 prototype for learning words and difficult sentences without leaving the current webpage.

## Features

- Select English text on an HTTP or HTTPS webpage to open the learning card.
- Classify short selections as vocabulary and longer selections as sentences.
- Save results to `chrome.storage.local`.
- Browse saved vocabulary and sentences in the Chrome side panel.
- Translate English to Simplified Chinese locally with Chrome's built-in Translator API when available.
- Read selected words, phrases, and sentences aloud with system voices.
- Detect and highlight a packaged set of common English collocations.
- Search, export, and selectively delete saved learning records.
- Export a complete JSON backup or the current filtered view as CSV.

Chrome 138 or later is required for built-in translation. The first translation may download an English-to-Chinese language pack. No selected webpage text is sent to a remote service.

## Load locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Download this repository and extract it.
4. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.
5. Open an English webpage and select a word or sentence.

Chrome internal pages, the Chrome Web Store, and some protected documents do not allow content-script injection.

## Local checks

Use the bundled Node runtime or another Node 20+ installation:

```sh
node --test tests/*.test.mjs
```

All repository paths and filenames must remain lowercase because the SSD is formatted as case-insensitive exFAT.
