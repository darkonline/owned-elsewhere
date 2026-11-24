/* Content script for store.steampowered.com: marks games you already own in other libraries. */
'use strict';

(() => {
  const t = OE.t;
  let index = null;
  let settings = OE.DEFAULT_SETTINGS;
  let ready = null;
  const packageCache = new Map(); // subid -> Promise<{ name, apps: [{id, name}] }>

  async function load() {
    const st = await OE.loadState();
    settings = st.settings;
    index = OE.buildIndex(st.libraries, settings);
  }

  // ---------- lookup and classification ----------

  /** how: 'id' | 'title' | 'loose' */
  function lookup(appid, title, allowLoose) {
    if (!index) return null;
    if (appid && settings.ignored.apps[appid]) return null;
    if (appid) {
      const e = index.byApp.get(String(appid));
      if (e) return { entry: e, how: 'id' };
    }
    if (!title || !settings.matchByTitle) return null;
    const n = OE.normalizeTitle(title);
    if (settings.ignored.titles[n]) return null;
    const e = index.byTitle.get(n);
    if (e) return { entry: e, how: 'title' };
    if (allowLoose && settings.matchEditions) {
      const l = OE.looseTitle(title);
      const le = l && index.byLoose.get(l);
      if (le) return { entry: le, how: 'loose' };
    }
    return null;
  }

  /**
   * level: 'owned' (bought in another store), 'maybe' (subscription-prone store, console, other edition),
   *        'steam' (already in the Steam library), or null.
   */
  function classify(hit, steamOwnedOnPage) {
    if (!hit && !steamOwnedOnPage) return null;
    let owned = [], maybe = [], steam = !!steamOwnedOnPage;
    if (hit) {
      for (const [key, mode] of hit.entry.stores) {
        if (mode === 'steam') { if (hit.how !== 'loose') steam = true; }
        else if (mode === 'owned' && hit.how !== 'loose') owned.push(key);
        else maybe.push(key);
      }
    }
    const level = steam ? 'steam' : owned.length ? 'owned' : maybe.length ? 'maybe' : null;
    if (!level) return null;
    const osUnknown = hit ? owned.filter(k => hit.entry.osUnknown.has(k)) : [];
    return { level, owned, maybe, steam, osUnknown, how: hit ? hit.how : 'steam', title: hit ? hit.entry.title : '' };
  }

  const storesText = keys => OE.storesText(keys);
  const OS_NAMES = { mac: 'macOS', linux: 'Linux', win: 'Windows' };

  // ---------- DOM helpers ----------

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function appIdFromHref(href) {
    const m = /\/app\/(\d+)/.exec(href || '');
    return m ? m[1] : null;
  }

  function ignoreButton(appid, c) {
    const b = el('button', 'oe-ignore', '×');
    b.type = 'button';
    b.title = t('ignoreGame');
    b.setAttribute('aria-label', t('ignoreGame'));
    b.addEventListener('click', async e => {
      e.preventDefault();
      e.stopPropagation();
      const { settings: s } = await OE.loadState();
      if (appid) s.ignored.apps[appid] = 1;
      if (c && c.how !== 'id' && c.title) s.ignored.titles[OE.normalizeTitle(c.title)] = 1;
      await chrome.storage.local.set({ settings: s });
    });
    return b;
  }

  function hintsFor(c) {
    const hints = [];
    const keys = c.maybe;
    const os = OE.myOS(settings);
    if (c.how === 'loose') hints.push(t('looseNote', [c.title]));
    else if (c.how === 'title') hints.push(t('matchedByTitleNote', [c.title]));
    if (keys.some(k => k.endsWith('|console'))) hints.push(t('consoleNote'));
    if (keys.some(k => k.endsWith('|winonly'))) hints.push(t(os === 'linux' ? 'winOnlyNoteLinux' : 'winOnlyNoteMac'));
    if (keys.some(k => k.startsWith(OE.XBOX) && !k.endsWith('|console'))) hints.push(t('xboxNote'));
    if (c.osUnknown && c.osUnknown.length) hints.push(t('osUnknownNote', [OS_NAMES[os], storesText(c.osUnknown)]));
    return hints;
  }

  // Own tooltip: native title tooltips get cut off in the Steam client and cannot wrap long lines.
  let tipEl = null;
  function attachTip(target, lines) {
    lines = lines.filter(Boolean);
    if (!lines.length) return;
    target.setAttribute('aria-label', lines.join('. '));
    target.addEventListener('mouseenter', () => {
      if (!tipEl) { tipEl = el('div', 'oe-tip'); document.body.appendChild(tipEl); }
      tipEl.textContent = '';
      lines.forEach((l, i) => tipEl.appendChild(el('div', i === 0 ? 'oe-tip-title' : null, l)));
      tipEl.style.display = 'block';
      const r = target.getBoundingClientRect();
      const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
      let left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      let top = r.bottom + 6;
      if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
      tipEl.style.left = left + 'px';
      tipEl.style.top = top + 'px';
    });
    target.addEventListener('mouseleave', () => { if (tipEl) tipEl.style.display = 'none'; });
  }

  /** Compact badge for lists (search, wishlist, cart). */
  function listBadge(c) {
    let text;
    const short = keys => OE.storesText(keys, true);
    if (c.level === 'owned') text = t('listOwned', [short(c.owned)]);
    else if (c.level === 'maybe') text = t(c.how === 'loose' ? 'listLoose' : 'listMaybe', [short(c.maybe)]);
    else text = c.owned.length || c.maybe.length ? t('listSteamAlso', [short(c.owned.concat(c.maybe))]) : t('listSteam');
    const b = el('div', 'oe-tag oe-l-' + c.level, text);
    attachTip(b, [c.title].concat(hintsFor(c)));
    return b;
  }

  // ---------- "Hide in Steam" (Steam's own ignore with the reason "owned on another store") ----------

  function steamSessionId() {
    const m = /(?:^|;\s*)sessionid=([^;]+)/.exec(document.cookie);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function hideInSteamButton(appid) {
    if (!settings.hideInSteamButton || !appid || !document.querySelector('#account_pulldown') || !steamSessionId()) return null;
    const box = el('div', 'oe-hide');
    const btn = el('button', 'oe-hide-btn', t('hideInSteam'));
    btn.type = 'button';
    attachTip(btn, [t('hideInSteamTip')]);
    const status = el('span', 'oe-hide-status');
    const post = async remove => {
      const body = new FormData();
      body.append('sessionid', steamSessionId());
      body.append('appid', appid);
      if (remove) body.append('remove', '1');
      else body.append('ignore_reason', '2'); // 2 = "I own it on another store"
      const pageFetch = (typeof content !== 'undefined' && content && content.fetch) ? content.fetch.bind(content) : fetch;
      const r = await pageFetch(location.origin + '/recommended/ignorerecommendation/', { method: 'POST', body, credentials: 'include' });
      if (!r.ok) throw new Error(String(r.status));
    };
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const hidden = btn.dataset.hidden === '1';
        await post(hidden);
        btn.dataset.hidden = hidden ? '' : '1';
        btn.textContent = hidden ? t('hideInSteam') : t('unhideInSteam');
        status.textContent = hidden ? '' : t('hiddenInSteam');
      } catch (e) {
        status.textContent = t('hideInSteamError');
      }
      btn.disabled = false;
    });
    box.append(btn, status);
    return box;
  }

  // ---------- package contents ----------

  function getPackage(subid) {
    subid = String(subid);
    if (!packageCache.has(subid)) {
      const cacheKey = 'oe_pkg2_' + subid;
      let cached = null;
      try { cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null'); } catch (e) { /* ignore */ }
      if (cached) packageCache.set(subid, Promise.resolve(cached));
      else {
        // Firefox content scripts need content.fetch to make the request as the page itself.
        const pageFetch = (typeof content !== 'undefined' && content && content.fetch) ? content.fetch.bind(content) : fetch;
        packageCache.set(subid, pageFetch(location.origin + '/api/packagedetails?packageids=' + encodeURIComponent(subid), { credentials: 'omit' })
          .then(r => r.ok ? r.json() : null)
          .then(j => {
            const d = j && j[subid] && j[subid].success && j[subid].data;
            const info = { name: d ? d.name : null, apps: (d && d.apps || []).map(a => ({ id: String(a.id), name: a.name })) };
            try { sessionStorage.setItem(cacheKey, JSON.stringify(info)); } catch (e) { /* ignore */ }
            return info;
          })
          .catch(() => ({ name: null, apps: [] })));
      }
    }
    return packageCache.get(subid);
  }

  /** Items of a purchase block: [{ apps: [{id, name}], pkg, name }], or null for subscriptions. */
  async function blockItems(block) {
    if (block.querySelector('.game_purchase_subscription, a[href*="/subscriptions/"]')) return null;

    const names = {};
    block.querySelectorAll('a[href*="/app/"]').forEach(a => {
      const id = appIdFromHref(a.getAttribute('href'));
      const img = a.querySelector('img');
      const name = (a.textContent || '').trim() || (img && img.alt) || '';
      if (id && name && !names[id]) names[id] = name;
    });

    const wrapper = block.closest('.game_area_purchase_game_wrapper');
    const bundleData = wrapper && wrapper.getAttribute('data-ds-bundle-data');
    if (bundleData) {
      try {
        const data = JSON.parse(bundleData);
        const items = (data.m_rgItems || []).map(it => {
          const apps = (it.m_rgIncludedAppIDs || []).map(id => ({ id: String(id), name: names[id] || null }));
          return { apps, pkg: it.m_nPackageID, name: apps.length && apps[0].name };
        }).filter(it => it.apps.length);
        if (items.length) return items;
      } catch (e) { /* fall through */ }
    }

    const listed = [];
    block.querySelectorAll('.package_contents a[href*="/app/"]').forEach(a => {
      const id = appIdFromHref(a.getAttribute('href'));
      if (id && !listed.some(x => x.apps[0].id === id)) listed.push({ apps: [{ id, name: a.textContent.trim() }], name: a.textContent.trim() });
    });
    if (listed.length) return listed;

    const sub = block.querySelector('input[name="subid"]');
    if (sub && sub.value) {
      const info = await getPackage(sub.value);
      return info.apps.map(a => ({ apps: [a], name: a.name }));
    }
    return [];
  }

  async function classifyItem(item, pageId, pageTitle) {
    const findHit = () => {
      for (const app of item.apps) {
        const name = app.name || (app.id === pageId ? pageTitle : null);
        const hit = lookup(app.id, name, false);
        if (hit) return hit;
      }
      return item.name ? lookup(null, item.name, false) : null;
    };
    let hit = findHit();
    if ((!hit || !item.name) && item.pkg && item.apps.some(a => !a.name)) {
      // Steam gives no names for some bundle items: fetch them, needed for title matching and for display.
      const info = await getPackage(item.pkg);
      item.apps.forEach(a => { const m = info.apps.find(x => x.id === a.id); if (m) a.name = m.name; });
      item.name = item.name || (item.apps.length > 1 && info.name) || item.apps[0].name || info.name;
      if (!hit) hit = findHit();
    }
    if (!item.name) item.name = item.apps[0].name || ('#' + item.apps[0].id);
    return classify(hit, false);
  }

  async function processPurchaseBlock(block, pageId, pageTitle) {
    if (block.dataset.oeDone) return;
    block.dataset.oeDone = '1';

    const items = await blockItems(block);
    if (!items || !items.length) return;
    // A single-game package for this very page is covered by the main banner.
    if (items.length === 1 && items[0].apps.some(a => a.id === pageId)) return;
    if (items.length > 1 && !settings.showBundles) return;

    const results = await Promise.all(items.map(it => classifyItem(it, pageId, pageTitle)));
    const have = [], maybe = [], missing = [];
    items.forEach((it, i) => {
      const c = results[i];
      if (!c) missing.push(it);
      else if (c.level === 'maybe') maybe.push({ it, c });
      else have.push({ it, c });
    });
    if (!have.length && !maybe.length) return;

    const n = items.length;
    const level = have.length === n ? 'owned' : have.length ? 'partial' : 'maybe';
    const head = n === 1
      ? (have.length ? t('itemOwned') : t('itemMaybe'))
      : have.length === n ? t('bundleAllOwned', [String(n)])
      : have.length ? t('bundlePartial', [String(have.length), String(n)])
      : t('bundleMaybe', [String(maybe.length), String(n)]);
    const box = el('div', 'oe-note oe-l-' + level);
    box.appendChild(el('div', 'oe-note-head', head));
    const line = (label, list) => {
      if (!list.length) return;
      const row = el('div', 'oe-note-line');
      row.appendChild(el('b', null, label + ' '));
      row.appendChild(document.createTextNode(list.join('; ')));
      box.appendChild(row);
    };
    const withStores = ({ it, c }) => it.name + ' (' + storesText(c.level === 'steam' ? ['Steam'].concat(c.owned) : c.owned.length ? c.owned : c.maybe) + ')';
    line(t('labelHave'), have.map(withStores));
    line(t('labelMaybe'), maybe.map(withStores));
    if (n > 1) line(t('labelMissing'), missing.map(x => x.name));
    const title = block.querySelector('h1, h2');
    if (title) title.insertAdjacentElement('afterend', box);
    else block.prepend(box);
  }

  // ---------- app page ----------

  function processAppPage() {
    const pageId = appIdFromHref(location.pathname);
    if (!pageId) return;
    const titleEl = document.querySelector('#appHubAppName, .apphub_AppName');
    const pageTitle = titleEl ? titleEl.textContent.trim() : '';
    const purchase = document.querySelector('#game_area_purchase');
    const steamBanner = document.querySelector('.game_area_already_owned');

    if (purchase && !purchase.dataset.oeChecked) {
      purchase.dataset.oeChecked = '1';
      const c = classify(lookup(pageId, pageTitle, true), !!steamBanner);
      const others = c ? c.owned.concat(c.maybe) : [];
      // Steam shows its own "in library" banner: only add which other stores have it too.
      if (c && !(c.level === 'steam' && steamBanner && !others.length)) {
        const banner = el('div', 'oe-banner oe-l-' + c.level);
        const body = el('div', 'oe-banner-body');
        let head, stores;
        if (c.level === 'owned') { head = t('bannerOwned'); stores = t('listOwned', [storesText(c.owned)]); }
        else if (c.level === 'maybe') { head = t(c.how === 'loose' ? 'bannerLoose' : 'bannerMaybe'); stores = t(c.how === 'loose' ? 'listLoose' : 'listMaybe', [storesText(c.maybe)]); }
        else { head = steamBanner ? t('bannerSteamAlso') : t('bannerSteam'); stores = others.length ? t('alsoIn', [storesText(others)]) : ''; }
        body.appendChild(el('div', 'oe-banner-title', head));
        if (stores) body.appendChild(el('div', 'oe-banner-stores', stores));
        if (c.level === 'owned' && c.maybe.length) body.appendChild(el('div', 'oe-banner-note', t('alsoMaybe', [storesText(c.maybe)])));
        hintsFor(c).forEach(h => body.appendChild(el('div', 'oe-banner-note', h)));
        if (c.level !== 'steam') { const hide = hideInSteamButton(pageId); if (hide) body.appendChild(hide); }
        banner.appendChild(body);
        if (c.level !== 'steam' || others.length) banner.appendChild(ignoreButton(pageId, c));
        const anchor = steamBanner && steamBanner.parentElement === purchase ? steamBanner : null;
        if (anchor) anchor.insertAdjacentElement('afterend', banner);
        else purchase.prepend(banner);
      }
    }

    if (settings.showDlcBase) {
      document.querySelectorAll('.game_area_dlc_bubble, .game_area_soundtrack_bubble').forEach(bubble => {
        if (bubble.dataset.oeDone) return;
        bubble.dataset.oeDone = '1';
        const link = bubble.querySelector('a[href*="/app/"]');
        if (!link) return;
        const c = classify(lookup(appIdFromHref(link.getAttribute('href')), link.textContent.trim(), true), false);
        if (!c) return;
        const key = c.level === 'owned' ? 'dlcBaseOwned' : c.level === 'steam' ? 'dlcBaseSteam' : 'dlcBaseMaybe';
        const stores = c.level === 'owned' ? c.owned : c.level === 'steam' ? ['Steam'] : c.maybe;
        const note = el('div', 'oe-note oe-l-' + c.level, t(key, [storesText(stores)]));
        (bubble.querySelector('.content') || bubble).appendChild(note);
      });
    }

    if (purchase) {
      purchase.querySelectorAll('.game_area_purchase_game').forEach(block => processPurchaseBlock(block, pageId, pageTitle));
    }
  }

  // ---------- lists: search, front page, bundle/sub pages ----------

  function markRow(row, level) {
    row.classList.add('oe-row', 'oe-row-' + level);
  }

  /**
   * Shared row of badges under a title in Steam lists. It is positioned over the free space under the title,
   * so the list row keeps its height (rows there have a fixed-height image). DRM Check uses the same element.
   */
  function badgeRow(titleEl) {
    let box = titleEl.parentElement.querySelector(':scope > .steam-ext-badges');
    if (!box) {
      box = el('div', 'steam-ext-badges');
      titleEl.insertAdjacentElement('afterend', box);
    }
    return box;
  }


  /**
   * Places the shared badge row of a search result on the platform-icons line, right after the icons and before the
   * release date, so it covers nothing and the row keeps its height. Owned Elsewhere and DRM Check share this code.
   */
  function placeBadgeRow(row) {
    const box = row.querySelector('.steam-ext-badges');
    const plats = row.querySelector('.search_platforms');
    if (!box || !plats) return;
    const rb = row.getBoundingClientRect();
    if (!rb.width) return;
    const pr = plats.getBoundingClientRect();
    const icons = [...plats.children].filter(c => c.getBoundingClientRect().width);
    const left = (icons.length ? icons[icons.length - 1].getBoundingClientRect().right + 10 : pr.left) - rb.left;
    const released = row.querySelector('.search_released');
    const limit = released && released.getBoundingClientRect().width ? released.getBoundingClientRect().left - rb.left - 10 : rb.width * 0.6;
    box.classList.add('steam-ext-badges-placed');
    box.style.left = left + 'px';
    box.style.top = (pr.top - rb.top + (pr.height - 16) / 2) + 'px';
    box.style.maxWidth = Math.max(60, limit - left) + 'px';
  }
  window.addEventListener('resize', () => document.querySelectorAll('a.search_result_row').forEach(placeBadgeRow));

  function processRow(row, titleSel) {
    if (row.dataset.oeDone) return;
    row.dataset.oeDone = '1';
    const ids = (row.getAttribute('data-ds-appid') || '').split(',').map(s => s.trim()).filter(Boolean);
    const titleEl = row.querySelector(titleSel);
    if (!titleEl) return;
    const title = titleEl.textContent.trim();
    const steamOwned = row.classList.contains('ds_owned');
    if (ids.length <= 1) {
      const c = classify(lookup(ids[0], title, true), steamOwned);
      if (!c) return;
      // Steam already flags games owned there; add a badge only when other stores have it too.
      if (c.level === 'steam' && steamOwned && !c.owned.length && !c.maybe.length) return;
      badgeRow(titleEl).appendChild(listBadge(c));
      if (row.matches('.search_result_row')) placeBadgeRow(row);
      markRow(row, c.level);
      return;
    }
    if (!settings.showBundles) return;
    const res = ids.map(id => classify(lookup(id, null, false), false));
    const have = res.filter(c => c && c.level !== 'maybe').length;
    const maybe = res.filter(c => c && c.level === 'maybe').length;
    if (!have && !maybe) return;
    const level = have === ids.length ? 'owned' : have ? 'partial' : 'maybe';
    const text = have === ids.length ? t('bundleAllOwnedShort', [String(ids.length)])
      : have ? t('bundlePartialShort', [String(have), String(ids.length)])
      : t('bundleMaybeShort', [String(maybe), String(ids.length)]);
    badgeRow(titleEl).appendChild(el('div', 'oe-tag oe-l-' + level, text));
    if (row.matches('.search_result_row')) placeBadgeRow(row);
    markRow(row, level);
  }

  function processLists() {
    document.querySelectorAll('a.search_result_row').forEach(r => processRow(r, '.title'));
    document.querySelectorAll('a.tab_item[data-ds-appid]').forEach(r => processRow(r, '.tab_item_name'));
  }

  // ---------- React pages (cart, wishlist): cards are found by their game image ----------

  const PRICE_LIKE = /^[\s\d%+\-–.,:$€£¥₽₴₸zł]*(руб|uah|usd|eur|pуб)?[\s\d.,]*$/i;

  function findCard(link, appid) {
    let card = link;
    for (let i = 0; i < 8 && card.parentElement && card.parentElement !== document.body; i++) {
      const p = card.parentElement;
      const other = [...p.querySelectorAll('a[href*="/app/"]')].some(a => appIdFromHref(a.getAttribute('href')) !== appid);
      if (other) break;
      card = p;
    }
    return card;
  }

  function visible(e) {
    const r = e.getBoundingClientRect();
    return r.width > 20 && r.height > 8;
  }

  function findTitle(card, name, appid) {
    const want = OE.normalizeTitle(name);
    let best = null;
    if (want) {
      card.querySelectorAll('div, span, a, h1, h2, h3, h4, p').forEach(e => {
        if (e.closest('.oe-tag') || e.querySelector('img') || !visible(e)) return;
        if (OE.normalizeTitle(e.textContent) === want && (!best || best.contains(e))) best = e;
      });
    }
    if (best) return best;
    for (const a of card.querySelectorAll('a[href*="/app/"]')) {
      const text = a.textContent.trim();
      if (appIdFromHref(a.getAttribute('href')) === appid && text.length > 1 && !a.querySelector('img') && !PRICE_LIKE.test(text) && visible(a)) return a;
    }
    return null;
  }

  // Badges next to titles on React pages are positioned absolutely: rows there (wishlist especially) have a fixed
  // height and truncated titles, so anything added to the layout would be clipped or would push content around.
  const besideBadges = new Set();

  function placeBeside(badge) {
    const { titleEl, host } = badge._oe;
    if (!titleEl.isConnected || !badge.isConnected) { besideBadges.delete(badge); return; }
    const hostRect = host.getBoundingClientRect();
    const titleRect = titleEl.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(titleEl);
    const textRect = range.getBoundingClientRect();
    const right = Math.min(textRect.width ? textRect.right : titleRect.right, titleRect.right);
    const left = Math.max(0, right - hostRect.left + 10);
    badge.style.left = left + 'px';
    badge.style.maxWidth = Math.max(80, hostRect.width - left - 8) + 'px';
    badge.style.top = (titleRect.top - hostRect.top + (titleRect.height - badge.offsetHeight) / 2) + 'px';
  }

  function repositionBeside() {
    besideBadges.forEach(placeBeside);
  }
  window.addEventListener('resize', repositionBeside);

  function processCards() {
    document.querySelectorAll('a[href*="/app/"]').forEach(a => {
      if (a.dataset.oeDone) return;
      const img = a.querySelector('img');
      if (!img) return; // cards are found through their capsule image
      a.dataset.oeDone = '1';
      const appid = appIdFromHref(a.getAttribute('href'));
      if (!appid || a.closest('.oe-tag, #global_header, #store_nav_area, .home_page_content')) return;
      const card = findCard(a, appid);
      if (card.dataset.oeCard) return;
      const titleEl = findTitle(card, img.alt, appid);
      // Store pages: capsules without a title are recommendations, skip them. Profile game lists: if the title
      // cannot be found next to the image, the badge goes over the image instead.
      if (!titleEl && !isCommunity) return;
      card.dataset.oeCard = appid;
      const c = classify(lookup(appid, img.alt || (titleEl ? titleEl.textContent.trim() : ''), true), false);
      if (!c) return;
      if (!titleEl) {
        const badge = listBadge(c);
        badge.classList.add('oe-overlay');
        if (getComputedStyle(a).position === 'static') a.style.position = 'relative';
        a.appendChild(badge);
        return;
      }

      // Whole row tinted, like search results.
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
      card.classList.add('oe-card', 'oe-row-' + c.level);

      const badge = listBadge(c);
      badge.classList.add('oe-beside');
      const host = titleEl.parentElement;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      badge._oe = { titleEl, host };
      host.appendChild(badge);
      besideBadges.add(badge);
      placeBeside(badge);
    });
    repositionBeside();
  }

  // ---------- main loop ----------

  const isCommunity = location.hostname === 'steamcommunity.com';

  // After the extension is updated or reloaded, scripts already running in open tabs lose access to it
  // (no translations, no storage). Such an orphaned script must stop instead of drawing broken badges.
  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };

  function run() {
    if (!alive()) { observer.disconnect(); return; }
    if (!index || (!index.byApp.size && !index.byTitle.size)) return;
    const path = location.pathname;
    if (isCommunity) {
      if (settings.showCommunity && /\/games\/?$/.test(path) && reactSettled) processCards();
      return;
    }
    if (/^\/app\/\d+/.test(path)) processAppPage();
    if (settings.showInLists) {
      processLists();
      // React pages: touching the DOM before hydration makes React throw away and re-render the page.
      if (reactSettled && /^\/(cart|wishlist)\b/.test(path)) { processCards(); repositionBeside(); }
    }
  }

  let reactSettled = false;
  const settle = () => setTimeout(() => { reactSettled = true; schedule(); }, 1500);
  if (document.readyState === 'complete') settle();
  else window.addEventListener('load', settle, { once: true });

  let scheduled = false;
  const observer = new MutationObserver(() => schedule());
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      ready.then(run);
    }, 300);
  }

  function resetMarks() {
    document.querySelectorAll('.oe-tag, .oe-banner, .oe-note').forEach(n => n.remove());
    document.querySelectorAll('.steam-ext-badges').forEach(b => { if (!b.children.length) b.remove(); });
    besideBadges.clear();
    document.querySelectorAll('[data-oe-done]').forEach(n => delete n.dataset.oeDone);
    document.querySelectorAll('[data-oe-checked]').forEach(n => delete n.dataset.oeChecked);
    document.querySelectorAll('[data-oe-card]').forEach(n => delete n.dataset.oeCard);
    document.querySelectorAll('.oe-row, .oe-card').forEach(n => n.classList.remove('oe-row', 'oe-card', 'oe-row-owned', 'oe-row-maybe', 'oe-row-steam', 'oe-row-partial'));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(changes.libraries || changes.settings)) return;
    ready = load().then(() => { resetMarks(); run(); });
  });

  ready = load();
  ready.then(run);
  observer.observe(document.body, { childList: true, subtree: true });
})();
