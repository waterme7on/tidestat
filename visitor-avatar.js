// Stable local anonymous avatars; extracted unchanged from the preceding map revision.
export function avatarSVG(id) {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const backgrounds = ['#e1efe6', '#f6e4dc', '#e3eaf9', '#f5edcf', '#ece3f5', '#dceff2'];
  const skins = ['#f5c9a5', '#e9ae83', '#d7956d', '#a96d50', '#f7d9bf'];
  const hairs = ['#322b30', '#654332', '#b77b40', '#3c384b'];
  const shirts = ['#638c78', '#d98168', '#728fc4', '#ae8bc3', '#c49d49', '#519ba0'];
  const bg = backgrounds[h % 6], skin = skins[(h >>> 4) % 5], hair = hairs[(h >>> 8) % 4], shirt = shirts[(h >>> 12) % 6];
  const style = (h >>> 16) % 4;
  const back = style === 1 ? `<path d="M12 36C9 9 52 9 52 36V51H12Z" fill="${hair}"/>` : '';
  const fringe = [
    '<path d="M16 30V24C16 7 49 7 49 26V31L43 23C36 25 27 22 24 19L19 30Z"/>',
    '<path d="M15 30V25C15 7 49 7 49 26V32L43 21C35 28 25 21 23 19L20 29Z"/>',
    '<path d="M16 29V23C17 8 47 6 49 25L47 32L43 21L19 27Z"/>',
    '<path d="M16 30V24C16 8 48 8 49 26V30L43 22C31 24 24 23 19 26Z"/>'
  ][style];
  const cap = style === 3 ? `<path d="M14 24C15 8 46 8 49 24Z" fill="${shirt}"/><path d="M13 24H51" stroke="${shirt}" stroke-width="5" stroke-linecap="round"/>` : '';
  const glasses = ((h >>> 20) % 4 === 0) ? '<g fill="none" stroke="#39333b" stroke-width="1.5"><rect x="21" y="30" width="9" height="8" rx="3"/><rect x="34" y="30" width="9" height="8" rx="3"/><path d="M30 33h4"/></g>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="${bg}"/>${back}<path d="M10 57Q13 44 32 44Q51 44 54 57Q32 70 10 57" fill="${shirt}"/><rect x="27" y="43" width="10" height="9" rx="4" fill="${skin}"/><circle cx="16" cy="34" r="4" fill="${skin}"/><circle cx="48" cy="34" r="4" fill="${skin}"/><rect x="16" y="15" width="32" height="33" rx="15" fill="${skin}"/><g fill="${hair}">${fringe}</g>${cap}<g fill="#332b31"><ellipse cx="25.5" cy="33.5" rx="2.2" ry="2.9"/><ellipse cx="38.5" cy="33.5" rx="2.2" ry="2.9"/></g><g fill="#fff"><circle cx="26" cy="32.5" r=".8"/><circle cx="39" cy="32.5" r=".8"/></g><g fill="#e78e8d" opacity=".55"><ellipse cx="21" cy="39" rx="3.5" ry="2"/><ellipse cx="43" cy="39" rx="3.5" ry="2"/></g><path d="M29 40Q32 44 35 40" fill="none" stroke="#854b45" stroke-width="1.5" stroke-linecap="round"/>${glasses}</svg>`;
}
