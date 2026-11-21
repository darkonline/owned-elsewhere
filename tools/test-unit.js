// Unit tests for shared.js and importers.js (no browser needed). Usage: node tools/test-unit.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ext = path.join(__dirname, '..', 'extension');
const messages = JSON.parse(fs.readFileSync(path.join(ext, '_locales/en/messages.json'), 'utf8'));
global.chrome = { i18n: { getMessage: k => (messages[k] || {}).message || '' }, runtime: { getURL: f => f } };
global.Papa = require(path.join(ext, 'lib/papaparse.min.js'));
for (const f of ['src/shared.js', 'src/importers.js']) vm.runInThisContext(fs.readFileSync(path.join(ext, f), 'utf8'), { filename: f });

let passed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; } };

test('store names are canonical', () => {
  assert.strictEqual(OE.canonicalStore('Epic'), 'Epic Games Store');
  assert.strictEqual(OE.canonicalStore('epic games'), 'Epic Games Store');
  assert.strictEqual(OE.canonicalStore('Uplay'), 'Ubisoft Connect');
  assert.strictEqual(OE.canonicalStore('Origin'), 'EA app');
  assert.strictEqual(OE.canonicalStore('Xbox'), 'Xbox / Microsoft Store');
  assert.strictEqual(OE.canonicalStore('Amazon Games'), 'Amazon Games');
  assert.strictEqual(OE.canonicalStore("'GOG'"), 'GOG');
  assert.strictEqual(OE.canonicalStore('Some Shop'), 'Some Shop');
  assert.deepStrictEqual(OE.splitStores('Epic Games Store\tGOG\tSteam'), ['Epic Games Store', 'GOG', 'Steam']);
  assert.deepStrictEqual(OE.splitStores("{'Epic Games Store', 'Steam'}"), ['Epic Games Store', 'Steam']);
});

test('title normalisation', () => {
  assert.strictEqual(OE.normalizeTitle('HOT WHEELS UNLEASHED™'), OE.normalizeTitle('Hot Wheels Unleashed'));
  assert.strictEqual(OE.normalizeTitle('Disco Elysium – The Final Cut'), OE.normalizeTitle('Disco Elysium - The Final Cut'));
  assert.strictEqual(OE.normalizeTitle('Pokémon'), OE.normalizeTitle('Pokemon'));
  assert.strictEqual(OE.normalizeTitle('Ведьмак 3'), 'ведьмак3');
  assert.notStrictEqual(OE.normalizeTitle('Grand Theft Auto V'), OE.normalizeTitle('Grand Theft Auto V Enhanced'));
});

const playniteCsvs = {
  en: 'Name,Source,Platforms,Game Id\n"Control",Epic,PC (Windows),abc\nHades,Steam,PC (Windows),1145360\n',
  ru: 'Название;Источник;Платформы;ID игры\nControl;Epic;PC (Windows);abc\nHades;Steam;PC (Windows);1145360\n',
  de: 'Name\tQuelle\tPlattformen\tSpiel-ID\nControl\tEpic\tPC (Windows)\tabc\nHades\tSteam\tPC (Windows)\t1145360\n',
  fr: 'Nom,Source,Plateformes\nControl,Epic,PC\n',
  es: 'Nombre,Fuente\nControl,Epic\n',
  pl: 'Nazwa,Źródło\nControl,Epic\n',
  uk: 'Назва,Джерело\nControl,Epic\n',
  zh: '名称,来源\nControl,Epic\n',
  ja: '名前,ソース\nControl,Epic\n',
  library: 'Name,Library\nControl,Epic\n'
};
for (const [lang, csv] of Object.entries(playniteCsvs)) {
  test('Playnite CSV headers: ' + lang, () => {
    const { fields, rows } = Importers.parseCsv(csv);
    const cols = Importers.detectColumns(fields);
    assert.ok(cols.title, 'title column not found in ' + fields);
    assert.ok(cols.store, 'store column not found in ' + fields);
    assert.strictEqual(Importers.guessCsvKind(fields).kind, 'playnite');
    const { items } = Importers.csvToItems(rows, cols);
    assert.strictEqual(items[0].t, 'Control');
    assert.deepStrictEqual(items[0].s, ['Epic Games Store']);
    if (items[1]) assert.deepStrictEqual(items[1].a, ['1145360'], 'Steam Game Id should become the app id');
  });
}

