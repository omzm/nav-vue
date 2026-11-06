export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 1000 &&
    value.every((id) => typeof id === 'string' && UUID_RE.test(id)) &&
    new Set(value).size === value.length
  );
}

export function assertHttpUrl(raw: string): URL {
  const url = new URL(raw);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    raw.length > 8192
  ) {
    throw new Error('URL 必须是有效的 HTTP 或 HTTPS 地址');
  }
  return url;
}

export function validOrder(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 2147483647)
  );
}
