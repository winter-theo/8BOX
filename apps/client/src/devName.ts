/** localStorage key of the last dev name used on this browser. */
const DEV_NAME_STORAGE_KEY = '8box.devName';

/** The last dev name played with on this browser ('' when none). */
export function readStoredDevName(): string {
  try {
    return localStorage.getItem(DEV_NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function storeDevName(name: string): void {
  try {
    localStorage.setItem(DEV_NAME_STORAGE_KEY, name);
  } catch {
    // Storage disabled: the name is just not remembered.
  }
}
