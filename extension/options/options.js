'use strict';

(() => {
  const t = OE.t;
  const $ = id => document.getElementById(id);
  const STORES = ['Epic Games Store', 'GOG', 'Steam', 'Ubisoft Connect', 'EA app', 'Xbox / Microsoft Store', 'Amazon Games',
    'Battle.net', 'itch.io', 'Humble', 'Rockstar Games Launcher', 'Other'];
  const ALL_ACCEPT = '.db,.csv,.tsv,.txt,.json';
  let pendingCsv = null; // { rows, fields, fileName, kind }
  let currentSource = null;

  OE.applyI18n();
  document.documentElement.lang = chrome.i18n.getUILanguage();

  function setStatus(text, kind) {
    const s = $('status');
    s.textContent = text;
    s.className = 'status' + (kind ? ' ' + kind : '');
  }

  function option(value, text) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  }

  document.querySelectorAll('.store-select').forEach(sel => STORES.forEach(s => sel.appendChild(option(s, OE.displayStore(s)))));

  // ---------- source tiles and instructions ----------

  function sourceTitle(src) { return src.title || t(src.titleKey); }

  function renderTiles() {
    const box = $('tiles');
    SOURCES.forEach(src => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile';
      b.setAttribute('role', 'tab');
      b.dataset.source = src.id;
      b.appendChild(Object.assign(document.createElement('span'), { textContent: sourceTitle(src) }));
      if (src.tag) b.appendChild(Object.assign(document.createElement('small'), { textContent: t(src.tag) }));
      b.addEventListener('click', () => showSource(src.id));
      box.appendChild(b);
    });
  }

  function showSource(id) {
    const src = SOURCES.find(s => s.id === id);
    currentSource = id;
    document.querySelectorAll('.tile').forEach(b => b.setAttribute('aria-selected', String(b.dataset.source === id)));
    $('panel').hidden = false;
    $('panelTitle').textContent = sourceTitle(src);

    const steps = $('panelSteps');
    steps.textContent = '';
    t('src_' + id + '_steps').split('\n').filter(Boolean).forEach(s => steps.appendChild(Object.assign(document.createElement('li'), { textContent: s })));

    const paths = $('panelPaths');
    paths.textContent = '';
    (src.paths || []).forEach(p => {
      const row = document.createElement('div');
      row.className = 'path';
      row.appendChild(Object.assign(document.createElement('span'), { className: 'path-label', textContent: p.label }));
      const code = Object.assign(document.createElement('code'), { textContent: p.path });
      const copy = Object.assign(document.createElement('button'), { type: 'button', className: 'btn small', textContent: t('copy') });
      copy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(p.path);
        copy.textContent = t('copied');
        setTimeout(() => { copy.textContent = t('copy'); }, 1500);
      });
      row.append(code, copy);
      paths.appendChild(row);
    });

    $('panelNote').hidden = !src.note;
    if (src.note) $('panelNote').textContent = t(src.note);

    const links = $('panelLinks');
    links.textContent = '';
    (src.links || []).forEach(l => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn', textContent: '→ ' + sourceTitle(SOURCES.find(s => s.id === l)) });
      b.addEventListener('click', () => showSource(l));
      links.appendChild(b);
    });

    $('panelPaste').hidden = !src.paste;
    $('panelFile').hidden = !src.accept;
    if (src.accept) $('panelPick').textContent = t(src.pick);
    $('panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function pickFile(accept) {
    $('fileInput').accept = accept || ALL_ACCEPT;
    $('fileInput').click();
  }

  // ---------- saving ----------

  async function saveLibrary(result, fileName) {
    const fixed = ['galaxy-db', 'galaxy-csv', 'playnite'];
    const id = fixed.includes(result.kind) || result.kind.startsWith('heroic-') ? result.kind : result.kind + ':' + (fileName || Date.now());
    const { libraries } = await OE.loadState();
    libraries[id] = {
      id, kind: result.kind, name: result.name, file: fileName || '',
      importedAt: new Date().toISOString(),
      count: result.items.length,
      withIds: result.items.filter(i => i.a && i.a.length).length,
      items: result.items
    };
    await chrome.storage.local.set({ libraries });
    setStatus(t('importDone', [result.name, String(result.items.length)]), 'ok');
    renderLibraries();
  }

  // ---------- file handling ----------

  async function handleFile(file) {
    const name = file.name || '';
    const ext = (name.split('.').pop() || '').toLowerCase();
    setStatus(t('importing', [name]));
    const buf = await file.arrayBuffer();
    const head = new TextDecoder('ascii').decode(new Uint8Array(buf.slice(0, 15)));

    if (head === 'SQLite format 3' || ext === 'db' || ext === 'sqlite') {
      if (/-(wal|shm)$/i.test(name)) throw new Error(t('errWalFile'));
      const res = await Importers.importGalaxyDb(buf);
      await saveLibrary(res, name);
      setStatus(t('importDoneIds', [res.name, String(res.items.length), String(res.info.withIds)]), 'ok');
      return;
    }

    const text = Importers.decodeText(buf);

    if (ext === 'json') {
      let obj;
      try { obj = JSON.parse(text); } catch (e) { throw new Error(t('errBadJson')); }
      const res = Importers.importJson(obj, name);
      if (res.backup) return restoreBackup(res.backup);
      return saveLibrary(res, name);
    }

    if (ext === 'txt' && !['playnite', 'csv', 'galaxycsv'].includes(currentSource)) {
      showSource('list');
      $('pasteText').value = text;
      setStatus(t('txtLoaded'), 'warn');
      return;
    }

    const { fields, rows } = Importers.parseCsv(text);
    if (!fields.length || !rows.length) throw new Error(t('errNoGamesFound'));
    if (Importers.isVerdictCsv(fields)) {
      const verdicts = Importers.csvToVerdicts(rows, fields);
      const st = await OE.loadState();
      Object.assign(st.settings.verdicts, verdicts);
      await chrome.storage.local.set({ settings: st.settings });
      setStatus(t('xboxImported', [String(Object.keys(verdicts).length)]), 'ok');
      return;
    }
    const kind = Importers.guessCsvKind(fields);
    const cols = Importers.detectColumns(fields);
    if (kind.kind === 'galaxy-csv') {
      const mapping = { title: cols.title || 'title', store: fields.find(f => f.toLowerCase() === 'platformlist'), originalTitle: cols.originalTitle };
      const { items } = Importers.csvToItems(rows, mapping);
      return saveLibrary(Object.assign({}, kind, { items }), name);
    }
    if (cols.title && cols.store) {
      const { items } = Importers.csvToItems(rows, Object.assign({}, cols));
      await saveLibrary(Object.assign({}, kind, { items }), name);
      if (kind.kind === 'playnite' && !cols.platform) setStatus($('status').textContent + ' ' + t('playniteNoPlatform'), 'warn');
      return;
    }
    showMapping(fields, rows, name, cols, kind);
  }

  async function handleFiles(files) {
    for (const f of files) {
      try { await handleFile(f); } catch (e) { console.error(e); setStatus(t('errImport', [f.name, e.message || String(e)]), 'err'); }
    }
  }

  // ---------- column mapping ----------

  function fillSelect(sel, fields, value, allowNone) {
    sel.textContent = '';
    if (allowNone) sel.appendChild(option('', t('mapNone')));
    fields.forEach(f => sel.appendChild(option(f, f)));
    sel.value = value || '';
  }

  function showMapping(fields, rows, fileName, cols, kind) {
    pendingCsv = { fields, rows, fileName, kind };
    fillSelect($('mapTitle'), fields, cols.title || fields[0], false);
    fillSelect($('mapStore'), fields, cols.store, true);
    fillSelect($('mapPlatform'), fields, cols.platform, true);
    fillSelect($('mapAppId'), fields, cols.appid, true);
    const prev = $('mapPreview');
    prev.textContent = '';
    const table = document.createElement('table');
    const tr = document.createElement('tr');
    fields.slice(0, 8).forEach(f => tr.appendChild(Object.assign(document.createElement('th'), { textContent: f })));
    table.appendChild(tr);
    rows.slice(0, 4).forEach(r => {
      const row = document.createElement('tr');
      fields.slice(0, 8).forEach(f => row.appendChild(Object.assign(document.createElement('td'), { textContent: String(r[f] || '').slice(0, 60) })));
      table.appendChild(row);
    });
    prev.appendChild(table);
    $('mapping').hidden = false;
    setStatus(t('mapNeeded'), 'warn');
    $('mapping').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  $('mapImport').addEventListener('click', async () => {
    if (!pendingCsv) return;
    const mapping = {
      title: $('mapTitle').value,
      store: $('mapStore').value || null,
      platform: $('mapPlatform').value || null,
      appid: $('mapAppId').value || null,
      defaultStore: $('mapDefaultStore').value
    };
    const { items } = Importers.csvToItems(pendingCsv.rows, mapping);
    const kind = mapping.store ? pendingCsv.kind : { kind: 'csv', name: 'CSV' };
    await saveLibrary(Object.assign({}, kind, { items }), pendingCsv.fileName);
    pendingCsv = null;
    $('mapping').hidden = true;
  });
  $('mapCancel').addEventListener('click', () => { pendingCsv = null; $('mapping').hidden = true; setStatus(''); });

  // ---------- paste ----------
  $('pasteImport').addEventListener('click', async () => {
    try {
      const res = Importers.importText($('pasteText').value, $('pasteStore').value);
      await saveLibrary(res, 'list-' + OE.normalizeTitle($('pasteStore').value));
      $('pasteText').value = '';
    } catch (e) { setStatus(e.message, 'err'); }
  });

  // ---------- drop zones ----------
  function dropTarget(zone, accept) {
    zone.addEventListener('click', e => { if (e.target.tagName !== 'TEXTAREA') pickFile(accept()); });
    zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFile(accept()); } });
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('hover'); }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('hover'); }));
    zone.addEventListener('drop', e => { e.stopPropagation(); handleFiles([...e.dataTransfer.files]); });
  }
  dropTarget($('dropZone'), () => ALL_ACCEPT);
  dropTarget($('panelFile'), () => (SOURCES.find(s => s.id === currentSource) || {}).accept || ALL_ACCEPT);
  $('fileInput').addEventListener('change', e => { handleFiles([...e.target.files]); e.target.value = ''; });
  // Dropping a file anywhere on the page imports it instead of navigating away.
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]); });

  // ---------- libraries list ----------
  let currentSettings = OE.DEFAULT_SETTINGS;
  async function renderLibraries() {
    const { libraries, settings } = await OE.loadState();
    currentSettings = settings;
    const box = $('libs');
    box.textContent = '';
    const libs = Object.values(libraries);
    if (!libs.length) {
      box.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: t('noLibraries') }));
      renderStoreModes();
      return;
    }
    const table = document.createElement('table');
    table.className = 'libs';
    libs.sort((a, b) => a.name.localeCompare(b.name)).forEach(lib => {
      const tr = document.createElement('tr');
      const stats = OE.storeStats({ x: lib }, currentSettings);
      const cells = [
        lib.name + (lib.file && !lib.name.includes(lib.file) ? ' — ' + lib.file : ''),
        t('libCount', [String(lib.count)]) + (lib.withIds ? ' · ' + t('libWithIds', [String(lib.withIds)]) : ''),
        Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([s, n]) => OE.displayStore(s) + ': ' + n).join(', '),
        new Date(lib.importedAt).toLocaleString()
      ];
      cells.forEach(c => tr.appendChild(Object.assign(document.createElement('td'), { textContent: c })));
      const td = document.createElement('td');
      const del = Object.assign(document.createElement('button'), { className: 'btn small danger', textContent: t('remove') });
      del.addEventListener('click', async () => {
        const st = await OE.loadState();
        delete st.libraries[lib.id];
        await chrome.storage.local.set({ libraries: st.libraries });
      });
      td.appendChild(del);
      tr.appendChild(td);
      table.appendChild(tr);
    });
    box.appendChild(table);
    box.appendChild(Object.assign(document.createElement('p'), { textContent: t('totalUnique', [String(OE.countItems(libraries))]) }));
    renderStoreModes();
  }

  $('clearAllBtn').addEventListener('click', async () => {
    if (!confirm(t('confirmClearAll'))) return;
    await chrome.storage.local.set({ libraries: {} });
    setStatus(t('cleared'), 'ok');
  });

  // ---------- store trust levels ----------
  async function renderStoreModes() {
    const { libraries, settings } = await OE.loadState();
    const box = $('storeModes');
    box.textContent = '';
    const stats = OE.storeStats(libraries, settings);
    const keys = Object.keys(stats).filter(k => k !== 'Steam').sort((a, b) => stats[b] - stats[a]);
    if (!keys.length) {
      box.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: t('noLibraries') }));
      return;
    }
    keys.forEach(k => {
      const row = document.createElement('label');
      row.className = 'store-mode';
      row.appendChild(Object.assign(document.createElement('span'), { textContent: OE.displayStore(k) + ' (' + stats[k] + ')' }));
      const sel = document.createElement('select');
      [['owned', t('modeOwned')], ['maybe', t('modeMaybe')], ['off', t('modeOff')]].forEach(([v, l]) => sel.appendChild(option(v, l)));
      sel.value = OE.storeMode(settings, k);
      sel.addEventListener('change', async () => {
        const st = await OE.loadState();
        st.settings.storeModes[k] = sel.value;
        await chrome.storage.local.set({ settings: st.settings });
      });
      row.appendChild(sel);
      box.appendChild(row);
    });
  }

  // ---------- backup ----------
  $('exportBtn').addEventListener('click', async () => {
    const { libraries, settings } = await OE.loadState();
    const blob = new Blob([JSON.stringify(Importers.makeBackup(libraries, settings))], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'owned-elsewhere-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  async function restoreBackup(backup) {
    if (!confirm(t('confirmRestore'))) return;
    await chrome.storage.local.set({ libraries: backup.libraries || {}, settings: Object.assign({}, OE.DEFAULT_SETTINGS, backup.settings || {}) });
    setStatus(t('restored'), 'ok');
  }

  // ---------- search and ignore list ----------
  let searchTimer = null;
  $('search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(doSearch, 150);
  });

  async function toggleIgnore(title, ids, ignore) {
    const st = await OE.loadState();
    const n = OE.normalizeTitle(title);
    if (ignore) { st.settings.ignored.titles[n] = 1; ids.forEach(id => { st.settings.ignored.apps[id] = 1; }); }
    else { delete st.settings.ignored.titles[n]; ids.forEach(id => { delete st.settings.ignored.apps[id]; }); }
    await chrome.storage.local.set({ settings: st.settings });
  }

  async function doSearch() {
    const q = $('search').value.trim();
    const box = $('results');
    box.textContent = '';
    if (q.length < 2) return;
    const { libraries, settings } = await OE.loadState();
    const nq = OE.normalizeTitle(q);
    const isId = /^\d+$/.test(q);
    const merged = new Map();
    for (const lib of Object.values(libraries)) {
      for (const it of lib.items) {
        const hit = isId ? (it.a || []).includes(q) : (OE.normalizeTitle(it.t).includes(nq) || OE.normalizeTitle(it.o).includes(nq));
        if (!hit) continue;
        const key = OE.normalizeTitle(it.t) || it.a[0];
        if (!merged.has(key)) merged.set(key, { t: it.t, s: new Set(), a: new Set() });
        const m = merged.get(key);
        OE.itemKeys(it, settings).forEach(k => m.s.add(k.key));
        (it.a || []).forEach(a => m.a.add(a));
      }
    }
    if (!merged.size) { box.textContent = t('searchNothing'); return; }
    [...merged.values()].slice(0, 50).forEach(m => box.appendChild(resultRow(m, settings)));
    if (merged.size > 50) box.appendChild(Object.assign(document.createElement('div'), { className: 'muted', textContent: t('searchMore', [String(merged.size - 50)]) }));
  }

  function resultRow(m, settings) {
    const row = document.createElement('div');
    row.className = 'result';
    const ignored = !!settings.ignored.titles[OE.normalizeTitle(m.t)];
    if (ignored) row.classList.add('ignored');
    row.appendChild(Object.assign(document.createElement('b'), { textContent: m.t }));
    row.appendChild(document.createTextNode(' — ' + OE.storesText([...m.s])));
    [...m.a].slice(0, 3).forEach(id => {
      const a = Object.assign(document.createElement('a'), { href: 'https://store.steampowered.com/app/' + id + '/', target: '_blank', rel: 'noopener', textContent: ' #' + id });
      row.appendChild(a);
    });
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn small', textContent: ignored ? t('unignore') : t('ignore') });
    b.addEventListener('click', () => toggleIgnore(m.t, [...m.a], !ignored));
    row.appendChild(b);
    return row;
  }

  async function renderIgnored() {
    const { settings } = await OE.loadState();
    const box = $('ignored');
    box.textContent = '';
    const apps = Object.keys(settings.ignored.apps);
    const titles = Object.keys(settings.ignored.titles);
    if (!apps.length && !titles.length) { box.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: t('ignoredEmpty') })); return; }
    const add = (label, onRestore) => {
      const row = document.createElement('div');
      row.className = 'result';
      row.appendChild(document.createTextNode(label + ' '));
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn small', textContent: t('unignore') });
      b.addEventListener('click', onRestore);
      row.appendChild(b);
      box.appendChild(row);
    };
    apps.forEach(id => add('Steam App ' + id, async () => { const st = await OE.loadState(); delete st.settings.ignored.apps[id]; await chrome.storage.local.set({ settings: st.settings }); }));
    titles.forEach(n => add(t('ignoredTitle', [n]), async () => { const st = await OE.loadState(); delete st.settings.ignored.titles[n]; await chrome.storage.local.set({ settings: st.settings }); }));
  }

  // ---------- Xbox check ----------
  const VERDICTS = [['', 'verdict_none'], ['pc', 'verdict_pc'], ['console', 'verdict_console'], ['sub', 'verdict_sub']];

  async function xboxGames() {
    const { libraries, settings } = await OE.loadState();
    const games = new Map();
    for (const lib of Object.values(libraries)) {
      for (const it of lib.items) {
        if (!(it.s || []).includes(OE.XBOX)) continue;
        const n = OE.normalizeTitle(it.t || it.o);
        if (!n) continue;
        const g = games.get(n) || { n, title: it.t || it.o, pc: false, console: false };
        if (it.c) g.console = true;
        if (it.p && it.p.length) g.pc = true;
        games.set(n, g);
      }
    }
    return { games: [...games.values()].sort((a, b) => a.title.localeCompare(b.title)), settings };
  }

  const platformLabel = g => g.pc ? t('variant_pc') : g.console ? t('variant_console') : '—';

  async function renderXbox() {
    const { games, settings } = await xboxGames();
    $('xboxCard').hidden = !games.length;
    const box = $('xboxList');
    box.textContent = '';
    const q = OE.normalizeTitle($('xboxFilter').value);
    const onlyNew = $('xboxOnlyNew').checked;
    const done = games.filter(g => settings.verdicts[g.n]).length;
    box.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: t('xboxProgress', [String(done), String(games.length)]) }));
    games.filter(g => (!q || g.n.includes(q)) && (!onlyNew || !settings.verdicts[g.n])).slice(0, 300).forEach(g => {
      const row = document.createElement('div');
      row.className = 'xbox-row';
      row.appendChild(Object.assign(document.createElement('span'), { className: 'xbox-title', textContent: g.title }));
      row.appendChild(Object.assign(document.createElement('span'), { className: 'muted', textContent: platformLabel(g) }));
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', g.title);
      VERDICTS.forEach(([v, k]) => sel.appendChild(option(v, t(k))));
      sel.value = settings.verdicts[g.n] || '';
      sel.addEventListener('change', async () => {
        const st = await OE.loadState();
        if (sel.value) st.settings.verdicts[g.n] = sel.value; else delete st.settings.verdicts[g.n];
        await chrome.storage.local.set({ settings: st.settings });
      });
      row.appendChild(sel);
      box.appendChild(row);
    });
  }
  $('xboxFilter').addEventListener('input', () => renderXbox());
  $('xboxOnlyNew').addEventListener('change', () => renderXbox());
  $('xboxImport').addEventListener('click', () => { currentSource = 'csv'; pickFile('.csv,.tsv,.txt'); });
  $('xboxTemplate').addEventListener('click', async () => {
    const { games, settings } = await xboxGames();
    const words = { pc: t('verdictWord_pc'), console: t('verdictWord_console'), sub: t('verdictWord_sub') };
    const esc = v => /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    const lines = [[t('mapColTitle'), t('xboxColPlatform'), t('xboxColStatus')].join(';')]
      .concat(games.map(g => [esc(g.title), platformLabel(g), words[settings.verdicts[g.n]] || ''].join(';')));
    const blob = new Blob(['\ufeff' + lines.join('\r\n') + '\r\n'], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'owned-elsewhere-xbox-check.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  renderTiles();
  renderXbox();
  renderLibraries();
  renderIgnored();
  renderSettings($('settings'));
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== 'local') return;
    if (c.libraries) { renderLibraries(); renderXbox(); }
    if (c.settings) { renderIgnored(); renderStoreModes(); renderXbox(); renderLibraries(); renderSettings($('settings')); if ($('search').value) doSearch(); }
  });
})();
