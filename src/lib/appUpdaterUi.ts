export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "2.2.0";

const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Converte notas de release (que podem conter HTML simples do GitHub Releases)
 * em texto puro seguro sem nenhuma renderização de HTML.
 */
export function sanitizeReleaseNotes(raw?: string): string {
  if (!raw || typeof raw !== "string") return "";

  const withBreaks = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ");

  const stripped = withBreaks.replace(/<[^>]*>/g, "");

  const decoded = stripped.replace(
    /&(amp|lt|gt|quot|#39|apos|nbsp);/gi,
    (entity) => HTML_ENTITY_MAP[entity.toLowerCase()] ?? entity,
  );

  return decoded
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatBytes(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 100) return `${mb.toFixed(0)} MB`;
  if (mb >= 10) return `${mb.toFixed(1)} MB`;
  return `${mb.toFixed(2)} MB`;
}

export function formatSpeed(bytesPerSecond?: number): string {
  if (!bytesPerSecond || !Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return "";
  }
  const mbps = bytesPerSecond / (1024 * 1024);
  if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`;
  const kbps = bytesPerSecond / 1024;
  return `${Math.round(kbps)} KB/s`;
}
