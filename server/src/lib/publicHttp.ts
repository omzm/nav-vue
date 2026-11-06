import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { Agent, fetch as undiciFetch } from 'undici';

export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}

export function assertPublicHttpUrl(raw: string): URL {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('地址必须使用不含登录凭据的 HTTP 或 HTTPS URL');
  }
  const host = url.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase();
  if (
    (!host.includes('.') && !isIP(host)) ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    (isIP(host) && !isPublicAddress(host))
  ) {
    throw new Error('地址不允许指向本地、内网或保留地址');
  }
  return url;
}

type Resolver = (host: string) => Promise<Array<{ address: string; family: number }>>;

async function abortable<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let onAbort = () => {};
  try {
    return await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

/** Dependencies are injectable for network-free DNS/redirect regression tests. */
export function createPublicFetcher(
  resolve: Resolver = (host) => lookup(host, { all: true, verbatim: true }),
  send: typeof undiciFetch = undiciFetch,
) {
  /** Validate DNS answers, pin the connection to those answers, and recheck every redirect. */
  return async function fetchPublic(
    raw: string,
    init: RequestInit = {},
    redirects = 0,
  ): Promise<Response> {
    let url = assertPublicHttpUrl(raw);
    const timeout = AbortSignal.timeout(8000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    for (let hop = 0; ; hop++) {
      signal.throwIfAborted();
      const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
      const addresses = isIP(host)
        ? [{ address: host, family: isIP(host) }]
        : await abortable(resolve(host), signal);
      signal.throwIfAborted();
      if (!addresses.length || addresses.some((item) => !isPublicAddress(item.address))) {
        throw new Error('域名解析到了非公网地址');
      }
      const dispatcher = new Agent({
        connect: {
          lookup(_hostname, options, callback) {
            // Node may ask for all addresses for family auto-selection. Both paths use pinned DNS.
            if (options.all) callback(null, addresses);
            else callback(null, addresses[0].address, addresses[0].family);
          },
        },
      });
      let response: Response;
      try {
        response = (await send(url, {
          ...init,
          signal,
          redirect: 'manual',
          dispatcher,
        } as Parameters<typeof undiciFetch>[1])) as unknown as Response;
      } catch (error) {
        await dispatcher.destroy();
        throw error;
      }
      // close() waits for the response body to be consumed; do not await it here.
      void dispatcher.close().catch(() => {});
      if (response.status < 300 || response.status >= 400) return response;
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (
        !location ||
        hop >= redirects ||
        (init.headers && new Headers(init.headers).has('authorization'))
      ) {
        throw new Error('接口重定向被拒绝，请填写最终的公网地址');
      }
      url = assertPublicHttpUrl(new URL(location, url).href);
    }
  };
}

export const fetchPublic = createPublicFetcher();
