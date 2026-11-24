/**
 * This browser's attendance key, for businesses that lock clock-in / clock-out to one device per person (server:
 * services/attendance_devices.py). A browser never reveals a MAC address, so the device proves itself with an ECDSA P-256 key whose
 * private half can't be exported: it is created here, kept in IndexedDB (one per person, so a shared shop tablet works for everyone)
 * and only ever used to sign the server's one-time challenge.
 *
 * Clearing site data or a private window loses the key, which then looks like a new device to the server; a manager's reset fixes it.
 */

const DB_NAME = "shopconnect-attendance";
const STORE = "device-keys";

export type DeviceProof = {
  challenge: string;
  public_key: string;
  signature: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  op: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = op(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

const b64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

/** False where WebCrypto or IndexedDB is missing (an http:// address other than localhost, very old browsers). */
export function deviceKeysSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.crypto?.subtle &&
    typeof indexedDB !== "undefined"
  );
}

async function keyFor(userId: string): Promise<CryptoKeyPair> {
  const db = await openDb();
  try {
    const saved = await run<CryptoKeyPair | undefined>(db, "readonly", (s) =>
      s.get(userId),
    );
    if (saved?.privateKey && saved.publicKey) return saved;
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false, // the private key can never be read out of this browser
      ["sign", "verify"],
    );
    await run(db, "readwrite", (s) => s.put(pair, userId));
    // ask the browser not to clear our storage under pressure (Safari also drops it after 7 days unused unless installed)
    void navigator.storage?.persist?.().catch(() => undefined);
    return pair;
  } finally {
    db.close();
  }
}

/** Sign the server's challenge with this person's key on this browser (made on first use). Null when the browser can't. */
export async function proveDevice(
  userId: string,
  challenge: string,
): Promise<DeviceProof | null> {
  if (!deviceKeysSupported()) return null;
  try {
    const pair = await keyFor(userId);
    const [spki, signature] = await Promise.all([
      crypto.subtle.exportKey("spki", pair.publicKey),
      crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        pair.privateKey,
        new TextEncoder().encode(challenge),
      ),
    ]);
    return { challenge, public_key: b64(spki), signature: b64(signature) };
  } catch {
    return null; // storage blocked (private window) or the key is unusable: the server answers "device_missing"
  }
}
