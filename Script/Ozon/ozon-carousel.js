// Ozon Bank: hides banner ads on the main screen.
// 1. Main screen data (MFEMainMobile): the listed widget types arrive with data: null.
// 2. Banner query (promo/api/banners/list): the banner arrays arrive empty,
//    with the response structure left exactly as the server sent it.
// Caching headers are stripped so both apply on every launch.
// Widget types come from the module argument, joined with +:
//   argument=MARKETING_BANNER_SLIDER+MARKETING_LAST_OPERATIONS_BANNER
const arg = typeof $argument !== 'undefined' ? String($argument) : '';
const TYPES = arg.split('+').map((t) => t.trim()).filter((t) => /^[A-Z_]+$/.test(t));
if (!TYPES.length) TYPES.push('MARKETING_BANNER_SLIDER');
const BANNER_KEYS = ['bannerId', 'placementSlug', 'image', 'imageDark', 'config', 'creativeId'];

function hideWidgets(node) {
  if (Array.isArray(node)) { node.forEach(hideWidgets); return; }
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string' && TYPES.includes(node.type) && node.data !== null) node.data = null;
  for (const k of Object.keys(node)) hideWidgets(node[k]);
}

function emptyBannerLists(node) {
  if (Array.isArray(node)) { node.forEach(emptyBannerLists); return; }
  if (!node || typeof node !== 'object') return;
  for (const k of Object.keys(node)) {
    const v = node[k];
    emptyBannerLists(v); // innermost first
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object' && BANNER_KEYS.some((b) => b in x))) node[k] = [];
  }
}

const body = $response.body || '';
let data = null;
try { data = JSON.parse(body); } catch (e) {}
if (data && typeof data === 'object') {
  if (/banners\/list/.test($request.url)) emptyBannerLists(data);
  else hideWidgets(data);
}

const head = Object.assign({}, $response.headers || {});
for (const k of Object.keys(head)) {
  if (/^(cache-control|etag|expires|last-modified|age|pragma|content-length)$/i.test(k)) delete head[k];
}
head['Cache-Control'] = 'no-store, no-cache, must-revalidate';
head['Pragma'] = 'no-cache';

$done({ body: data ? JSON.stringify(data) : body, headers: head });
