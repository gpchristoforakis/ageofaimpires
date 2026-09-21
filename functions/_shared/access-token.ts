export interface ChecklistEnv {
  CHECKLIST_SIGNING_SECRET?: string;
  RESEND_API_KEY?: string;
  CHECKLIST_FROM_EMAIL?: string;
  SITE_ORIGIN?: string;
}

interface AccessPayload {
  email: string;
  exp: number;
  version: 1;
}

const encoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createAccessToken(email: string, secret: string, now = Date.now()): Promise<string> {
  const payload: AccessPayload = { email, exp: Math.floor(now / 1000) + 60 * 60 * 24 * 30, version: 1 };
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(encodedPayload));
  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAccessToken(token: string, secret: string, now = Date.now()): Promise<AccessPayload | null> {
  const [encodedPayload, encodedSignature, extra] = token.split('.');
  if (!encodedPayload || !encodedSignature || extra) return null;
  try {
    const signatureBytes = decodeBase64Url(encodedSignature);
    const signature = signatureBytes.buffer.slice(signatureBytes.byteOffset, signatureBytes.byteOffset + signatureBytes.byteLength) as ArrayBuffer;
    const valid = await crypto.subtle.verify('HMAC', await signingKey(secret), signature, encoder.encode(encodedPayload));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as AccessPayload;
    if (payload.version !== 1 || typeof payload.email !== 'string' || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(now / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
