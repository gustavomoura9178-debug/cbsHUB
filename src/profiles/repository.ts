import {
  defaultProfile,
  migrateLegacyProfile,
  PROFILE_KEY,
  validateProfile,
  type UserProfile,
} from "./model";
export const ACTIVE_AUTH_USER_KEY = "cbshub-active-user-id";
const BLOCK_KEY = "cbshub-blocked-v1";

export function purgeLegacyAccountStorage(newUserId?: string): void {
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(BLOCK_KEY);
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("cbshub-chat-draft:")) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      localStorage.removeItem(key);
    }
    if (newUserId) {
      localStorage.setItem(ACTIVE_AUTH_USER_KEY, newUserId);
    } else {
      localStorage.removeItem(ACTIVE_AUTH_USER_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
}

export function loadProfile(owner: string, name: string): UserProfile {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // Se pertencia a outro usuário autenticado ou formato antigo diferente, descarta sem vazar dados da conta anterior
      if (
        typeof parsed?.ownerId === "string" &&
        parsed.ownerId &&
        parsed.ownerId !== owner
      ) {
        const fresh = defaultProfile(owner, name);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(fresh));
        return fresh;
      }
      const migrated = migrateLegacyProfile(parsed, owner, name);
      if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(migrated));
      }
      return migrated;
    } catch {
      const fresh = defaultProfile(owner, name);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(fresh));
      return fresh;
    }
  }
  const p = defaultProfile(owner, name);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  return p;
}
export function saveProfile(profile: UserProfile, owner: string): UserProfile {
  let oldCreatedAt: number | null = null;
  const current = localStorage.getItem(PROFILE_KEY);
  if (current) {
    try {
      const old = migrateLegacyProfile(JSON.parse(current), owner, profile.displayName);
      oldCreatedAt = old.createdAt;
    } catch {
      oldCreatedAt = null;
    }
  }
  const candidate: UserProfile = {
    ...profile,
    ownerId: owner,
    createdAt: oldCreatedAt ?? profile.createdAt,
  };
  const validated = validateProfile(candidate, owner);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(validated));
  return validated;
}
export function readOwnProfile(owner: string, name: string): UserProfile {
  try {
    return loadProfile(owner, name);
  } catch {
    const safe = defaultProfile(owner, name);
    safe.privacy.visibility = 'private';
    safe.privacy.allowCalls = false;
    safe.privacy.allowReactions = false;
    return safe;
  }
}
export function blockedIds(): string[] {
  try {
    const x = JSON.parse(localStorage.getItem(BLOCK_KEY) || "[]");
    return Array.isArray(x)
      ? x
          .filter((id) => typeof id === "string" && id.length <= 100)
          .slice(0, 200)
      : [];
  } catch {
    return [];
  }
}
export function isBlocked(id: string) {
  return blockedIds().includes(id);
}
export function setBlocked(id: string, blocked: boolean, owner: string) {
  if (id === owner)
    throw new Error("Você não pode bloquear a própria identidade.");
  const list = blockedIds().filter((x) => x !== id);
  if (blocked) list.push(id);
  if (list.length > 200) throw new Error("Limite de bloqueios atingido.");
  localStorage.setItem(BLOCK_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("cbshub-profile-changed"));
}
export function compressCanvasImage(
  bitmap: ImageBitmap,
  kind: "avatar" | "banner",
  crop?: { sx: number; sy: number; sw: number; sh: number },
): string {
  const sizes: Array<[number, number]> =
    kind === "avatar"
      ? [
          [512, 512],
          [384, 384],
          [256, 256],
        ]
      : [
          [1280, 480],
          [960, 360],
          [720, 270],
        ];
  const qualities = [0.85, 0.78, 0.68, 0.55, 0.42];
  const targetChars = kind === "avatar" ? 200_000 : 420_000;
  const hardLimitChars = kind === "avatar" ? 350_000 : 650_000;

  let best = "";
  for (const [w, h] of sizes) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    if (crop) {
      ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
    } else {
      const scale = Math.max(w / bitmap.width, h / bitmap.height);
      ctx.drawImage(
        bitmap,
        (w - bitmap.width * scale) / 2,
        (h - bitmap.height * scale) / 2,
        bitmap.width * scale,
        bitmap.height * scale,
      );
    }
    for (const q of qualities) {
      const candidate = canvas.toDataURL("image/webp", q);
      best = candidate;
      if (candidate.length <= targetChars) {
        return candidate;
      }
    }
  }
  if (best.length > hardLimitChars) {
    throw new Error("Imagem muito detalhada após compressão; ajuste o recorte.");
  }
  return best;
}

export async function encodeWebpBlobFromDataUrl(
  dataUrl: string,
  kind: "avatar" | "banner",
): Promise<Blob> {
  const res = await fetch(dataUrl);
  const srcBlob = await res.blob();
  const bitmap = await createImageBitmap(srcBlob);
  try {
    const maxW = kind === "avatar" ? 512 : 1280;
    const maxH = kind === "avatar" ? 512 : 480;
    const w = Math.min(maxW, Math.max(1, bitmap.width));
    const h = Math.min(maxH, Math.max(1, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponível para conversão WebP.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((out) => resolve(out), "image/webp", 0.85),
    );
    if (!blob || blob.size === 0) {
      throw new Error("Falha ao converter imagem para WebP.");
    }
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function profileImage(
  file: File,
  kind: "avatar" | "banner",
): Promise<string> {
  const limit = 25 * 1024 * 1024;
  if (file.size > limit)
    throw new Error("Arquivo muito grande: limite de 25 MB.");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Use PNG, JPEG ou WebP. SVG não é permitido.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width > 10000 || bitmap.height > 10000)
      throw new Error("Imagem com dimensões excessivas (máx. 10000 px).");
    return compressCanvasImage(bitmap, kind);
  } finally {
    bitmap.close();
  }
}
