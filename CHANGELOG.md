# Changelog

## 2.0 — 2026-11-22

Renamed from "Stop Before You Buy — Game Library Tracker" to **Owned Elsewhere**.

- One banner per game page instead of a badge on every purchase block (fixes duplicated and repeated badges).
- Subscriptions and in-game currency packages are no longer marked as owned.
- Bundles and multi-game packages show partial ownership ("1 of 2") using exact Steam App IDs, the same way on game and DLC pages.
- DLC pages say whether the base game is owned.
- Matching by Steam App ID; title matching is a labelled fallback. Betas and demos are not linked to the full game.
- Store names are unified: "Epic" → "Epic Games Store", "Uplay" → "Ubisoft Connect", "Origin" → "EA app", etc.
- Import moved to a full options page: the file dialog and drag-and-drop work without opening a separate tab first.
- New sources: GOG Galaxy 2.0 database, Heroic Games Launcher, plain text lists, backups; Playnite CSV in any interface language,
  column picker for unknown CSV files, windows-1251 encoding.
- Several libraries can be loaded at once; search in the loaded libraries; settings; English and Russian interface.
- Three kinds of marks: "owned" (violet), "maybe" (dashed: Xbox libraries with Game Pass titles, console versions,
  another edition such as GTA V vs GTA V Legacy) and "already in Steam" (grey, with the other stores listed).
- Store trust settings (owned / maybe / ignore per store) and a per-game "don't mark" list (× on the banner).
- Bundles are counted per game with names: "Owned: … Maybe: … Not owned: …"; missing names are fetched from Steam,
  so title-only libraries (Playnite) work in bundles too.
- Cart and wishlist: the badge sits under the game title instead of next to price links; no interference with page hydration.
- Search results: the whole row is highlighted, the badge is on its own line.
- Import page: choose a source first, step-by-step export instructions for GOG Galaxy, Playnite (Library Exporter Advanced),
  Heroic, GOG Galaxy Export Script, any CSV and plain lists; per-source file buttons.
- Playnite: Platforms column (any language) and "(Xbox One)"-style title suffixes mark console-only games.
- Xbox games are split into PC and console releases; "Check Xbox games" lets you mark each one (bought on PC / console only /
  subscription), in the page or through a downloadable spreadsheet.
- "I play on" setting (Windows / macOS / Linux): Windows-only releases in other stores become "maybe owned" with a note.
- "Hide in Steam: I own it elsewhere" button — Steam's own Ignore with the reason "owned on another store".
- Optional badges on Steam profile game lists (yours and friends'); asks for steamcommunity.com access only when turned on.
- Wishlist: the badge is laid over the game image (rows there have a fixed height); own tooltips that are never cut off.
- Wording: "Owned in: …", "Maybe owned in: …".
- Works in Chrome, Edge, Opera and Firefox.
