# Project structure

The project has one product core and separate browser adapters.

```text
english-reader/
├── manifest.json                 # Chrome MV3 manifest
├── src/
│   ├── shared/                   # Browser-neutral models, text rules, and exports
│   ├── content/                  # Chrome webpage selection card
│   ├── background/               # Chrome service worker and storage coordination
│   ├── popup/                    # Chrome toolbar popup
│   └── sidepanel/                # Chrome learning library
├── platforms/
│   └── stay/
│       └── english-reader.user.js # iPhone/iPad/macOS Safari userscript
├── docs/
│   ├── project-structure.md
│   └── stay-testing.md
└── tests/                        # Shared logic tests
```

## Boundaries

- `src/shared/` is the long-term source of truth for data models, selection classification, collocations, and export formats.
- Chrome uses `chrome.storage.local`, the Chrome Translator API, a service worker, and a side panel.
- Stay uses `GM_getValue`, `GM_setValue`, `GM_xmlhttpRequest`, and an in-page learning-library panel.
- Stay is a Safari userscript host, not a formally packaged Safari Web Extension. A future `platforms/safari-extension/` can wrap the shared core if App Store distribution is needed.

The first Stay prototype is intentionally a self-contained userscript because mobile userscript managers install a single file. Its data fields mirror the Chrome models. A later build step can generate that file from `src/shared/` without changing its installed behavior.
