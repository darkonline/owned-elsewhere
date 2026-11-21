# Store listing — Owned Elsewhere 2.0

Packages: `dist/owned-elsewhere-2.0-chrome.zip` (Chrome Web Store, Microsoft Edge Add-ons, Opera),
`dist/owned-elsewhere-2.0-firefox.zip` + `dist/owned-elsewhere-2.0-source.zip` (addons.mozilla.org).
Icon: `store/icon-512.png` (Edge needs 300×300+, Chrome uses the 128 px icon from the package). Screenshots: `store/screenshots/`.

Category: Shopping (Chrome: "Shopping"; Edge: "Shopping"; Firefox: "Shopping").
Languages: English (default), Russian.
Privacy policy URL: link to PRIVACY.md in the GitHub repository.

---

## English

**Name:** Owned Elsewhere — library checker for Steam

**Short description (≤132):**
Shows on Steam store pages which games you already own in Epic Games Store, GOG, Xbox, Ubisoft and other libraries.

**Description:**
Stop buying the same game twice. Owned Elsewhere marks games on the Steam store that you already own in other libraries.

• Game pages: one clear banner — "You already own this game: Epic Games Store".
• Bundles and packages: how much of it you already own — "1 of 2", with the game names.
• DLC pages: whether you own the base game.
• Search, wishlist, cart and store lists: a small badge next to games you own.
• Subscriptions and in-game currency are never marked.

Import your library from:
• GOG Galaxy 2.0 — the most accurate: exact Steam IDs for games from every store connected to Galaxy (Epic, GOG, Xbox, Ubisoft, EA, Amazon, Battle.net…)
• Playnite — CSV export, column names in any Playnite language
• Heroic Games Launcher — Epic, GOG and Amazon libraries
• Any CSV/TSV spreadsheet, or a plain list of titles

Private by design: your library stays in your browser. No accounts, no tracking, no analytics.

Not affiliated with Valve, GOG, Epic Games or any other store.

## Русский

**Название:** Owned Elsewhere — проверка библиотек для Steam

**Краткое описание (≤132):**
Показывает в магазине Steam, какие игры у вас уже есть в Epic Games Store, GOG, Xbox, Ubisoft и других библиотеках.

**Описание:**
Хватит покупать одну игру дважды. Owned Elsewhere отмечает в магазине Steam игры, которые у вас уже есть в других библиотеках.

• Страница игры: одна понятная плашка — «Эта игра у вас уже есть: Epic Games Store».
• Наборы и пакеты: какая часть уже есть — «1 из 2», с названиями игр.
• Страницы DLC: есть ли у вас основная игра.
• Поиск, список желаемого, корзина и подборки: небольшая отметка рядом с купленными играми.
• Подписки и внутриигровая валюта не отмечаются.

Откуда загрузить библиотеку:
• GOG Galaxy 2.0 — точнее всего: Steam ID для игр из всех магазинов, подключённых к Galaxy (Epic, GOG, Xbox, Ubisoft, EA, Amazon, Battle.net…)
• Playnite — выгрузка в CSV, названия колонок на любом языке Playnite
• Heroic Games Launcher — библиотеки Epic, GOG и Amazon
• Любая таблица CSV/TSV или просто список названий

Конфиденциально: библиотека хранится только в вашем браузере. Без регистрации, отслеживания и аналитики.

Проект не связан с Valve, GOG, Epic Games и другими магазинами.

---

## Chrome Web Store — privacy tab

**Single purpose:** Show on Steam store pages which games the user already owns in other game libraries that the user imported.

**Permission justifications:**
- `storage` — saves the imported game list (titles, store names, Steam App IDs) and settings locally.
- Host access `https://store.steampowered.com/*` (content script) — adds the "already owned" badges to Steam store pages,
  reads the public package contents API on the same site to count owned games in bundles, and — only when the user clicks
  "Hide in Steam" — calls Steam's own ignore endpoint for that game.
- `scripting` + optional host access `https://steamcommunity.com/*` — requested only if the user turns on badges for Steam
  profile game lists; registers the same content script there.

**Remote code:** No. All code is in the package; sql.js WebAssembly is bundled (`lib/sql-wasm.wasm`), hence `'wasm-unsafe-eval'`.

**Data usage:** No data is collected. Check none of the data types. Certify all three disclosures.

## Firefox (AMO) — reviewer notes

Third-party libraries are unmodified releases from npm: sql.js 1.12.0 (`dist/sql-wasm.js`, `dist/sql-wasm.wasm`) and
papaparse 5.5.3 (`papaparse.min.js`). No build step for the extension code itself; the source zip is the same code plus
the string table generator (`tools/locales.js`). `'wasm-unsafe-eval'` is required by sql.js to read the GOG Galaxy SQLite database locally.
