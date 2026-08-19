export function publicMediaUrl(relative: string | null | undefined) {
  if (!relative) return null;
  if (/^https?:\/\//i.test(relative)) return relative;
  return `/api/media/${relative}`;
}