test('platform column is not used as store', () => {
  const { fields } = Importers.parseCsv('Name,Platform\nControl,PC (Windows)\n');
  assert.strictEqual(Importers.detectColumns(fields).store, undefined);
});

test('GOG Galaxy export script CSV', () => {
  const csv = 'title\toriginalTitle\tplatformList\n"Mortal Shell"\t"Mortal Shell"\t"Epic Games Store\tSteam"\nXCOM 2\tXCOM® 2\tGOG\n';
  const { fields, rows } = Importers.parseCsv(csv);
  assert.strictEqual(Importers.guessCsvKind(fields).kind, 'galaxy-csv');
  const { items } = Importers.csvToItems(rows, { title: 'title', store: 'platformList', originalTitle: 'originalTitle' });
  assert.deepStrictEqual(items[0].s, ['Epic Games Store', 'Steam']);
  assert.strictEqual(items[1].o, 'XCOM® 2');
});

test('windows-1251 CSV is decoded', () => {
  const bytes = Buffer.from([0xcd, 0xe0, 0xe7, 0xe2, 0xe0, 0xed, 0xe8, 0xe5, 0x0a]); // "Название\n" in cp1251
  assert.ok(Importers.decodeText(bytes).startsWith('Название'));
});

test('Heroic legendary_library.json', () => {
  const json = { library: [{ app_name: 'Fortnite', title: 'Fortnite', runner: 'legendary' }, { app_name: 'x', title: 'Control', runner: 'legendary' }] };
  const res = Importers.importJson(json, 'legendary_library.json');
  assert.strictEqual(res.items.length, 2);
  assert.deepStrictEqual(res.items[1].s, ['Epic Games Store']);
  assert.ok(res.kind.startsWith('heroic-'));
});

test('Heroic gog_library.json', () => {
  const res = Importers.importJson({ games: [{ title: 'Gwent', app_name: '1', runner: 'gog' }] }, 'gog_library.json');
  assert.deepStrictEqual(res.items[0].s, ['GOG']);
});

test('backup is recognised', () => {
  const b = Importers.makeBackup({ a: { items: [] } }, {});
  assert.ok(Importers.importJson(JSON.parse(JSON.stringify(b)), 'x.json').backup);
});

test('text list', () => {
  const res = Importers.importText('# comment\nControl\nHades | Epic\nCeleste;GOG\n\n', 'Xbox / Microsoft Store');
  assert.strictEqual(res.items.length, 3);
  assert.deepStrictEqual(res.items[0].s, ['Xbox / Microsoft Store']);
  assert.deepStrictEqual(res.items[1].s, ['Epic Games Store']);
  assert.deepStrictEqual(res.items[2].s, ['GOG']);
});

test('index keeps Steam as its own level and merges stores', () => {
  const libs = { a: { items: [{ t: 'Hades', s: ['Steam'], a: ['1145360'] }, { t: 'Control', s: ['Epic Games Store'], a: ['870780'] }] },
                 b: { items: [{ t: 'Control', s: ['GOG'], a: [] }, { t: 'Halo 5', s: ['Xbox / Microsoft Store'], a: [], c: 1 }, { t: 'Forza Horizon 5', s: ['Xbox / Microsoft Store'], a: [] }] } };
  const idx = OE.buildIndex(libs, OE.DEFAULT_SETTINGS);
  assert.strictEqual(idx.byApp.get('1145360').stores.get('Steam'), 'steam');
  assert.deepStrictEqual([...idx.byTitle.get('control').stores], [['Epic Games Store', 'owned'], ['GOG', 'owned']]);
  assert.strictEqual(idx.byTitle.get('halo5').stores.get('Xbox / Microsoft Store|console'), 'maybe');
  assert.strictEqual(idx.byTitle.get('forzahorizon5').stores.get('Xbox / Microsoft Store'), 'maybe');
  const s2 = Object.assign({}, OE.DEFAULT_SETTINGS, { storeModes: { 'Xbox / Microsoft Store': 'owned', 'GOG': 'off' } });
  const idx2 = OE.buildIndex(libs, s2);
  assert.strictEqual(idx2.byTitle.get('forzahorizon5').stores.get('Xbox / Microsoft Store'), 'owned');
  assert.deepStrictEqual([...idx2.byTitle.get('control').stores.keys()], ['Epic Games Store']);
  const s3 = Object.assign({}, OE.DEFAULT_SETTINGS, { ignored: { apps: {}, titles: { control: 1 } } });
  assert.strictEqual(OE.buildIndex(libs, s3).byTitle.has('control'), false);
});

