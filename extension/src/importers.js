/* Library importers. Each returns { kind, name, items, info } where items = [{ t, o?, s: [stores], a: [steamAppIds], d? }]. */
'use strict';

var Importers = (() => {

  // ---------- GOG Galaxy 2.0 database (galaxy-2.0.db) ----------

  // Release-key prefixes used by GOG Galaxy integrations.
  const GALAXY_PLATFORMS = {
    steam: 'Steam', epic: 'Epic Games Store', gog: 'GOG', uplay: 'Ubisoft Connect', origin: 'EA app',
    xboxone: 'Xbox / Microsoft Store', xboxog: 'Xbox / Microsoft Store', winstore: 'Xbox / Microsoft Store',
    amazon: 'Amazon Games', battlenet: 'Battle.net', itch: 'itch.io', humble: 'Humble',
    rockstar: 'Rockstar Games Launcher', bethesda: 'Bethesda.net', psn: 'PlayStation', nswitch: 'Nintendo Switch',
    oculus: 'Meta Quest', riot: 'Riot Games', paradox: 'Paradox Plaza', fanatical: 'Fanatical',
    gmg: 'Green Man Gaming', indiegala: 'IndieGala', twitch: 'Twitch', discord: 'Discord',
    wargaming: 'Wargaming', minecraft: 'Minecraft', generic: 'Other', beamdog: 'Beamdog'
  };

  const NOT_FULL_GAME = /\b(beta|demo|playtest|play test|test|trial|preview|benchmark|server|dedicated server|sdk|editor)\b/i;

  let sqlPromise = null;
  function getSql() {
    if (!sqlPromise) sqlPromise = initSqlJs({ locateFile: f => chrome.runtime.getURL('lib/' + f) });
    return sqlPromise;
  }

  function parseJson(s) { try { return JSON.parse(s); } catch (e) { return null; } }

  async function importGalaxyDb(buffer) {
    const SQL = await getSql();
    const db = new SQL.Database(new Uint8Array(buffer));
    try {
      const tables = new Set((db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0] || { values: [] }).values.map(r => r[0]));
      if (!tables.has('GamePieces') || !tables.has('GamePieceTypes')) throw new Error(OE.t('errNotGalaxyDb'));

      const typeIds = {};
      (db.exec("SELECT id, type FROM GamePieceTypes WHERE type IN ('title','originalTitle','allGameReleases','osCompatibility')")[0] || { values: [] })
        .values.forEach(([id, type]) => { typeIds[type] = id; });

      const keySources = [];
      if (tables.has('ProductPurchaseDates')) keySources.push('SELECT gameReleaseKey AS k FROM ProductPurchaseDates');
      if (tables.has('LibraryReleases')) keySources.push('SELECT releaseKey AS k FROM LibraryReleases');
      if (!keySources.length) throw new Error(OE.t('errNotGalaxyDb'));

      const games = new Map(); // releaseKey -> { title, originalTitle, releases, isDlc }
      const ensure = k => { if (!games.has(k)) games.set(k, {}); return games.get(k); };

      const owned = db.exec('SELECT DISTINCT k FROM (' + keySources.join(' UNION ') + ')')[0];
      (owned ? owned.values : []).forEach(([k]) => ensure(k));

      const ids = Object.values(typeIds).join(',');
      if (ids) {
        const stmt = db.prepare('SELECT gp.releaseKey, gp.gamePieceTypeId, gp.value FROM GamePieces gp WHERE gp.gamePieceTypeId IN (' + ids + ') AND gp.releaseKey IN (SELECT k FROM (' + keySources.join(' UNION ') + '))');
        while (stmt.step()) {
          const [key, typeId, value] = stmt.get();
          const g = games.get(key);
          if (!g) continue;
          const v = parseJson(value) || {};
          if (typeId === typeIds.title) g.title = v.title;
          else if (typeId === typeIds.originalTitle) g.originalTitle = v.title;
          else if (typeId === typeIds.allGameReleases) g.releases = v.releases || [];
          else if (typeId === typeIds.osCompatibility) g.os = (v.supported || []).map(o => o.slug);
        }
        stmt.free();
      }

      if (tables.has('ReleaseProperties')) {
        const stmt = db.prepare('SELECT releaseKey, isDlc FROM ReleaseProperties');
        while (stmt.step()) {
          const [key, isDlc] = stmt.get();
          const g = games.get(key);
          if (g && isDlc === 1) g.isDlc = true;
        }
        stmt.free();
      }

      const items = [];
      let withIds = 0;
      for (const [key, g] of games) {
        const prefix = key.split('_')[0];
        const store = GALAXY_PLATFORMS[prefix] || OE.canonicalStore(prefix);
        const title = g.title || g.originalTitle || '';
        const appIds = new Set();
        if (prefix === 'steam') appIds.add(key.slice(6));
        // Galaxy links betas/demos to the full game's releases: owning a free beta must not mark the full game.
        else if (!NOT_FULL_GAME.test(title)) {
          (g.releases || []).forEach(r => { if (/^steam_\d+$/.test(r)) appIds.add(r.slice(6)); });
        }
        if (!title && !appIds.size) continue;
        if (appIds.size) withIds++;
        const it = { t: title, s: [store], a: [...appIds] };
        if (g.originalTitle && g.originalTitle !== title) it.o = g.originalTitle;
        if (g.isDlc) it.d = 1;
        if (g.os && g.os.length) Object.assign(it, platformInfo(g.os));
        items.push(it);
      }
      return { kind: 'galaxy-db', name: 'GOG Galaxy', items, info: { withIds } };
    } finally {
      db.close();
    }
  }

  // ---------- CSV (Playnite, GOG Galaxy export script, any spreadsheet) ----------

  // Column names in the languages Playnite and common exporters use.
  const COLS = {
    title: ['name', 'title', 'game', 'game name', 'gamename', 'game title',
      'название', 'имя', 'игра', 'название игры', 'назва', 'гра', "ім'я", 'назва гри',
      'titel', 'spiel', 'spielname', 'nom', 'titre', 'jeu', 'nombre', 'título', 'titulo', 'juego',
      'titolo', 'gioco', 'nome', 'jogo', 'nazwa', 'gra', 'tytuł', 'název', 'hra', 'naam', 'isim', 'ad', 'oyun',
      'név', 'játék', 'nume', 'joc', 'όνομα', 'название продукта',
      '名称', '名稱', '游戏', '遊戲', '游戏名称', '名前', 'タイトル', 'ゲーム', '이름', '제목', '게임', 'tên', 'ชื่อ'],
    store: ['source', 'sources', 'library', 'libraries', 'store', 'stores', 'platformlist', 'launcher', 'storefront', 'shop', 'service',
      'источник', 'источники', 'библиотека', 'магазин', 'лаунчер', 'джерело', 'бібліотека', 'крамниця',
      'quelle', 'bibliothek', 'bibliothèque', 'boutique', 'fuente', 'biblioteca', 'tienda', 'fonte', 'loja', 'negozio',
      'źródło', 'biblioteka', 'sklep', 'zdroj', 'knihovna', 'obchod', 'bron', 'bibliotheek', 'kaynak', 'kütüphane', 'mağaza',
      'forrás', 'könyvtár', 'sursă', 'bibliotecă', 'πηγή', 'βιβλιοθήκη',
      '来源', '來源', '库', '庫', '游戏库', '商店', 'ソース', 'ライブラリ', 'ストア', '소스', '라이브러리', '스토어', 'nguồn', 'thư viện'],
    appid: ['steam appid', 'steam app id', 'steamappid', 'steam_appid', 'appid', 'app id', 'steam id', 'steamid'],
    gameid: ['gameid', 'game id', 'game_id', 'id игры', 'идентификатор игры', 'spiel-id', 'id du jeu', 'id del juego', 'id gry', '游戏id', 'ゲームid'],
    originalTitle: ['originaltitle', 'original title', 'оригинальное название'],
    platform: ['platforms', 'platform', 'платформы', 'платформа', 'платформи', 'plattformen', 'plattform', 'plateformes', 'plateforme',
      'plataformas', 'plataforma', 'piattaforme', 'piattaforma', 'platformy', 'platforma', 'platformlar', 'platform', 'platformok',
      '平台', 'プラットフォーム', '플랫폼', 'nền tảng']
  };

  const norm = s => String(s || '').replace(/^﻿/, '').trim().toLowerCase();

  function detectColumns(fields) {
    const found = {};
    for (const [role, names] of Object.entries(COLS)) {
      const f = fields.find(x => names.includes(norm(x)));
      if (f) found[role] = f;
    }
    return found;
  }

  function decodeText(buffer) {
    const utf8 = new TextDecoder('utf-8').decode(buffer);
    if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
    try { return new TextDecoder('windows-1251').decode(buffer); } catch (e) { return utf8; }
  }

  function parseCsv(text) {
    const res = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.replace(/^﻿/, '').trim() });
    return { fields: res.meta.fields || [], rows: res.data || [] };
  }

  // Platform names: Playnite ("PC (Windows)", "Macintosh", "PC (Linux)", "Microsoft Xbox One"…), GOG Galaxy slugs
  // ("windows", "osx", "linux", "xboxone"…). Returns { p: ['win','mac','linux'] } and/or { c: 1 } for console-only.
  const OS_RULES = [[/windows|\bwin\b|\bpc\b(?!.*(linux|mac))|\bdos\b/i, 'win'], [/mac|osx|os x/i, 'mac'], [/linux|steam ?os|steamdeck/i, 'linux']];
  const CONSOLE_PLATFORM = /xbox|playstation|\bps ?[1-5]\b|\bpsp\b|vita|switch|nintendo|wii|game ?cube|sega|dreamcast|stadia|android|\bios\b|meta quest|oculus/i;
  // Console releases are often marked in the title: "Grand Theft Auto V (Xbox One)", "Fable II (Xbox 360)".
  const CONSOLE_TITLE = /\((xbox one|xbox 360|xbox series[^)]*|ps[345]|playstation [345]|nintendo switch)\)\s*$|\b(xbox one|xbox 360|xbox series x\|?s?) edition$/i;
  function platformInfo(raw) {
    const list = Array.isArray(raw) ? raw : String(raw || '').split(/[,;|\t]+/);
    const p = [];
    let consoles = 0;
    list.map(x => String(x).trim()).filter(Boolean).forEach(x => {
      let pc = false;
      OS_RULES.forEach(([re, os]) => { if (re.test(x)) { pc = true; if (!p.includes(os)) p.push(os); } });
      if (!pc && CONSOLE_PLATFORM.test(x)) consoles++;
    });
    const out = {};
    if (p.length) out.p = ['win', 'mac', 'linux'].filter(os => p.includes(os));
    else if (consoles) out.c = 1;
    return out;
  }

  /** mapping: { title, store, appid, gameid, originalTitle, platform, defaultStore } */
  function csvToItems(rows, mapping) {
    const items = [];
    let withIds = 0;
    rows.forEach(row => {
      const title = (row[mapping.title] || '').trim();
      let stores = mapping.store ? OE.splitStores(row[mapping.store]) : [];
      if (!stores.length) stores = [mapping.defaultStore || '?'];
      const ids = new Set();
      if (mapping.appid) String(row[mapping.appid] || '').split(/[^\d]+/).filter(Boolean).forEach(id => ids.add(id));
      if (mapping.gameid && stores.includes('Steam') && /^\d+$/.test((row[mapping.gameid] || '').trim())) ids.add(row[mapping.gameid].trim());
      if (!title && !ids.size) return;
      if (ids.size) withIds++;
      const it = { t: title, s: stores, a: [...ids] };
      const ot = mapping.originalTitle && (row[mapping.originalTitle] || '').trim();
      if (ot && ot !== title) it.o = ot;
      if (mapping.platform) Object.assign(it, platformInfo(row[mapping.platform]));
      if (CONSOLE_TITLE.test(title)) { it.c = 1; delete it.p; }
      items.push(it);
    });
    return { items, withIds };
  }

  function guessCsvKind(fields) {
    const lower = fields.map(norm);
    if (lower.includes('platformlist') && lower.includes('title')) return { kind: 'galaxy-csv', name: 'GOG Galaxy (CSV)' };
    const generic = ['store', 'stores', 'launcher', 'storefront', 'shop', 'service', 'магазин', 'лаунчер', 'крамниця', 'boutique',
      'tienda', 'loja', 'negozio', 'sklep', 'obchod', 'mağaza', '商店', 'ストア', '스토어'];
    const cols = detectColumns(fields);
    if (cols.store && !generic.includes(norm(cols.store))) return { kind: 'playnite', name: 'Playnite (CSV)' };
    return { kind: 'csv', name: 'CSV' };
  }

  // ---------- JSON: own backup, Heroic Games Launcher, generic ----------

  function storeFromHint(hint) {
    const h = (hint || '').toLowerCase();
    if (/legendary|epic/.test(h)) return 'Epic Games Store';
    if (/nile|amazon/.test(h)) return 'Amazon Games';
    if (/gog/.test(h)) return 'GOG';
    if (/itch/.test(h)) return 'itch.io';
    return '';
  }

  function importJson(obj, fileName) {
    if (obj && obj.format === 'owned-elsewhere-backup') return { backup: obj };

    const items = [];
    const seen = new Set();
    const fileStore = storeFromHint(fileName);
    const walk = (node, depth) => {
      if (!node || depth > 6) return;
      if (Array.isArray(node)) {
        node.forEach(n => {
          if (n && typeof n === 'object' && !Array.isArray(n) && typeof (n.title || n.name) === 'string') {
            const title = (n.title || n.name).trim();
            const store = OE.canonicalStore(n.store || n.source || n.platform && typeof n.platform === 'string' && n.platform)
              || storeFromHint(n.runner) || fileStore || '?';
            const ids = [];
            const sid = n.steam_appid || n.steamAppId || n.appid;
            if (sid && /^\d+$/.test(String(sid))) ids.push(String(sid));
            const key = OE.normalizeTitle(title) + '|' + store;
            if (title && !seen.has(key)) {
              seen.add(key);
              const item = { t: title, s: [store], a: ids };
              if ('is_mac_native' in n || 'is_linux_native' in n) {
                item.p = ['win'];
                if (n.is_mac_native) item.p.push('mac');
                if (n.is_linux_native) item.p.push('linux');
              }
              items.push(item);
            }
          } else walk(n, depth + 1);
        });
      } else if (typeof node === 'object') {
        Object.values(node).forEach(v => walk(v, depth + 1));
      }
    };
    walk(obj, 0);
    if (!items.length) throw new Error(OE.t('errNoGamesFound'));
    const heroic = /legendary_library|nile_library|gog_library|gog_store|library\.json/i.test(fileName || '');
    return { kind: heroic ? 'heroic-' + (fileStore || 'json').split(' ')[0].toLowerCase() : 'json', name: heroic ? 'Heroic (' + (fileStore || 'JSON') + ')' : 'JSON', items };
  }

  // ---------- plain text list ----------

  function importText(text, defaultStore) {
    const items = [];
    text.split(/\r?\n/).forEach(line => {
      const l = line.trim();
      if (!l || l.startsWith('#')) return;
      const parts = l.split(/\t|\s\|\s|;/);
      const title = parts[0].trim();
      let stores = parts.length > 1 ? OE.splitStores(parts.slice(1).join(',')) : [];
      if (!stores.length) stores = [defaultStore || '?'];
      if (title) items.push({ t: title, s: stores, a: [] });
    });
    if (!items.length) throw new Error(OE.t('errNoGamesFound'));
    return { kind: 'text', name: OE.t('sourceTextList'), items };
  }

  // ---------- Xbox check: a filled-in template with the user's verdicts ----------

  const VERDICT_WORDS = {
    pc: ['pc', 'пк', 'yes pc', 'play anywhere', 'да', 'yes', 'owned', 'куплено', 'есть'],
    console: ['console', 'консоль', 'xbox', 'only console', 'только консоль'],
    sub: ['sub', 'subscription', 'game pass', 'gamepass', 'подписка', 'no', 'нет', 'not owned', 'gold', 'games with gold']
  };
  const STATUS_COLS = ['status', 'статус', 'verdict', 'проверка'];

  function isVerdictCsv(fields) {
    return fields.some(f => STATUS_COLS.includes(norm(f)));
  }

  /** Returns { normTitle: 'pc' | 'console' | 'sub' } from a filled-in Xbox check template. */
  function csvToVerdicts(rows, fields) {
    const titleCol = detectColumns(fields).title || fields[0];
    const statusCol = fields.find(f => STATUS_COLS.includes(norm(f)));
    const out = {};
    rows.forEach(r => {
      const v = norm(r[statusCol]);
      if (!v) return;
      const verdict = Object.keys(VERDICT_WORDS).find(k => VERDICT_WORDS[k].includes(v));
      const title = OE.normalizeTitle(r[titleCol]);
      if (verdict && title) out[title] = verdict;
    });
    return out;
  }

  function makeBackup(libraries, settings) {
    return { format: 'owned-elsewhere-backup', version: 1, exportedAt: new Date().toISOString(), libraries, settings };
  }

  return { importGalaxyDb, parseCsv, detectColumns, csvToItems, guessCsvKind, decodeText, importJson, importText, makeBackup, platformInfo, isVerdictCsv, csvToVerdicts };
})();
