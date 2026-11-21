// Source of truth for UI strings. Run `node tools/locales.js` to regenerate extension/_locales/*/messages.json.
// Each entry: key: [English, Russian]. Use $1, $2 for substitutions. src_*_steps: one step per line.
const fs = require('fs');
const path = require('path');

const S = {
  extName: ['Owned Elsewhere — library checker for Steam', 'Owned Elsewhere — проверка библиотек для Steam'],
  extShortName: ['Owned Elsewhere', 'Owned Elsewhere'],
  extDescription: [
    'Shows on Steam store pages which games you already own in Epic Games Store, GOG, Xbox, Ubisoft and other libraries.',
    'Показывает в магазине Steam, какие игры у вас уже есть в Epic Games Store, GOG, Xbox, Ubisoft и других библиотеках.'],
  optionsTitle: ['Owned Elsewhere — libraries', 'Owned Elsewhere — библиотеки'],

  // ---- adding a library ----
  secAdd: ['Add a library', 'Добавить библиотеку'],
  chooseSource: ['Where is your library? Pick a source to see how to export it.', 'Где ваша библиотека? Выберите источник — появится инструкция, как её выгрузить.'],
  dropHere: ['…or drop any supported file here', '…или просто перетащите сюда любой поддерживаемый файл'],
  dropFormats: ['GOG Galaxy database (.db), CSV/TSV (Playnite, GOG Galaxy Export Script, spreadsheets), Heroic JSON, text list (.txt), backup (.json)',
    'База GOG Galaxy (.db), CSV/TSV (Playnite, GOG Galaxy Export Script, таблицы), JSON из Heroic, список (.txt), резервная копия (.json)'],
  orDrop: ['or drop the file here', 'или перетащите файл сюда'],
  srcTagBest: ['most accurate', 'точнее всего'],
  pickGalaxy: ['Choose galaxy-2.0.db…', 'Выбрать galaxy-2.0.db…'],
  pickCsv: ['Choose CSV file…', 'Выбрать CSV-файл…'],
  pickJson: ['Choose JSON file…', 'Выбрать JSON-файл…'],
  pickTxt: ['Choose .txt file…', 'Выбрать .txt-файл…'],

  src_galaxy_steps: [
    'Install GOG Galaxy 2.0 and sign in with a GOG account (free).\n' +
    'Connect your stores: Settings (gear icon, top left) → Integrations → Connect next to Epic Games Store, Xbox, Ubisoft Connect, EA app, Amazon Games, Battle.net and others. Connect Steam too — then the extension knows what you already have on Steam.\n' +
    'Wait until the games appear under “All games” (usually a few minutes).\n' +
    'Quit GOG Galaxy completely: tray icon → Exit. While it runs, the newest changes may not be written to the file yet.\n' +
    'Press the button below, paste the path into the “File name” field and press Enter (ProgramData is a hidden folder, the path is the easy way in).',
    'Установите GOG Galaxy 2.0 и войдите в аккаунт GOG (бесплатно).\n' +
    'Подключите магазины: Настройки (шестерёнка слева вверху) → Интеграции → «Подключить» у Epic Games Store, Xbox, Ubisoft Connect, EA app, Amazon Games, Battle.net и других. Steam тоже подключите — тогда расширение будет знать, что уже есть в Steam.\n' +
    'Дождитесь, пока игры появятся в разделе «Все игры» (обычно несколько минут).\n' +
    'Полностью закройте GOG Galaxy: значок в трее → «Выход». Пока Galaxy работает, свежие изменения могут быть ещё не записаны в файл.\n' +
    'Нажмите кнопку ниже, вставьте путь в поле «Имя файла» и нажмите Enter (папка ProgramData скрытая, так проще всего).'],
  src_galaxy_note: [
    'Xbox libraries in Galaxy also contain Game Pass games, so Xbox matches are shown as “maybe” — change this under “Store trust”.',
    'Библиотека Xbox в Galaxy включает и игры из Game Pass, поэтому совпадения с Xbox показываются как «возможно» — это меняется в разделе «Доверие к магазинам».'],

  src_playnite_steps: [
    'In Playnite press F9 (Add-ons) → Browse → Generic, find “Library Exporter Advanced”, install it and restart Playnite.\n' +
    'Open the add-on settings (F9 → Installed → Generic → Library Exporter Advanced) and enable at least the columns Name, Sources and Platforms. Platforms tells PC games from Xbox console games.\n' +
    'Export: Playnite main menu → Extensions → Library Exporter Advanced → Export library, save the CSV file.\n' +
    'Drop the file here or press the button below. No need to rename the columns: an export in any Playnite language works, titles with commas are read correctly.',
    'В Playnite нажмите F9 («Дополнения») → «Обзор» → «Общие», найдите «Library Exporter Advanced», установите и перезапустите Playnite.\n' +
    'Откройте настройки дополнения (F9 → «Установленные» → «Общие» → Library Exporter Advanced) и включите как минимум колонки «Название», «Источники» и «Платформы». «Платформы» нужны, чтобы отличать игры для ПК от консольных игр Xbox.\n' +
    'Выгрузка: главное меню Playnite → «Расширения» → Library Exporter Advanced → «Export library», сохраните CSV-файл.\n' +
    'Перетащите файл сюда или нажмите кнопку ниже. Переименовывать колонки не нужно: подойдёт выгрузка на любом языке Playnite, названия с запятыми читаются правильно.'],
  src_playnite_note: [
    'Playnite’s Xbox library lists every game you have launched, including Game Pass and Games with Gold titles, so Xbox matches are shown as “maybe owned”. You can confirm them under “Check Xbox games”.',
    'Библиотека Xbox в Playnite содержит все запускавшиеся игры, в том числе из Game Pass и Games with Gold, поэтому совпадения с Xbox показываются как «возможно есть». Уточнить их можно в разделе «Проверка игр Xbox».'],
  playniteNoPlatform: ['Tip: add the Platforms column to the export to tell Xbox console games from PC games.',
    'Совет: добавьте в выгрузку колонку «Платформы», чтобы отличать консольные игры Xbox от ПК.'],

  src_heroic_steps: [
    'Open Heroic and sign in to Epic, GOG and/or Amazon under “Manage accounts”. Wait until the library has loaded.\n' +
    'Press the button below and open the store_cache folder (paths below). Choose legendary_library.json for Epic, gog_library.json for GOG, nile_library.json for Amazon — several files can be selected at once.',
    'Откройте Heroic и войдите в Epic, GOG и/или Amazon в разделе «Управление аккаунтами». Дождитесь загрузки библиотеки.\n' +
    'Нажмите кнопку ниже и откройте папку store_cache (пути ниже). Выберите legendary_library.json для Epic, gog_library.json для GOG, nile_library.json для Amazon — можно несколько файлов сразу.'],

  src_stores_title: ['Epic, Xbox, Ubisoft, EA, Amazon, Battle.net', 'Epic, Xbox, Ubisoft, EA, Amazon, Battle.net'],
  src_stores_steps: [
    'These stores have no library export of their own. Collect them through one of the apps below — they connect to all of these stores:\n' +
    'GOG Galaxy 2.0 — the most accurate: gives exact Steam IDs for most games.\n' +
    'Playnite — any language, distinguishes PC and console games if you export the Platforms column.\n' +
    'Heroic Games Launcher — Epic, GOG and Amazon only.',
    'У этих магазинов нет собственной выгрузки библиотеки. Соберите их через одну из программ ниже — они подключаются ко всем этим магазинам:\n' +
    'GOG Galaxy 2.0 — точнее всего: даёт точные Steam ID для большинства игр.\n' +
    'Playnite — любой язык, отличает игры для ПК и консолей, если выгрузить колонку «Платформы».\n' +
    'Heroic Games Launcher — только Epic, GOG и Amazon.'],

  src_galaxycsv_steps: [
    'Install Python 3 and download GOG Galaxy Export Script (github.com/AB1908/GOG-Galaxy-Export-Script).\n' +
    'Quit GOG Galaxy, then in the script folder run: python galaxy_library_export.py\n' +
    'Choose the resulting gameDB.csv.',
    'Установите Python 3 и скачайте GOG Galaxy Export Script (github.com/AB1908/GOG-Galaxy-Export-Script).\n' +
    'Закройте GOG Galaxy и в папке скрипта выполните: python galaxy_library_export.py\n' +
    'Выберите получившийся файл gameDB.csv.'],
  src_galaxycsv_note: ['Loading galaxy-2.0.db directly is more accurate: it also gives Steam IDs.', 'Загрузка самой базы galaxy-2.0.db точнее: она даёт ещё и Steam ID.'],

  src_csv_title: ['Other CSV / spreadsheet', 'Другой CSV / таблица'],
  src_csv_steps: [
    'Any table saved as CSV or TSV works (Excel, Google Sheets, other launchers). It needs a column with the game title; a store column and a Steam App ID column make matching better.\n' +
    'Any delimiter and encoding (UTF-8, Windows-1251) is fine. If the columns are not recognised, you will be asked to pick them.',
    'Подойдёт любая таблица, сохранённая как CSV или TSV (Excel, Google Таблицы, другие лаунчеры). Нужна колонка с названием игры; колонки магазина и Steam App ID улучшают сравнение.\n' +
    'Разделитель и кодировка (UTF-8, Windows-1251) любые. Если колонки не распознаются, расширение предложит выбрать их вручную.'],

  src_list_title: ['List of titles', 'Список названий'],
  src_list_steps: [
    'Paste titles below, one game per line, or load a .txt file.\n' +
    'You can add the store after a tab, “ | ” or “;”, e.g. “Hades | Epic”. Otherwise the store selected below is used.',
    'Вставьте названия ниже, по одной игре на строку, или загрузите .txt-файл.\n' +
    'Магазин можно указать через табуляцию, « | » или «;», например «Hades | Epic». Иначе будет взят магазин, выбранный ниже.'],
  pastePlaceholder: ['Disco Elysium\nGrand Theft Auto V | Epic Games Store', 'Disco Elysium\nGrand Theft Auto V | Epic Games Store'],
  sourceTextList: ['Text list', 'Список'],

  src_backup_title: ['Backup', 'Резервная копия'],
  src_backup_steps: [
    'Restores libraries and settings saved with “Save backup” — for example, in another browser or on another computer.',
    'Восстанавливает библиотеки и настройки, сохранённые кнопкой «Сохранить копию», — например, в другом браузере или на другом компьютере.'],

  importing: ['Reading $1…', 'Читаю $1…'],
  importDone: ['$1: $2 games imported.', '$1: загружено игр — $2.'],
  importDoneIds: ['$1: $2 games imported, $3 of them matched to Steam IDs.', '$1: загружено игр — $2, из них с точным Steam ID — $3.'],
  errImport: ['Could not import $1: $2', 'Не удалось загрузить $1: $2'],
  errWalFile: ['This is a GOG Galaxy service file. Choose galaxy-2.0.db instead.', 'Это служебный файл GOG Galaxy. Выберите galaxy-2.0.db.'],
  errNotGalaxyDb: ['This database is not a GOG Galaxy 2.0 library.', 'Эта база данных не похожа на библиотеку GOG Galaxy 2.0.'],
  errBadJson: ['The JSON file is damaged.', 'Файл JSON повреждён.'],
  errNoGamesFound: ['No games found in this file.', 'В файле не найдено игр.'],
  txtLoaded: ['Text list loaded below: pick its store and press Import.', 'Список загружен ниже: выберите магазин и нажмите «Загрузить».'],

  mapTitle: ['Which columns are which?', 'Какие колонки за что отвечают?'],
  mapHint: ['The file columns were not recognised automatically. Pick them once — the rest is automatic.',
    'Колонки файла не распознались автоматически. Укажите их — остальное расширение сделает само.'],
  mapColTitle: ['Game title', 'Название игры'],
  mapColStore: ['Store / library', 'Магазин / библиотека'],
  mapColPlatform: ['Platform (optional)', 'Платформа (необязательно)'],
  mapColAppId: ['Steam App ID (optional)', 'Steam App ID (необязательно)'],
  mapDefaultStore: ['Store if not specified', 'Магазин, если не указан'],
  mapNone: ['— none —', '— нет —'],
  mapNeeded: ['Check the columns below.', 'Проверьте колонки ниже.'],
  import: ['Import', 'Загрузить'],
  cancel: ['Cancel', 'Отмена'],

  // ---- libraries ----
  secLibraries: ['Loaded libraries', 'Загруженные библиотеки'],
  noLibraries: ['Nothing loaded yet.', 'Пока ничего не загружено.'],
  libCount: ['$1 games', 'игр: $1'],
  libWithIds: ['$1 with Steam ID', 'с Steam ID: $1'],
  totalUnique: ['Unique games: $1', 'Уникальных игр: $1'],
  remove: ['Remove', 'Удалить'],
  clearAll: ['Remove all', 'Удалить все'],
  confirmClearAll: ['Remove all loaded libraries?', 'Удалить все загруженные библиотеки?'],
  cleared: ['All libraries removed.', 'Все библиотеки удалены.'],
  exportBackup: ['Save backup', 'Сохранить копию'],
  confirmRestore: ['Replace current libraries and settings with this backup?', 'Заменить текущие библиотеки и настройки данными из копии?'],
  restored: ['Backup restored.', 'Копия восстановлена.'],

  // ---- store trust ----
  secStores: ['Store trust', 'Доверие к магазинам'],
  storesHint: [
    '“Owned” — a library entry means you bought the game. “Maybe owned” — a softer note: the store also lists subscription games (Xbox Game Pass, Games with Gold), console versions, or Windows-only releases when you play on macOS or Linux. Steam games are never reported as “elsewhere”: they only tell the extension that you already have the game on Steam.',
    '«Есть» — запись в библиотеке означает, что игра куплена. «Возможно есть» — мягкая пометка: в библиотеке магазина бывают игры по подписке (Xbox Game Pass, Games with Gold), консольные версии или версии только для Windows, если вы играете на macOS или Linux. Игры из Steam никогда не показываются как «в другом месте» — по ним расширение лишь понимает, что игра уже есть в Steam.'],
  modeOwned: ['Owned', 'Есть'],
  modeMaybe: ['Maybe owned', 'Возможно есть'],
  modeOff: ['Ignore', 'Не учитывать'],
  storeOther: ['other library', 'другая библиотека'],

  // ---- settings ----
  secSettings: ['Settings', 'Настройки'],
  set_showBundles: ['Show how much of a bundle you already own', 'Показывать, какая часть набора у вас уже есть'],
  set_showInLists: ['Mark games in search, wishlist, cart and store lists', 'Отмечать игры в поиске, списке желаемого, корзине и подборках'],
  set_matchByTitle: ['Match by title when there is no Steam ID', 'Сравнивать по названию, если нет Steam ID'],
  set_matchEditions: ['Note other editions (e.g. “GTA V” for “GTA V Legacy”) as “maybe”', 'Отмечать другие издания (например «GTA V» для «GTA V Legacy») как «возможно»'],
  set_showDlcBase: ['On DLC pages, note if the base game is owned', 'На страницах DLC отмечать, есть ли основная игра'],

  // ---- search / ignore ----
  secSearch: ['Check a game', 'Проверить игру'],
  searchPlaceholder: ['Title or Steam App ID', 'Название или Steam App ID'],
  searchNothing: ['Not found in your libraries.', 'В ваших библиотеках не найдено.'],
  searchMore: ['…and $1 more', '…и ещё $1'],
  secIgnored: ['Games not marked on Steam', 'Игры, которые не отмечаются в Steam'],
  ignoredEmpty: ['None. Use × on a Steam page or “Don’t mark” above to hide a wrong match.', 'Нет. Нажмите × на странице Steam или «Не отмечать» выше, чтобы скрыть неверное совпадение.'],
  ignoredTitle: ['Title “$1”', 'Название «$1»'],
  ignore: ['Don’t mark', 'Не отмечать'],
  unignore: ['Mark again', 'Отмечать снова'],
  ignoreGame: ['Don’t mark this game (e.g. it was from a subscription)', 'Не отмечать эту игру (например, она была по подписке)'],

  copy: ['Copy', 'Копировать'],
  copied: ['Copied', 'Скопировано'],
  privacyNote: ['Your library stays in this browser. Nothing is sent anywhere.', 'Библиотека хранится только в этом браузере и никуда не отправляется.'],

  // ---- popup ----
  openImport: ['Import and manage libraries', 'Загрузить и настроить библиотеки'],
  popupHint: ['Files are added on a full page: a popup closes when the file dialog opens.',
    'Файлы добавляются на отдельной странице: всплывающее окно закрывается при открытии выбора файла.'],
  popupEmpty: ['No libraries yet. Add one to start.', 'Библиотеки ещё не загружены. Добавьте хотя бы одну.'],

  // ---- store variants ----
  variant_console: ['console', 'консоль'],
  variant_pc: ['PC', 'ПК'],
  variant_winonly: ['Windows only', 'только Windows'],
  winOnlyNoteMac: ['The release in that store is for Windows only — it will not run on your Mac.', 'Версия в этом магазине только для Windows — на вашем Mac она не запустится.'],
  winOnlyNoteLinux: ['The release in that store is for Windows only — on Linux it needs Proton/Wine (e.g. Heroic, Lutris), while the Steam version can run through Steam Play.',
    'Версия в этом магазине только для Windows — на Linux её придётся запускать через Proton/Wine (например, Heroic или Lutris), а версию из Steam — через Steam Play.'],
  osUnknownNote: ['Check that $2 has a $1 version — the library file does not say.', 'Проверьте, есть ли в $2 версия для $1 — в файле библиотеки это не указано.'],

  // ---- hide in Steam ----
  hideInSteam: ['Hide in Steam: I own it elsewhere', 'Скрыть в Steam: есть в другом магазине'],
  unhideInSteam: ['Show in Steam again', 'Вернуть в Steam'],
  hiddenInSteam: ['Hidden in Steam (Ignore → “Own it on another store”).', 'Скрыто в Steam («Скрыть» → «Есть в другом магазине»).'],
  hideInSteamError: ['Steam did not accept the request. Are you signed in?', 'Steam не принял запрос. Вы вошли в аккаунт?'],
  hideInSteamTip: ['Uses Steam’s own “Ignore” with the reason “I own it on another store”: the game stops appearing in recommendations and, if enabled in Steam, in search. Undo any time here or on the game page.',
    'Использует штатную функцию Steam «Скрыть» с причиной «Есть в другом магазине»: игра пропадёт из рекомендаций и, если это включено в настройках Steam, из поиска. Отменить можно здесь или на странице игры.'],

  // ---- settings: OS, profile pages ----
  set_myOS: ['I play on', 'Я играю на'],
  os_auto: ['Detect automatically ($1)', 'Определить автоматически ($1)'],
  os_win: ['Windows', 'Windows'],
  os_mac: ['macOS', 'macOS'],
  os_linux: ['Linux / Steam Deck', 'Linux / Steam Deck'],
  set_showCommunity: ['Mark games on Steam profile game lists (yours and friends’) — asks for access to steamcommunity.com',
    'Отмечать игры в списках игр профилей Steam (ваших и друзей) — попросит доступ к steamcommunity.com'],
  set_hideInSteamButton: ['Show the “Hide in Steam” button on game pages', 'Показывать кнопку «Скрыть в Steam» на страницах игр'],

  // ---- Xbox check ----
  secXbox: ['Check Xbox games', 'Проверка игр Xbox'],
  xboxHint: ['Xbox libraries mix bought games with Game Pass and Games with Gold titles, console-only releases and old Xbox 360 / Games for Windows Live licences, and miss bought games you never launched. Mark each game once — the mark then overrides the store trust setting. If a console game supports Xbox Play Anywhere, choose “Bought — playable on PC”.',
    'В библиотеке Xbox вперемешку купленные игры, игры из Game Pass и Games with Gold, консольные версии и старые лицензии Xbox 360 / Games for Windows Live, а купленные, но ни разу не запущенные игры туда не попадают. Отметьте каждую игру один раз — отметка важнее настройки доверия к магазину. Если консольная игра поддерживает Xbox Play Anywhere, выберите «Куплено — есть на ПК».'],
  xboxTemplate: ['Download as a spreadsheet', 'Скачать таблицей'],
  xboxImport: ['Load filled-in spreadsheet', 'Загрузить заполненную таблицу'],
  xboxOnlyUnchecked: ['Only unchecked', 'Только непроверенные'],
  xboxProgress: ['Checked: $1 of $2', 'Проверено: $1 из $2'],
  xboxColPlatform: ['Platform', 'Платформа'],
  xboxColStatus: ['Status', 'Статус'],
  xboxImported: ['Xbox check: $1 games marked.', 'Проверка Xbox: отмечено игр — $1.'],
  verdict_none: ['— not checked —', '— не проверено —'],
  verdict_pc: ['Bought — playable on PC', 'Куплено — есть на ПК'],
  verdict_console: ['Bought — console only', 'Куплено — только консоль'],
  verdict_sub: ['Subscription / not mine — ignore', 'Подписка / не моя — не учитывать'],
  verdictWord_pc: ['PC', 'ПК'],
  verdictWord_console: ['console', 'консоль'],
  verdictWord_sub: ['subscription', 'подписка'],

  // ---- Steam pages ----
  bannerOwned: ['You already own this game', 'Эта игра у вас уже есть'],
  bannerMaybe: ['Looks like you may already have this game', 'Похоже, эта игра у вас уже есть'],
  bannerLoose: ['You have another edition of this game', 'У вас есть другое издание этой игры'],
  bannerSteam: ['This game is already in your Steam library', 'Эта игра уже есть в вашей библиотеке Steam'],
  bannerSteamAlso: ['You also have this game in other libraries', 'Эта игра есть и в других ваших библиотеках'],
  alsoMaybe: ['Maybe also in: $1', 'Возможно, есть и в: $1'],
  alsoIn: ['Also in: $1', 'Также есть: $1'],
  looseNote: ['Matched “$1” — a different edition or release, compare the contents.', 'Совпадение с «$1» — это другое издание или выпуск, сравните состав.'],
  matchedByTitleNote: ['Matched by title (“$1”), not by Steam ID.', 'Совпадение по названию («$1»), а не по Steam ID.'],
  consoleNote: ['Console version: it does not let you play on PC.', 'Консольная версия: на ПК в неё не поиграть.'],
  xboxNote: ['Xbox libraries also list Game Pass and Games with Gold titles that you do not own.', 'В библиотеке Xbox бывают игры из Game Pass и Games with Gold, которые вам не принадлежат.'],

  listOwned: ['Owned in: $1', 'Есть в: $1'],
  listMaybe: ['Maybe owned in: $1', 'Возможно есть в: $1'],
  listLoose: ['Other edition in: $1', 'Другое издание в: $1'],
  listSteam: ['In your Steam library', 'Есть в Steam'],
  listSteamAlso: ['In Steam, also: $1', 'Есть в Steam, а также: $1'],

  itemOwned: ['You already own this', 'Это у вас уже есть'],
  itemMaybe: ['You may already have this', 'Возможно, это у вас уже есть'],
  bundleAllOwned: ['You already own everything in this package ($1 of $1)', 'Всё из этого набора у вас уже есть ($1 из $1)'],
  bundlePartial: ['You already own $1 of $2 items in this package', 'Из этого набора у вас уже есть $1 из $2'],
  bundleMaybe: ['You may already have $1 of $2 items in this package', 'Возможно, из этого набора у вас уже есть $1 из $2'],
  bundleAllOwnedShort: ['Owned: all $1', 'Есть всё: $1'],
  bundlePartialShort: ['Owned: $1 of $2', 'Есть $1 из $2'],
  bundleMaybeShort: ['Maybe: $1 of $2', 'Возможно: $1 из $2'],
  labelHave: ['Owned:', 'Есть:'],
  labelMaybe: ['Maybe owned:', 'Возможно есть:'],
  labelMissing: ['Not owned:', 'Нет:'],
  dlcBaseOwned: ['Base game owned: $1', 'Основная игра есть: $1'],
  dlcBaseMaybe: ['Base game maybe owned: $1', 'Основная игра, возможно, есть: $1'],
  dlcBaseSteam: ['Base game is in your Steam library', 'Основная игра есть в Steam']
};

const langs = { en: 0, ru: 1 };
for (const [lang, i] of Object.entries(langs)) {
  const out = {};
  for (const [k, v] of Object.entries(S)) out[k] = { message: v[i] };
  const dir = path.join(__dirname, '..', 'extension', '_locales', lang);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'messages.json'), JSON.stringify(out, null, 2) + '\n');
}
console.log('locales written:', Object.keys(langs).join(', '), '-', Object.keys(S).length, 'keys');
