const DATABASE_NAME = 'vyapar-secure-storage';
const DATABASE_VERSION = 1;
const KEY_STORE = 'keys';
const KEY_ID = 'bank-details-key';

type EncryptedEnvelope = { version: 1; iv: string; ciphertext: string };

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(KEY_STORE)) request.result.createObjectStore(KEY_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open secure storage.'));
  });
}

async function getEncryptionKey() {
  if (!window.isSecureContext || !window.crypto?.subtle || !window.indexedDB) {
    throw new Error('Encrypted storage requires a secure browser context.');
  }

  const database = await openDatabase();
  try {
    const storedKey = await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const request = database.transaction(KEY_STORE, 'readonly').objectStore(KEY_STORE).get(KEY_ID);
      request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
      request.onerror = () => reject(request.error);
    });
    if (storedKey) return storedKey;

    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(KEY_STORE, 'readwrite').objectStore(KEY_STORE).put(key, KEY_ID);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return key;
  } finally {
    database.close();
  }
}

export async function saveEncrypted<T>(storageKey: string, value: T) {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const envelope: EncryptedEnvelope = {
    version: 1,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
  localStorage.setItem(storageKey, JSON.stringify(envelope));
}

export async function loadEncrypted<T>(storageKey: string, fallback: T): Promise<T> {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return fallback;
  try {
    const envelope = JSON.parse(stored) as EncryptedEnvelope;
    if (envelope.version !== 1 || !envelope.iv || !envelope.ciphertext) return fallback;
    const key = await getEncryptionKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
      key,
      base64ToBytes(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  } catch {
    return fallback;
  }
}
