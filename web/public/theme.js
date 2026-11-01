// What this device kept before the app became Hodi ("brief:…", "bref:…") moves to the "hodi:" names, once (as
// src/lib/storage-rename.ts).
try {
  ;[localStorage, sessionStorage].forEach(function (storage) {
    Object.keys(storage).forEach(function (key) {
      if (!/^(brief|bref):/.test(key)) return
      var renamed = key.replace(/^(brief|bref):/, 'hodi:')
      if (storage.getItem(renamed) === null) storage.setItem(renamed, storage.getItem(key))
      storage.removeItem(key)
    })
  })
} catch {
  // Storage blocked: nothing to move.
}

// Applies the reader's theme and accent before the first paint, from this device's copy of the settings
// (see src/lib/user-state.ts and src/lib/theme.ts), so a light theme never flashes dark.
try {
  var preferences = JSON.parse(localStorage.getItem('hodi:user-state') || 'null').preferences
  if (['light', 'dark', 'poudre'].indexOf(preferences.theme) !== -1) {
    document.documentElement.dataset.theme = preferences.theme
  }
  if (typeof preferences.accent === 'string' && preferences.accent !== 'auto') {
    document.documentElement.dataset.accent = preferences.accent
  }
} catch {
  // No settings yet: the system's choice applies.
}
