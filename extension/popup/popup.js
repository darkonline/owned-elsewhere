'use strict';

(async () => {
  OE.applyI18n();
  const $ = id => document.getElementById(id);

  // Opening the import page in a tab: the OS file dialog and drag-and-drop close a popup,
  // so files are only accepted on the full options page.
  $('openOptions').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  const { libraries } = await OE.loadState();
  const libs = Object.values(libraries);
  const summary = $('summary');
  if (!libs.length) {
    summary.textContent = OE.t('popupEmpty');
    summary.classList.add('empty');
  } else {
    summary.textContent = OE.t('totalUnique', [String(OE.countItems(libraries))]);
    libs.forEach(lib => {
      const row = document.createElement('div');
      const name = document.createElement('span');
      name.textContent = lib.name;
      const count = document.createElement('span');
      count.textContent = String(lib.count);
      row.append(name, count);
      $('libs').appendChild(row);
    });
  }
  renderSettings($('settings'), true);
})();
