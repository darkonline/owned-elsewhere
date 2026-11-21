// End-to-end test: starts headless Microsoft Edge with the unpacked extension, imports library files through
// the real options page, then opens Steam pages (game pages, search, cart) and prints what the extension added.
// Usage: node tools/e2e.js <file1>[,<file2>...] [appid ...]
// Env: OE_LANG=en-US|ru-RU, OE_SHOTS=<dir> (save 1280×800 screenshots)
const path = require('path');
const { launch, sleep } = require('./cdp');

const extDir = path.resolve(__dirname, '..', 'extension');
const [libArg, ...apps] = process.argv.slice(2);
const libFiles = libArg ? libArg.split(',').map(f => path.resolve(f)) : [];
const appIds = apps.length ? apps : ['632470', '3240220', '480490', '1233220'];
const shotsDir = process.env.OE_SHOTS;
const MARKS = '.oe-banner, .oe-note, .oe-tag';

(async () => {
  const b = await launch({ extDir, lang: process.env.OE_LANG });
  const shot = async (sid, name, scrollTo) => {
    if (!shotsDir) return;
    await b.evaluate(sid, `(()=>{document.querySelectorAll('#global_header,.responsive_store_nav_ctn_spacer,#cookiePrefPopup,[class*=filtered_warning],[id*=filtered_warning]').forEach(n=>n.style.visibility='hidden');const e=${scrollTo ? `document.querySelector(${JSON.stringify(scrollTo)})` : 'null'};if(e){e.scrollIntoView({block:'start'});window.scrollBy(0,-90);}})()`);
    await sleep(600);
    await b.screenshot(sid, path.join(shotsDir, name + '.png'));
  };
  const marks = sid => b.evaluate(sid, `JSON.stringify([...document.querySelectorAll(${JSON.stringify(MARKS)})].map(e => e.className.replace(/oe-/g,'') + ' :: ' + e.innerText.replace(/\\s+/g,' ').replace('×','').trim()), null, 1)`);
  try {
    console.log('extension id', b.extId);
    const popup = await b.newPage(`chrome-extension://${b.extId}/popup/popup.html`);
    console.log('popup:', await b.evaluate(popup, `document.body.innerText.replace(/\\s+/g,' ').slice(0,160)`));

    const opt = await b.newPage(`chrome-extension://${b.extId}/options/options.html`, { height: 1000 });
    for (const file of libFiles) {
      const doc = await b.c.send('DOM.getDocument', {}, opt);
      const { nodeId } = await b.c.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#fileInput' }, opt);
      await b.c.send('DOM.setFileInputFiles', { nodeId, files: [file] }, opt);
      let status = '';
      for (let i = 0; i < 60; i++) {
        await sleep(500);
        status = await b.evaluate(opt, `document.getElementById('status').className + ' | ' + document.getElementById('status').textContent`);
        if (/\b(ok|err|warn)\b/.test(status.split('|')[0])) break;
      }
      console.log('import', path.basename(file), '->', status);
    }
    console.log('libraries:', await b.evaluate(opt, `document.getElementById('libs').innerText.replace(/\\s+/g,' ')`));
    console.log('store modes:', await b.evaluate(opt, `[...document.querySelectorAll('.store-mode')].map(r=>r.querySelector('span').textContent+'='+r.querySelector('select').value).join(', ')`));
    await b.evaluate(opt, `document.querySelector('.tile[data-source=playnite]').click()`);
    await sleep(300);
    await shot(opt, 'options');
    await shot(opt, 'options-xbox', '#xboxCard');

    for (const id of appIds) {
      const s = await b.newPage(`https://store.steampowered.com/app/${id}/`, { wait: 4000 });
      console.log('\napp', id, await b.evaluate(s, 'document.title'), await marks(s));
      await shot(s, 'app-' + id, '.oe-banner, .oe-note');
    }

    const s = await b.newPage('https://store.steampowered.com/search/?term=grand+theft+auto', { wait: 4000 });
    console.log('\nsearch:', await marks(s));
    await shot(s, 'search', '#search_resultsRows');
    // Hover the first badge to check the tooltip.
    const pos = await b.evaluate(s, `(()=>{const r=document.querySelector('.oe-tag')?.getBoundingClientRect();return r?[r.x+r.width/2,r.y+r.height/2]:null})()`);
    if (pos) {
      await b.c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos[0], y: pos[1] }, s);
      await sleep(400);
      console.log('tooltip:', await b.evaluate(s, `(document.querySelector('.oe-tip')||{}).innerText`));
      if (shotsDir) await b.screenshot(s, path.join(shotsDir, 'search-tooltip.png'));
    }

    // Cart (guest session in the throw-away profile): add two games, then open the cart.
    const add = await b.newPage('https://store.steampowered.com/app/480490/', { wait: 3000 });
    for (const appPage of ['480490', '632470']) {
      await b.c.send('Page.navigate', { url: `https://store.steampowered.com/app/${appPage}/` }, add);
      await sleep(3000);
      await b.evaluate(add, `(async()=>{const f=document.querySelector('form[name^=add_to_cart_]');if(f)await fetch(f.getAttribute('action'),{method:'POST',body:new FormData(f),credentials:'include'})})()`);
    }
    const cart = await b.newPage('https://store.steampowered.com/cart/', { wait: 6000 });
    console.log('\ncart:', await marks(cart));
    await shot(cart, 'cart');
  } finally {
    await b.close();
  }
})().catch(e => { console.error('E2E FAILED:', e); process.exit(1); });
