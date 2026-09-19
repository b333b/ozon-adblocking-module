// Ozon Bank: hides the banner carousel on the main screen.
// Sets the MARKETING_BANNER_SLIDER widget's data to null and tells the app not to
// cache the response, so the change applies on every launch.
// Optional module argument: extra widget types to hide, joined with +
//   argument=MARKETING_BANNER_SLIDER+NEW_PRODUCT_BUTTON
const arg = typeof $argument !== 'undefined' ? String($argument) : '';
const TYPES = arg.split('+').map((t) => t.trim()).filter((t) => /^[A-Z_]+$/.test(t));
if (!TYPES.length) TYPES.push('MARKETING_BANNER_SLIDER');

function hide(node) {
  if (Array.isArray(node)) { node.forEach(hide); return; }
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string' && TYPES.includes(node.type) && node.data !== null) node.data = null;
  for (const k of Object.keys(node)) hide(node[k]);
}

const body = $response.body || '';
let data = null;
try { data = JSON.parse(body); } catch (e) {}
if (data && typeof data === 'object') hide(data);

const head = Object.assign({}, $response.headers || {});
for (const k of Object.keys(head)) {
  if (/^(cache-control|etag|expires|last-modified|age|pragma|content-length)$/i.test(k)) delete head[k];
}
head['Cache-Control'] = 'no-store, no-cache, must-revalidate';
head['Pragma'] = 'no-cache';

$done({ body: data ? JSON.stringify(data) : body, headers: head });
