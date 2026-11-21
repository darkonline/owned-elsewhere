/* Import sources shown on the options page: step-by-step instructions and the file types each one accepts.
   Texts live in _locales (keys src_<id>_steps are newline-separated lists). */
'use strict';

var SOURCES = [
  {
    id: 'galaxy', title: 'GOG Galaxy 2.0', tag: 'srcTagBest',
    accept: '.db', pick: 'pickGalaxy',
    paths: [
      { label: 'Windows', path: 'C:\\ProgramData\\GOG.com\\Galaxy\\storage\\galaxy-2.0.db' },
      { label: 'macOS', path: '/Users/Shared/GOG.com/Galaxy/Storage/galaxy-2.0.db' }
    ],
    note: 'src_galaxy_note'
  },
  {
    id: 'playnite', title: 'Playnite',
    accept: '.csv,.tsv,.txt', pick: 'pickCsv',
    note: 'src_playnite_note'
  },
  {
    id: 'heroic', title: 'Heroic Games Launcher',
    accept: '.json', pick: 'pickJson',
    paths: [
      { label: 'Windows', path: '%APPDATA%\\heroic\\store_cache\\' },
      { label: 'Linux', path: '~/.config/heroic/store_cache/' },
      { label: 'Linux (Flatpak)', path: '~/.var/app/com.heroicgameslauncher.hgl/config/heroic/store_cache/' },
      { label: 'macOS', path: '~/Library/Application Support/heroic/store_cache/' }
    ]
  },
  {
    id: 'stores', titleKey: 'src_stores_title',
    links: ['galaxy', 'playnite', 'heroic']
  },
  {
    id: 'galaxycsv', title: 'GOG Galaxy Export Script',
    accept: '.csv', pick: 'pickCsv',
    note: 'src_galaxycsv_note'
  },
  {
    id: 'csv', titleKey: 'src_csv_title',
    accept: '.csv,.tsv,.txt', pick: 'pickCsv'
  },
  {
    id: 'list', titleKey: 'src_list_title',
    paste: true, accept: '.txt', pick: 'pickTxt'
  },
  {
    id: 'backup', titleKey: 'src_backup_title',
    accept: '.json', pick: 'pickJson'
  }
];
