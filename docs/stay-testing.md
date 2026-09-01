# Test on iPhone or iPad with Stay

## Install

1. Install and open **Stay for Safari** on the iPhone or iPad.
2. Follow Stay's prompt to enable its Safari extension in **Settings → Apps → Safari → Extensions**. Allow it on websites.
3. Transfer `platforms/stay/english-reader.user.js` to the device with AirDrop, iCloud Drive, or a GitHub raw-file link.
4. In Stay, create/import a userscript and paste or import the complete file.
5. Confirm the script is enabled and its website scope includes the page being tested.
6. Open a normal English `https://` webpage in Safari, reload it once, then select a word or full sentence.

The card should appear near the bottom of the screen. The first result depends on network access to Google. The selected text is sent to Google Web Translation.

## Learning library

Open Stay's script menu for the current page and choose **English Reader：打开学习库**. The same menu includes JSON export. Each entry also has a delete button.

## Recommended checks

1. Select one word and confirm only that word appears.
2. Tap the speaker button and confirm English audio plays.
3. Tap outside the card, select a sentence, and confirm a second request starts.
4. Select a sentence containing `take into account` and confirm the collocation is highlighted.
5. Open the learning library and confirm both records are present.
6. Export JSON before testing deletion.

## Common limitations

- Safari may keep the native selection menu open over the page; tap away and select again if it covers the card.
- The Google Web endpoint is unofficial and may be blocked, rate-limited, or changed without notice.
- Safari reader view, PDFs, protected pages, and pages inside some embedded frames may not expose selection events to userscripts.
- Stay's local library is separate from Chrome's library and does not sync yet.
