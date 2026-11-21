// Node harness: runs the real importers against local files.
// Usage: node tools/test-import.js <galaxy-2.0.db> [export.csv] [out.json]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ext = path.join(__dirname, '..', 'extension');
const messages = JSON.parse(fs.readFileSync(path.join(ext, '_locales/en/messages.json'), 'utf8'));
global.chrome = {
  i18n: { getMessage: (k, subs) => { let m = (messages[k] || {}).message || ''; (subs || []).forEach((s, i) => { m = m.split('$' + (i + 1)).join(s); }); return m; } },
  runtime: { getURL: f => path.join(ext, f) }
};
global.Papa = require(path.join(ext, 'lib/papaparse.min.js'));
const initSqlJs = require(path.join(__dirname, '..', 'node_modules/sql.js/dist/sql-wasm.js'));
global.initSqlJs = cfg => initSqlJs({ locateFile: f => path.join(ext, 'lib', f) });

for (const f of ['src/shared.js', 'src/importers.js']) vm.runInThisContext(fs.readFileSync(path.join(ext, f), 'utf8'), { filename: f });

(async () => {
  const [dbPath, csvPath, outPath] = process.argv.slice(2);
  const libraries = {};
  if (dbPath) {
    console.time('galaxy-db');
    const res = await Importers.importGalaxyDb(fs.readFileSync(dbPath));
    console.timeEnd('galaxy-db');
    const byStore = {};
    res.items.forEach(i => i.s.forEach(s => { byStore[s] = (byStore[s] || 0) + 1; }));
    console.log('galaxy-db items', res.items.length, 'withIds', res.info.withIds, byStore);
    console.log('sample', res.items.filter(i => i.s[0] === 'Epic Games Store').slice(0, 3));
    libraries['galaxy-db'] = { id: 'galaxy-db', name: res.name, items: res.items };
  }
  if (csvPath) {
    const text = Importers.decodeText(fs.readFileSync(csvPath));
    const { fields, rows } = Importers.parseCsv(text);
    const kind = Importers.guessCsvKind(fields);
    const cols = Importers.detectColumns(fields);
    console.log('csv kind', kind, 'cols', cols, 'rows', rows.length);
    const { items } = Importers.csvToItems(rows, { title: cols.title, store: fields.find(f => /platformlist/i.test(f)) || cols.store, originalTitle: cols.originalTitle });
    console.log('csv items', items.length, items.slice(0, 2));
    libraries[kind.kind] = { id: kind.kind, name: kind.name, items };
  }
  const idx = OE.buildIndex(libraries, OE.DEFAULT_SETTINGS);
  console.log('index stats', idx.stats);
  for (const id of ['632470', '3240220', '271590', '1233220', '870780', '2863680', '466300']) {
    const e = idx.byApp.get(id);
    console.log('app', id, e ? e.title + ' -> ' + [...e.stores].join(', ') : '-');
  }
  for (const t of ['Disco Elysium - The Final Cut', 'Grand Theft Auto V', 'Control Ultimate Edition']) {
    const e = idx.byTitle.get(OE.normalizeTitle(t));
    console.log('title', t, e ? [...e.stores].join(', ') : '-');
  }
  if (outPath) fs.writeFileSync(outPath, JSON.stringify(libraries));
})().catch(e => { console.error(e); process.exit(1); });
