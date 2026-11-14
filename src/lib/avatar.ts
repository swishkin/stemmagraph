/**
 * Member avatar helpers.
 *
 * Three concerns:
 * - Gravatar: members with an email get `https://www.gravatar.com/avatar/<md5>`
 *   (d=404 so a missing gravatar falls back to initials in the UI).
 * - Uploads: files chosen in a dialog are downscaled on a canvas so the
 *   stored data URL stays small (self-hosted: the URL IS the storage).
 * - Resolution: photoUrl wins, then gravatar (email), then initials (null).
 */

/**
 * Compact MD5 (RFC 1321), UTF-8 safe. Gravatar hashes the lowercased,
 * trimmed email address, so callers must normalize before hashing
 * (gravatarUrlFor does it).
 */
const K = new Int32Array(64);
for (let k = 0; k < 64; k++) {
  // K[k] = floor(abs(sin(k + 1)) * 2^32), RFC 1321 constants.
  K[k] = Math.floor(Math.abs(Math.sin(k + 1)) * 2 ** 32) | 0;
};
const S = new Uint8Array([
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]);

/** MD5 hex digest of a UTF-8 string. */
export function md5(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const rem = bytes.length % 64;
  const padLen = (rem < 56 ? 56 : 120) - rem;
  const msg = new Uint8Array(bytes.length + padLen + 8);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  const dv = new DataView(msg.buffer);
  dv.setUint32(msg.length - 8, bitLen >>> 0, true);
  dv.setUint32(msg.length - 4, Math.floor(bitLen / 4294967296), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const M = new Int32Array(16);

  for (let off = 0; off < msg.length; off += 64) {
    for (let j = 0; j < 16; j++) M[j] = dv.getInt32(off + j * 4, true);
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let k = 0; k < 64; k++) {
      let F: number;
      let g: number;
      if (k < 16) {
        F = (B & C) | (~B & D);
        g = k;
      } else if (k < 32) {
        F = (D & B) | (~D & C);
        g = (5 * k + 1) % 16;
      } else if (k < 48) {
        F = B ^ C ^ D;
        g = (3 * k + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * k) % 16;
      }
      const AA = A;
      const BB = B;
      const CC = C;
      const DD = D;
      const x = (AA + F + K[k] + M[g]) | 0;
      B = (BB + ((x << S[k]) | (x >>> (32 - S[k])))) | 0;
      A = DD;
      D = CC;
      C = BB;
    }
    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  const out = new DataView(new ArrayBuffer(16));
  out.setInt32(0, a0, true);
  out.setInt32(4, b0, true);
  out.setInt32(8, c0, true);
  out.setInt32(12, d0, true);
  let hex = '';
  for (let i = 0; i < 16; i++) {
    hex += out.getUint8(i).toString(16).padStart(2, '0');
  }
  return hex;
}

/** Gravatar normalizes the email: trim + lowercase before hashing. */
export function normalizeGravatarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Gravatar URL for a member email, or null when there is no email.
 * `d=404` makes missing gravatars fail so the UI can fall back to
 * initials instead of showing a mystery default face.
 */
export function gravatarUrlFor(email: string | null | undefined, size = 200): string | null {
  if (!email) return null;
  const norm = normalizeGravatarEmail(email);
  if (!norm) return null;
  return `https://www.gravatar.com/avatar/${md5(norm)}?s=${size}&d=404`;
}

/**
 * Effective avatar source for a member: an explicit photoUrl always wins;
 * otherwise the gravatar (when an email exists); otherwise null (initials).
 */
export function memberAvatarSource(member: {
  photoUrl?: string | null;
  email?: string | null;
}): string | null {
  if (member.photoUrl && member.photoUrl.trim()) return member.photoUrl;
  return gravatarUrlFor(member.email ?? undefined);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the image'));
    img.src = src;
  });
}

/**
 * Converts an uploaded image file into a downscaled JPEG data URL.
 *
 * The data URL is stored as the member's photoUrl, so it must stay small:
 * the longest edge is capped at maxDim and re-encoded at the given quality.
 * Transparent images are composited onto white (JPEG has no alpha).
 */
export async function fileToAvatarDataUrl(
  file: File,
  maxDim = 512,
  quality = 0.85,
): Promise<string> {
  const rawUrl = await readAsDataUrl(file);
  const img = await loadImage(rawUrl);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}
