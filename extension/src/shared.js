/* Shared helpers: used by the content script, the popup and the options page. */
'use strict';

var OE = (() => {
  const DEFAULT_SETTINGS = {
    showBundles: true,     // partial-ownership notes for bundles and multi-game packages
    showInLists: true,     // badges in search results, wishlist, cart, front-page lists
    matchByTitle: true,    // fall back to title matching when no Steam ID is known
    matchEditions: true,   // "maybe" note when only another edition matches (GTA V vs GTA V Legacy)
    showDlcBase: true,     // on DLC pages, say whether the base game is owned
    storeModes: {},        // { storeKey: 'owned' | 'maybe' | 'off' }
    verdicts: {},          // Xbox games checked by the user: { normTitle: 'pc' | 'console' | 'sub' }
    myOS: null,            // 'win' | 'mac' | 'linux'; null = detect from the browser
    showCommunity: false,  // badges on steamcommunity.com game lists (needs an optional permission)
    hideInSteamButton: true, // "Hide in Steam: owned elsewhere" button on game pages
    ignored: { apps: {}, titles: {} } // games the user asked not to mark
  };

  // How much a store's library entries prove ownership, unless the user changes it.
  // Xbox libraries mix owned games with Game Pass / Games with Gold titles, so they are "maybe" by default.
  const DEFAULT_STORE_MODES = { 'Xbox / Microsoft Store': 'maybe' };

  // Canonical store names. Keys are matched against a lower-cased, trimmed store string.
  const STORE_RULES = [
    [/^(epic( games)?( store)?|egs|legendary|epic games launcher)$/, 'Epic Games Store'],
    [/^(gog(\.com)?( galaxy)?)$/, 'GOG'],
    [/^steam$/, 'Steam'],
    [/^(ubisoft( connect)?|uplay|ubisoft\+)$/, 'Ubisoft Connect'],
    [/^(origin|ea( app| desktop| play)?|electronic arts)$/, 'EA app'],
    [/^(xbox( live| game pass| app)?|xboxone|xboxog|microsoft( store)?|windows store|winstore|game pass)$/, 'Xbox / Microsoft Store'],
    [/^(amazon( games| prime gaming)?|prime gaming|nile)$/, 'Amazon Games'],
    [/^(battle\.?net|battlenet|blizzard)$/, 'Battle.net'],
    [/^(itch(\.io)?)$/, 'itch.io'],
    [/^(humble( bundle| app)?)$/, 'Humble'],
    [/^(rockstar( games)?( launcher)?)$/, 'Rockstar Games Launcher'],
    [/^(bethesda(\.net)?)$/, 'Bethesda.net'],
    [/^(legacy( games)?)$/, 'Legacy Games'],
    [/^(indiegala)$/, 'IndieGala'],
    [/^(oculus|meta quest)$/, 'Meta Quest'],
    [/^(riot( games)?)$/, 'Riot Games'],
    [/^(psn|playstation( network)?)$/, 'PlayStation'],
    [/^(nswitch|nintendo switch|switch)$/, 'Nintendo Switch']
  ];

  function canonicalStore(raw) {
    if (!raw) return '';
    const s = String(raw).replace(/^[\s'"{[]+|[\s'"}\]]+$/g, '').trim();
    if (!s) return '';
    const low = s.toLowerCase();
    for (const [re, name] of STORE_RULES) if (re.test(low)) return name;
    return s;
  }

  function splitStores(raw) {
    if (!raw) return [];
    const out = [];
    String(raw).split(/[\t,;|\n]+/).forEach(p => {
      const c = canonicalStore(p);
      if (c && !out.includes(c)) out.push(c);
    });
    return out;
  }

  // Title normalisation: case-insensitive, ignores ™/®/©, punctuation and spacing.
  function normalizeTitle(title) {
    if (!title) return '';
    return String(title)
      .replace(/[™®©℠]/g, '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^\p{L}\p{N}]+/gu, '');
  }

  // Loose title: also drops edition and platform suffixes, so "Grand Theft Auto V Legacy",
  // "Grand Theft Auto V (Xbox One)" and "Grand Theft Auto V" meet. Used only for "maybe" notes.
  const EDITION_WORDS = [
    'game of the year edition', 'game of the year', 'goty edition', 'goty', 'definitive edition', 'complete edition',
    'digital deluxe edition', 'deluxe edition', 'gold edition', 'ultimate edition', 'enhanced edition', 'special edition',
    'standard edition', 'premium edition', 'collectors edition', "collector's edition", 'anniversary edition', 'legendary edition',
    'royal edition', 'platinum edition', 'directors cut', "director's cut", 'final cut', 'remastered', 'remaster', 'enhanced',
    'legacy', 'edition', 'for windows 10', 'windows 10 edition', 'windows 10', 'windows', 'pc edition', 'pc',
    'xbox one edition', 'xbox series x|s', 'xbox series xs', 'xbox series x', 'xbox series', 'xbox one', 'xbox 360', 'xbox',
    'microsoft store edition', 'steam edition', 'hd', 'classic'
  ].sort((a, b) => b.length - a.length);
  const LOOSE_ALIASES = { grandtheftautoonline: 'grandtheftautov' };

  function looseTitle(title) {
    if (!title) return '';
    let s = String(title).replace(/[™®©℠]/g, '').toLowerCase().replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    for (let changed = true; changed;) {
      changed = false;
      s = s.replace(/[\s:\-–—,.]+$/, '');
      if (/[\s:\-–—]the$/.test(s)) { s = s.slice(0, -3); changed = true; continue; }
      for (const w of EDITION_WORDS) {
        if (s.endsWith(' ' + w) || s.endsWith('-' + w) || s.endsWith(':' + w)) {
          s = s.slice(0, -w.length);
          changed = true;
          break;
        }
      }
    }
    s = s.replace(/^the /, '');
    const n = normalizeTitle(s);
    return LOOSE_ALIASES[n] || n;
  }

  const XBOX = 'Xbox / Microsoft Store';
  // Variants of a store entry: console-only release, Xbox PC release, Windows-only release (when you use macOS/Linux).
  const VARIANTS = ['console', 'pc', 'winonly'];

  function detectOS() {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const p = ((nav && ((nav.userAgentData && nav.userAgentData.platform) || nav.platform)) || '').toLowerCase();
    if (/mac/.test(p)) return 'mac';
    if (/linux|cros|x11/.test(p)) return 'linux';
    return 'win';
  }
  const myOS = settings => (settings && settings.myOS) || detectOS();

  function storeMode(settings, key) {
    const modes = (settings && settings.storeModes) || {};
    if (modes[key]) return modes[key];
    if (DEFAULT_STORE_MODES[key]) return DEFAULT_STORE_MODES[key];
    if (key.startsWith(XBOX)) return 'maybe';
    return /\|(console|winonly)$/.test(key) ? 'maybe' : 'owned';
  }

  async function loadState() {
    const st = await chrome.storage.local.get(['libraries', 'settings']);
    const settings = Object.assign({}, DEFAULT_SETTINGS, st.settings || {});
    settings.ignored = Object.assign({ apps: {}, titles: {} }, settings.ignored || {});
    settings.storeModes = Object.assign({}, settings.storeModes || {});
    settings.verdicts = Object.assign({}, settings.verdicts || {});
    return { libraries: st.libraries || {}, settings };
  }

  /**
   * Store keys of one library item: [{ key, mode, osUnknown }].
   * item.p: PC operating systems of the release ('win', 'mac', 'linux') if known; item.c: console-only release.
   * settings.verdicts[normTitle] (Xbox games checked by the user): 'pc' | 'console' | 'sub'.
   */
  function itemKeys(it, settings) {
    settings = settings || DEFAULT_SETTINGS;
    const stores = it.s && it.s.length ? it.s : ['?'];
    const os = myOS(settings);
    const verdict = settings.verdicts && settings.verdicts[normalizeTitle(it.t || it.o)];
    const out = [];
    for (const s of stores) {
      if (s === 'Steam') { out.push({ key: 'Steam', mode: 'steam' }); continue; }
      let variant = '', forced = null;
      if (s === XBOX && verdict) {
        if (verdict === 'sub') continue;
        if (verdict === 'pc') { variant = 'pc'; forced = 'owned'; }
        if (verdict === 'console') variant = 'console';
      } else if (it.c) variant = 'console';
      const knownOS = it.p && it.p.length;
      if (variant !== 'console') {
        if (knownOS && os !== 'win' && !it.p.includes(os)) { variant = 'winonly'; forced = null; }
        else if (s === XBOX && knownOS && !variant) variant = 'pc';
      }
      const key = variant ? s + '|' + variant : s;
      out.push({ key, mode: forced || storeMode(settings, key), osUnknown: os !== 'win' && !knownOS && variant !== 'console' });
    }
    return out;
  }

  /**
   * Builds the lookup index.
   * libraries: { [sourceId]: { items: [{ t, o?, s: [stores], a: [steamAppIds], p?: [os], c?: consoleOnly }] } }
   * entry: { title, stores: Map<storeKey, 'owned'|'maybe'|'steam'>, osUnknown: Set<storeKey> }
   */
  function buildIndex(libraries, settings) {
    settings = settings || DEFAULT_SETTINGS;
    const ignoredTitles = (settings.ignored && settings.ignored.titles) || {};
    const byApp = new Map();
    const byTitle = new Map();
    const byLoose = new Map();
    const rank = { owned: 3, steam: 2, maybe: 1 };
    const add = (map, key, title, keys) => {
      let e = map.get(key);
      if (!e) { e = { title, stores: new Map(), osUnknown: new Set() }; map.set(key, e); }
      keys.forEach(k => {
        const cur = e.stores.get(k.key);
        if (!cur || rank[k.mode] > rank[cur]) e.stores.set(k.key, k.mode);
        if (k.osUnknown) e.osUnknown.add(k.key);
      });
    };
    for (const lib of Object.values(libraries || {})) {
      for (const it of (lib.items || [])) {
        const title = it.t || it.o || '';
        if (ignoredTitles[normalizeTitle(title)]) continue;
        const keys = itemKeys(it, settings).filter(k => k.mode !== 'off');
        if (!keys.length) continue;
        (it.a || []).forEach(id => add(byApp, String(id), title, keys));
        [it.t, it.o].forEach(t => {
          const n = normalizeTitle(t);
          if (n) add(byTitle, n, title, keys);
          const l = looseTitle(t);
          if (l && l.length >= 4) add(byLoose, l, title, keys);
        });
      }
    }
    return { byApp, byTitle, byLoose };
  }

  /** All store keys found in the libraries, with the number of games for each. */
  function storeStats(libraries, settings) {
    const out = {};
    for (const lib of Object.values(libraries || {})) {
      for (const it of (lib.items || [])) itemKeys(it, settings).forEach(k => { out[k.key] = (out[k.key] || 0) + 1; });
    }
    return out;
  }

  function countItems(libraries) {
    const titles = new Set();
    for (const lib of Object.values(libraries || {})) {
      for (const it of (lib.items || [])) titles.add(normalizeTitle(it.t || it.o) || ('#' + (it.a || [])[0]));
    }
    return titles.size;
  }

  function splitKey(key) {
    key = String(key || '');
    const i = key.lastIndexOf('|');
    if (i > 0 && VARIANTS.includes(key.slice(i + 1))) return [key.slice(0, i), key.slice(i + 1)];
    return [key, ''];
  }

  function baseName(s) {
    if (!s || s === '?' || s === 'Other') return t('storeOther');
    return s === XBOX ? 'Xbox' : s;
  }

  function displayStore(key) {
    const [base, variant] = splitKey(key);
    if (!variant) return base === XBOX ? XBOX : baseName(base);
    return baseName(base) + ' (' + t('variant_' + variant) + ')';
  }

  // Short store names for compact badges in lists, where the space before the release date is tight.
  const SHORT_NAMES = {
    'Epic Games Store': 'EGS', 'Ubisoft Connect': 'Ubisoft', 'Amazon Games': 'Amazon',
    'Rockstar Games Launcher': 'Rockstar', 'Bethesda.net': 'Bethesda', 'Xbox / Microsoft Store': 'Xbox'
  };

  /** "Xbox (PC, console), Epic Games Store" — variants of one store are grouped; short = compact names for lists. */
  function storesText(keys, short) {
    const groups = new Map();
    keys.forEach(k => {
      const [base, variant] = splitKey(k);
      if (!groups.has(base)) groups.set(base, new Set());
      groups.get(base).add(variant);
    });
    return [...groups].map(([base, vs]) => {
      const named = [...vs].filter(Boolean).map(v => t('variant_' + v));
      if (short && SHORT_NAMES[base]) return SHORT_NAMES[base] + (named.length ? ' (' + named.join(', ') + ')' : '');
      if (!named.length) return base === XBOX ? XBOX : baseName(base);
      return baseName(base) + ' (' + named.join(', ') + ')';
    }).join(', ');
  }

  function t(key, subs) {
    try { return chrome.i18n.getMessage(key, subs) || key; } catch (e) { return key; }
  }

  function applyI18n(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    (root || document).querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    (root || document).querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  }

  async function saveSettings(patch) {
    const { settings } = await loadState();
    await chrome.storage.local.set({ settings: Object.assign(settings, patch) });
  }

  return {
    DEFAULT_SETTINGS, XBOX, canonicalStore, splitStores, normalizeTitle, looseTitle, storeMode,
    loadState, saveSettings, buildIndex, itemKeys, storeStats, countItems, displayStore, storesText, splitKey, detectOS, myOS, t, applyI18n
  };
})();
