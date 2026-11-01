// What this device kept before the app became Hodi ("brief:saved", "bref:…") moves to the "hodi:" names, once.
// Imported first by main.tsx, before any module reads its settings; public/theme.js does the same before the
// first paint, and this covers a theme.js still served from an old cache.
const LEGACY_PREFIX = /^(brief|bref):/

const renameIn = (storage: Storage) => {
  for (const key of Object.keys(storage)) {
    if (!LEGACY_PREFIX.test(key)) continue
    const renamed = key.replace(LEGACY_PREFIX, 'hodi:')
    const value = storage.getItem(key)
    if (storage.getItem(renamed) === null && value !== null) storage.setItem(renamed, value)
    storage.removeItem(key)
  }
}

try {
  renameIn(localStorage)
  renameIn(sessionStorage)
} catch {
  // Storage blocked (private mode): nothing was kept to move.
}
