import { createServiceClient } from './supabase.js';

/**
 * AI 配置读写与 OpenAI 兼容接口调用（服务端专用，Key 不出服务端）。
 * 对应 nav 的 ai-client.ts。
 */

export const AI_API_BASE_KEY = 'ai_api_base';
export const AI_API_KEY_KEY = 'ai_api_key';
export const AI_MODEL_KEY = 'ai_model';

export interface AiCredentials {
  apiBase: string;
  apiKey: string;
  model: string;
}

export async function readAiCredentials(): Promise<AiCredentials> {
  const { data, error } = await createServiceClient()
    .from('app_config')
    .select('key, value')
    .in('key', [AI_API_BASE_KEY, AI_API_KEY_KEY, AI_MODEL_KEY]);
  if (error) throw new Error('读取 AI 配置失败');
  const map = new Map((data || []).map((row) => [row.key as string, row.value as string]));
  return {
    apiBase: (map.get(AI_API_BASE_KEY) || '').trim(),
    apiKey: (map.get(AI_API_KEY_KEY) || '').trim(),
    model: (map.get(AI_MODEL_KEY) || '').trim(),
  };
}

/** 调用 OpenAI 兼容接口的 chat completions */
export async function callChatCompletions(userPrompt: string, maxTokens = 200): Promise<string> {
  const { apiBase, apiKey, model } = await readAiCredentials();
  if (!apiBase || !apiKey || !model) {
    throw new Error('AI 未配置：请先在后台「AI 设置」中填写 API 地址、Key 并选择模型');
  }

  // SSRF 防护：只允许公网 http(s) 地址，拒绝内网/回环字面量
  assertPublicHttpUrl(apiBase);

  let response: Response;
  try {
    response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: '你是一个网站导航站的中文编辑。请用简体中文写网站描述，只输出描述正文，不要解释、不要加引号、不要用 markdown。',
          },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new Error('无法连接到 API 地址（网络不通或超时），请检查地址是否正确');
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    if (response.status === 401 || response.status === 403) {
      throw new Error('API Key 无效或无权限（401/403），请检查 Key 是否正确');
    }
    if (response.status === 404) {
      throw new Error('接口地址不存在（404），请检查 API 地址是否正确');
    }
    throw new Error(`AI 接口返回 ${response.status}，请检查 API 地址和 Key`);
  }

  const data: unknown = await readJsonBounded(response);
  const choices =
    typeof data === 'object' && data !== null && 'choices' in data
      ? (data as { choices?: unknown }).choices
      : undefined;
  const firstChoice = Array.isArray(choices)
    ? (choices[0] as { message?: { content?: unknown } } | undefined)
    : undefined;
  const rawContent = firstChoice?.message?.content;
  const text = typeof rawContent === 'string' ? rawContent.trim() : '';
  if (!text) throw new Error('AI 没有返回有效内容');
  return text;
}

function assertPublicHttpUrl(apiBase: string): void {
  let url: URL;
  try {
    url = new URL(apiBase);
  } catch {
    throw new Error('API 地址格式不正确');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('API 地址必须以 http:// 或 https:// 开头');
  }
  const host = url.hostname.toLowerCase();
  const blocked =
    /^(localhost|0\.0\.0\.0|\[::1\]|::1)$/.test(host) ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host);
  if (blocked) {
    throw new Error('API 地址不允许指向本地或内网地址');
  }
}

/** 有界读取 JSON：防止异常中转返回超大 body 拖垮服务端 */
async function readJsonBounded(response: Response, maxBytes = 1_000_000): Promise<unknown> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new Error('AI 接口返回数据过大，疑似中转异常');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('AI 接口返回了空响应体');
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error('AI 接口返回数据过大，疑似中转异常');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    return null;
  }
}
