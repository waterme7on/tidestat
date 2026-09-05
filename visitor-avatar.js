import { brows, eyes, noses, mouths } from './vendor/notionists-neutral/parts.js';

// B: Notionists Neutral / Zoish. Original hand-drawn paths, not a newly drawn face.
// Keep this palette, variant order and hash stable between refreshes and views.
// Three cream slots make most faces neutral; yellow and sage are quiet accents.
const BACKGROUNDS = ['#faf8f2', '#faf8f2', '#faf8f2', '#f2edcf', '#e2ecde'];
function mix(value) {
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

/**
 * Return a self-contained SVG for an anonymous full visitor ID.
 * No network requests, random state, timers, document IDs or user-provided markup.
 * Deliberately preserve the synchronous avatarSVG(id) interface used by the globe,
 * its canvas image atlas, visitor lists, popups, groups and flat-map fallback.
 */
export function avatarSVG(id) {
  let hash = 2166136261;
  for (const c of String(id)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const pick = (values, salt) => values[mix(hash ^ salt) % values.length];
  const background = pick(BACKGROUNDS, 0x9e3779b9);
  // Upstream's original 560px canvas and component offsets preserve the approved
  // proportions. Every fragment is trusted local art; the visitor ID is only hashed.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 560" fill="none" aria-hidden="true" focusable="false" data-avatar-style="notionists-neutral-b"><circle cx="280" cy="280" r="280" fill="${background}"/><g transform="translate(136 328)">${pick(mouths, 0x243f6a88)}</g><g transform="translate(246 125)">${pick(noses, 0xb7e15162)}</g><g transform="translate(-45 137)">${pick(eyes, 0x8aed2a6b)}</g><g transform="translate(119 114)">${pick(brows, 0x85ebca6b)}</g></svg>`;
}
