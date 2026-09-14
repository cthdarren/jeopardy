/**
 * Random id. crypto.randomUUID only exists in secure contexts (https / localhost),
 * and this app is often opened over plain http on a LAN, so fall back.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}
