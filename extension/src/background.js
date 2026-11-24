/* Background worker: keeps the optional Steam profile game-list script registered.
   Dynamically registered content scripts are dropped when the extension is updated or reloaded, so it is
   re-registered on install/update, on browser start and when the steamcommunity.com permission is granted. */
'use strict';

if (typeof OE === 'undefined' && typeof importScripts === 'function') importScripts('shared.js');

const COMMUNITY_ORIGINS = ['https://steamcommunity.com/*'];
const COMMUNITY_SCRIPT = {
  id: 'oe-community',
  matches: ['https://steamcommunity.com/id/*/games*', 'https://steamcommunity.com/profiles/*/games*'],
  js: ['src/shared.js', 'src/content.js'],
  css: ['src/content.css'],
  runAt: 'document_idle',
  persistAcrossSessions: true
};

async function syncCommunityScript() {
  try {
    const { settings } = await OE.loadState();
    const allowed = settings.showCommunity && await chrome.permissions.contains({ origins: COMMUNITY_ORIGINS });
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [COMMUNITY_SCRIPT.id] });
    if (allowed && !existing.length) {
      try { await chrome.scripting.registerContentScripts([COMMUNITY_SCRIPT]); }
      catch (e) { // Firefox before 128 has no persistAcrossSessions
        const s = Object.assign({}, COMMUNITY_SCRIPT); delete s.persistAcrossSessions;
        await chrome.scripting.registerContentScripts([s]);
      }
    } else if (!allowed && existing.length) {
      await chrome.scripting.unregisterContentScripts({ ids: [COMMUNITY_SCRIPT.id] });
    }
  } catch (e) {
    console.warn('Owned Elsewhere: community script sync failed', e);
  }
}

chrome.runtime.onInstalled.addListener(syncCommunityScript);
chrome.runtime.onStartup.addListener(syncCommunityScript);
if (chrome.permissions.onAdded) chrome.permissions.onAdded.addListener(syncCommunityScript);
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.settings) syncCommunityScript(); });
syncCommunityScript();
