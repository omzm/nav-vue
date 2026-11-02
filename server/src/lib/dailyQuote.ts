/**
 * 每日一言：内存缓存 1 小时，失败不缓存（下次即重试）。
 * 对应 nav 的 daily-quote.ts（unstable_cache revalidate 3600）。
 */
const FALLBACK_QUOTES = [
  '生活总会给你答案，但不会马上把一切都告诉你。',
  '保持热爱，奔赴山海。',
  '日拱一卒，功不唐捐。',
  '把每一天当作最好的一天来过。',
  '所有的努力，都不会被辜负。',
  '慢慢来，比较快。',
];

const QUOTE_TTL_MS = 3_600_000;
let cached: { quote: string; at: number } | null = null;

function getFallbackQuote(): string {
  return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
}

/** 有界读取文本：第三方接口返回超大 body 时直接掐断，不让它拖垮服务端 */
async function readTextBounded(response: Response, maxBytes = 8192): Promise<string> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new Error('Quote response too large');
  }
  const reader = response.body?.getReader();
  if (!reader) {
    return (await response.text()).slice(0, maxBytes);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error('Quote response too large');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

async function loadQuote(): Promise<string> {
  const response = await fetch('https://v.api.aa1.cn/api/yiyan/index.php', {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) {
    throw new Error(`Quote request failed: ${response.status}`);
  }
  const text = await readTextBounded(response);
  const quote = text.replace(/<[^>]*>/g, '').trim();
  return quote || getFallbackQuote();
}

export async function getDailyQuote(): Promise<string> {
  const now = Date.now();
  if (cached && now - cached.at < QUOTE_TTL_MS) {
    return cached.quote;
  }
  // 失败直接抛错：不缓存失败结果，上游恢复后下次即取到新文案
  const quote = await loadQuote();
  cached = { quote, at: now };
  return quote;
}
