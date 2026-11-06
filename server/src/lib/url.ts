/**
 * URL 归一化（去重比较用）：host 小写、去掉末尾斜杠。
 * 解析失败时原样返回 trim 后的字符串（由调用方决定如何处理）。
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    // Preserve query and fragment values byte-for-byte. Only an empty root path is omitted.
    const result = parsed.toString();
    return !parsed.search && !parsed.hash && parsed.pathname === '/' ? result.slice(0, -1) : result;
  } catch {
    return trimmed;
  }
}
