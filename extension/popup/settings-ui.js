/* Renders the settings (shared by the popup and the options page). */
'use strict';

const COMMUNITY_ORIGINS = ['https://steamcommunity.com/*'];
const COMMUNITY_SCRIPT = {
  id: 'oe-community',
  matches: ['https://steamcommunity.com/id/*/games*', 'https://steamcommunity.com/profiles/*/games*'],
  js: ['src/shared.js', 'src/content.js'],
  css: ['src/content.css'],
  runAt: 'document_idle',
  persistAcrossSessions: true
};

/** Profile game lists live on steamcommunity.com: access is optional and asked for only when the user turns it on. */
async function setCommunityAccess(on) {
  if (on) {
    const granted = await chrome.permissions.request({ origins: COMMUNITY_ORIGINS });
    if (!granted) return false;
    await ensureCommunityScript(true);
  } else {
    await ensureCommunityScript(false);
    try { await chrome.permissions.remove({ origins: COMMUNITY_ORIGINS }); } catch (e) { /* ignore */ }
  }
  return true;
}

async function ensureCommunityScript(on) {
  if (!chrome.scripting || !chrome.scripting.getRegisteredContentScripts) return;
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [COMMUNITY_SCRIPT.id] });
  if (on && !existing.length) {
    try { await chrome.scripting.registerContentScripts([COMMUNITY_SCRIPT]); }
    catch (e) { // Firefox before 128 has no persistAcrossSessions
      const s = Object.assign({}, COMMUNITY_SCRIPT); delete s.persistAcrossSessions;
      await chrome.scripting.registerContentScripts([s]);
    }
  }
  if (!on && existing.length) await chrome.scripting.unregisterContentScripts({ ids: [COMMUNITY_SCRIPT.id] });
}

/** Re-registers the profile-page script if it was turned on (e.g. after a browser restart in Firefox). */
async function syncCommunityScript(settings) {
  if (!settings.showCommunity) return;
  const has = await chrome.permissions.contains({ origins: COMMUNITY_ORIGINS });
  if (has) await ensureCommunityScript(true);
}

function renderSettings(container, compact) {
  // The popup closes when a permission prompt opens, so the profile-pages switch lives on the options page only.
  const keys = compact ? ['showBundles', 'showInLists', 'matchEditions']
    : ['showBundles', 'showInLists', 'showCommunity', 'hideInSteamButton', 'matchByTitle', 'matchEditions', 'showDlcBase'];
  OE.loadState().then(({ settings }) => {
    syncCommunityScript(settings);
    container.textContent = '';
    if (!compact) renderOS(container, settings);
    keys.forEach(key => addToggle(container, settings, key));
  });
}

function renderOS(container, settings) {
  // Operating system you play on: releases that do not support it become "maybe".
  const row = document.createElement('label');
  row.className = 'toggle os-row';
  const text = document.createElement('span');
  text.textContent = OE.t('set_myOS');
  const sel = document.createElement('select');
  [['', OE.t('os_auto', [OE.t('os_' + OE.detectOS())])], ['win', OE.t('os_win')], ['mac', OE.t('os_mac')], ['linux', OE.t('os_linux')]].forEach(([v, l]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = l;
    sel.appendChild(o);
  });
  sel.value = settings.myOS || '';
  sel.addEventListener('change', () => OE.saveSettings({ myOS: sel.value || null }));
  row.append(text, sel);
  container.appendChild(row);
}

function addToggle(container, settings, key) {
  const label = document.createElement('label');
  label.className = 'toggle';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = !!settings[key];
  input.addEventListener('change', async () => {
    if (key === 'showCommunity') {
      const ok = await setCommunityAccess(input.checked);
      if (!ok) { input.checked = false; return; }
    }
    OE.saveSettings({ [key]: input.checked });
  });
  const text = document.createElement('span');
  text.textContent = OE.t('set_' + key);
  label.append(input, text);
  container.appendChild(label);
}
