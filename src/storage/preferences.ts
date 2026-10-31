// Optional UI preferences must not prevent the protected IndexedDB load/error
// screen from opening, or erase a workspace when browser storage is denied.
export function getPreference(key: string) {
  try { return localStorage.getItem(key) } catch { return null }
}

export function setPreference(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* Keep this session's setting in memory. */ }
}
