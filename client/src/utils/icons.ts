/** 自定义 SVG 代码的轻量清洗（与 nav 的 CategoryIcon 同策略）：只允许纯展示型 SVG */

const BLOCKED_SVG_TAGS = [
  'script',
  'style',
  'foreignObject',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
]

export function sanitizeSvgCode(rawSvg: string): string {
  let svg = rawSvg.trim()

  if (!/^<svg[\s\S]*<\/svg>$/i.test(svg)) {
    return ''
  }

  svg = svg
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!doctype[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  for (const tag of BLOCKED_SVG_TAGS) {
    svg = svg
      .replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi'), '')
      .replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '')
  }

  // 属性名前可能是空白，也可能是 "/"（如 <svg/onload=...> 会被 HTML 解析器视为 onload 属性）
  return svg
    .replace(/(?:\s|\/)on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(?:\s|\/)style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(?:\s|\/)(href|xlink:href)\s*=\s*(['"])\s*(?!#)[^'"]*\2/gi, '')
    .replace(/(?:\s|\/)(href|xlink:href)\s*=\s*(?!#)[^\s>]+/gi, '')
    .replace(/(?:\s|\/)src\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
}

export function isSvgCode(value: string): boolean {
  return /^<svg[\s\S]*<\/svg>$/i.test(value.trim())
}

export function isEmojiIcon(value: string): boolean {
  return !/^https?:\/\//i.test(value) && /\p{Emoji}/u.test(value)
}

export function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname
    if (!domain) return ''
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch {
    return ''
  }
}

export function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
