import DOMPurify from 'dompurify';
export { getFaviconUrl } from './favicon';

/** Static vector shapes only: no animation, links, external resources or event handlers. */
export function sanitizeSvgCode(rawSvg: string): string {
  if (!isSvgCode(rawSvg)) return '';
  return DOMPurify.sanitize(rawSvg, {
    ALLOWED_TAGS: [
      'svg',
      'g',
      'path',
      'circle',
      'ellipse',
      'rect',
      'line',
      'polyline',
      'polygon',
      'defs',
      'linearGradient',
      'radialGradient',
      'stop',
      'clipPath',
      'mask',
      'title',
      'desc',
      'text',
      'tspan',
    ],
    ALLOWED_ATTR: [
      'xmlns',
      'viewBox',
      'width',
      'height',
      'x',
      'y',
      'x1',
      'x2',
      'y1',
      'y2',
      'cx',
      'cy',
      'r',
      'rx',
      'ry',
      'd',
      'points',
      'fill',
      'fill-rule',
      'fill-opacity',
      'stroke',
      'stroke-width',
      'stroke-linecap',
      'stroke-linejoin',
      'stroke-dasharray',
      'stroke-dashoffset',
      'stroke-opacity',
      'opacity',
      'transform',
      'id',
      'offset',
      'stop-color',
      'stop-opacity',
      'gradientUnits',
      'gradientTransform',
      'clip-path',
      'mask',
      'font-size',
      'text-anchor',
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}

export function isSvgCode(value: string): boolean {
  return /^<svg[\s\S]*<\/svg>$/i.test(value.trim());
}

export function isEmojiIcon(value: string): boolean {
  return !/^https?:\/\//i.test(value) && /\p{Emoji}/u.test(value);
}

export function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
