/**
 * URL 归一化（去重比较用）：host 小写、去掉末尾斜杠。
 * 解析失败时原样返回 trim 后的字符串（由调用方决定如何处理）。
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hostname = parsed.hostname.toLowerCase();
    let result = parsed.toString();
    if (result.length > 1 && result.endsWith('/')) result = result.slice(0, -1);
    return result;
  } catch {
    return trimmed;
  }
}
