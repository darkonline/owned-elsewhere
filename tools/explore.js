// Dumps the structure of Steam cart and wishlist pages (guest session in a throw-away profile).
// Usage: node tools/explore.js [wishlistUrl]
const { launch } = require('./cdp');

(async () => {
  const b = await launch({ lang: 'ru-RU' });
  try {
    // Cart: add Disco Elysium as a guest, then open the cart.
    const app = await b.newPage('https://store.steampowered.com/app/632470/', { wait: 3000 });
    console.log('add:', await b.evaluate(app, `(async()=>{const f=document.querySelector('form[name^=add_to_cart_]');if(!f)return 'no form';const fd=new FormData(f);const r=await fetch(f.getAttribute('action'),{method:'POST',body:fd,credentials:'include'});return r.status+' '+r.url})()`));
    const cart = await b.newPage('https://store.steampowered.com/cart/', { wait: 5000 });
    console.log('cart links:', await b.evaluate(cart, `JSON.stringify([...document.querySelectorAll('a[href*="/app/"]')].slice(0,10).map(a=>({t:a.innerText.trim().slice(0,40), img:!!a.querySelector('img'), cls:a.className, parent:a.parentElement.className, gp:a.parentElement.parentElement.className})))`));
    console.log('cart html:', await b.evaluate(cart, `(()=>{const a=document.querySelector('a[href*="/app/632470"]');let e=a;for(let i=0;i<4&&e.parentElement;i++)e=e.parentElement;return e.outerHTML.replace(/\\s+/g,' ').replace(/<svg.*?<\\/svg>/g,'<svg/>').slice(0,2500)})()`));
    await b.screenshot(cart, process.env.OUT ? process.env.OUT + '/cart.png' : 'cart.png');

    const wl = process.argv[2];
    if (wl) {
      const w = await b.newPage(wl, { wait: 6000 });
      console.log('wishlist links:', await b.evaluate(w, `JSON.stringify([...document.querySelectorAll('a[href*="/app/"]')].slice(0,12).map(a=>({t:a.innerText.trim().slice(0,40), img:!!a.querySelector('img'), cls:a.className, parent:a.parentElement.className})))`));
      console.log('wishlist row:', await b.evaluate(w, `(()=>{const a=[...document.querySelectorAll('a[href*="/app/"]')].find(a=>a.innerText.trim().length>2);if(!a)return document.body.innerText.slice(0,300);let e=a;for(let i=0;i<7&&e.parentElement;i++)e=e.parentElement;return e.outerHTML.replace(/\\s+/g,' ').replace(/<svg.*?<\\/svg>/g,'<svg/>').slice(0,3000)})()`));
      await b.screenshot(w, process.env.OUT ? process.env.OUT + '/wishlist.png' : 'wishlist.png');
    }
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exit(1); });