test('loose titles join editions and platform releases', () => {
  const L = OE.looseTitle;
  assert.strictEqual(L('Grand Theft Auto V Legacy'), L('Grand Theft Auto V'));
  assert.strictEqual(L('Grand Theft Auto V Enhanced'), L('Grand Theft Auto V'));
  assert.strictEqual(L('Grand Theft Auto Online'), L('Grand Theft Auto V'));
  assert.strictEqual(L('Disco Elysium - The Final Cut'), L('Disco Elysium'));
  assert.strictEqual(L('Mass Effect™ Legendary Edition'), L('Mass Effect'));
  assert.strictEqual(L('Control Ultimate Edition'), L('Control'));
  assert.strictEqual(L('A Plague Tale: Innocence - Windows 10'), L('A Plague Tale: Innocence'));
  assert.strictEqual(L('Halo: The Master Chief Collection'), 'halothemasterchiefcollection');
  assert.notStrictEqual(L('Hitman 2'), L('Hitman'));
  assert.notStrictEqual(L('Prey'), L('Prey: Typhon Hunter'));
});

test('Playnite platforms mark console-only games', () => {
  const csv = 'Название,Источники,Платформы\nHalo 5,Xbox,Microsoft Xbox One\nForza Horizon 5,Xbox,"PC (Windows), Microsoft Xbox Series"\nFable II,Xbox,Microsoft Xbox 360\n';
  const { fields, rows } = Importers.parseCsv(csv);
  const cols = Importers.detectColumns(fields);
  assert.strictEqual(cols.platform, 'Платформы');
  const { items } = Importers.csvToItems(rows, cols);
  assert.deepStrictEqual(items.map(i => !!i.c), [true, false, true]);
});

test("user's Playnite export (r.csv) if present", () => {
  const f = path.join(__dirname, '..', 'r.csv');
  if (!fs.existsSync(f)) return;
  const { fields, rows } = Importers.parseCsv(Importers.decodeText(fs.readFileSync(f)));
  const cols = Importers.detectColumns(fields);
  assert.strictEqual(Importers.guessCsvKind(fields).kind, 'playnite');
  const { items } = Importers.csvToItems(rows, cols);
  assert.strictEqual(items.length, rows.length);
  assert.ok(items.some(i => i.t === '3 out of 10, EP 1: "Welcome To Shovelworks"'));
  assert.ok(items.every(i => i.s.length === 1 && !/,/.test(i.s[0])));
  assert.ok(items.some(i => i.s[0] === 'Epic Games Store'));
});

const S = patch => Object.assign({}, OE.DEFAULT_SETTINGS, { myOS: 'win' }, patch);

test('Playnite export as-is: platforms give PC/console variants for Xbox', () => {
  const f = path.join(__dirname, '..', 'playnite-as-is.csv');
  if (!fs.existsSync(f)) return;
  const { fields, rows } = Importers.parseCsv(Importers.decodeText(fs.readFileSync(f)));
  const cols = Importers.detectColumns(fields);
  assert.ok(cols.platform && cols.store && cols.title);
  const { items } = Importers.csvToItems(rows, cols);
  const find = t => items.find(i => i.t === t);
  assert.deepStrictEqual(find('A Kingdom for Keflings').c, 1);
  assert.deepStrictEqual(find('A Memoir Blue').p, ['win']);
  const keys = it => OE.itemKeys(it, S()).map(k => k.key + '=' + k.mode);
  assert.deepStrictEqual(keys(find('A Memoir Blue')), ['Xbox / Microsoft Store|pc=maybe']);
  assert.deepStrictEqual(keys(find('A Kingdom for Keflings')), ['Xbox / Microsoft Store|console=maybe']);
  assert.deepStrictEqual(keys(find('A Plague Tale: Innocence')), ['Epic Games Store=owned']);
});

