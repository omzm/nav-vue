export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// Cache failures, not deterministic URLs. Browser HTTP caching handles image responses.
const failedDomains = new Map<string, number>();
const RETRY_AFTER = 15 * 60 * 1000;
export function markFaviconFailed(domain: string) {
  if (!domain) return;
  failedDomains.set(domain, Date.now());
  if (failedDomains.size > 500) failedDomains.delete(failedDomains.keys().next().value!);
}
export function getFallbackFaviconUrl(url: string): string {
  const domain = extractDomain(url);
  return domain
    ? 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=128'
    : '';
}
export function getFaviconUrl(url: string): string {
  const domain = extractDomain(url);
  if (!domain) return '';
  const failedAt = failedDomains.get(domain);
  if (failedAt && Date.now() - failedAt < RETRY_AFTER) return getFallbackFaviconUrl(url);
  failedDomains.delete(domain);
  return 'https://www.faviconextractor.com/favicon/' + encodeURIComponent(domain) + '?larger=true';
}
