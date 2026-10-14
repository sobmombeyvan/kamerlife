/** Writes localStorage without deleting the previous value when the quota is full. */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('[save] stockage indisponible ou plein', key, error);
    return false;
  }
}