test('platformInfo understands Playnite names and Galaxy slugs', () => {
  assert.deepStrictEqual(Importers.platformInfo('Macintosh, PC (Windows)'), { p: ['win', 'mac'] });
  assert.deepStrictEqual(Importers.platformInfo('PC (Linux)'), { p: ['linux'] });
  assert.deepStrictEqual(Importers.platformInfo(['windows', 'osx']), { p: ['win', 'mac'] });
  assert.deepStrictEqual(Importers.platformInfo(['xboxone']), { c: 1 });
  assert.deepStrictEqual(Importers.platformInfo('Microsoft Xbox 360, Microsoft Xbox One'), { c: 1 });
  assert.deepStrictEqual(Importers.platformInfo(''), {});
});

test('macOS / Linux: Windows-only releases become "maybe", unknown OS is flagged', () => {
  const winOnly = { t: 'X', s: ['Epic Games Store'], a: [], p: ['win'] };
  const both = { t: 'Y', s: ['GOG'], a: [], p: ['win', 'mac'] };
  const unknown = { t: 'Z', s: ['Epic Games Store'], a: [] };
  assert.deepStrictEqual(OE.itemKeys(winOnly, S({ myOS: 'mac' })), [{ key: 'Epic Games Store|winonly', mode: 'maybe', osUnknown: false }]);
  assert.deepStrictEqual(OE.itemKeys(both, S({ myOS: 'mac' })), [{ key: 'GOG', mode: 'owned', osUnknown: false }]);
  assert.deepStrictEqual(OE.itemKeys(unknown, S({ myOS: 'linux' })), [{ key: 'Epic Games Store', mode: 'owned', osUnknown: true }]);
  assert.deepStrictEqual(OE.itemKeys(winOnly, S()), [{ key: 'Epic Games Store', mode: 'owned', osUnknown: false }]);
});

test('Xbox verdicts override store trust', () => {
  const it = { t: 'Halo Infinite', s: ['Xbox / Microsoft Store'], a: [] };
  assert.strictEqual(OE.itemKeys(it, S({ verdicts: { haloinfinite: 'pc' } }))[0].mode, 'owned');
  assert.strictEqual(OE.itemKeys(it, S({ verdicts: { haloinfinite: 'console' } }))[0].key, 'Xbox / Microsoft Store|console');
  assert.deepStrictEqual(OE.itemKeys(it, S({ verdicts: { haloinfinite: 'sub' } })), []);
  const csv = 'Название;Платформа;Статус\nHalo Infinite;ПК;ПК\nFable II;консоль;консоль\nStarfield;ПК;подписка\nForza;ПК;\n';
  const { fields, rows } = Importers.parseCsv(csv);
  assert.ok(Importers.isVerdictCsv(fields));
  assert.deepStrictEqual(Importers.csvToVerdicts(rows, fields), { haloinfinite: 'pc', fableii: 'console', starfield: 'sub' });
});

test('store names group variants', () => {
  assert.strictEqual(OE.storesText(['Xbox / Microsoft Store|pc', 'Xbox / Microsoft Store|console', 'Epic Games Store']), 'Xbox (PC, console), Epic Games Store');
  assert.strictEqual(OE.storesText(['Xbox / Microsoft Store']), 'Xbox / Microsoft Store');
  assert.strictEqual(OE.storesText(['GOG|winonly']), 'GOG (Windows only)');
});

console.log(passed + ' tests passed' + (process.exitCode ? ', some FAILED' : ''));
