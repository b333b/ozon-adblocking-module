// Ozon Bank: removes banner ads from the main screen. Handles all three places they arrive:
//   1. /m/lk/main                          the rendered banner markup and the banner data in the page
//   2. apps/main/_mf/info/MFEMainMobile    the banner widgets in the main-screen data
//   3. apps/promo/api/banners/list         the banner query
// Caching headers are stripped so the changes apply on every launch.
// Widget types come from the module argument, joined with +:
//   argument=MARKETING_BANNER_SLIDER+MARKETING_LAST_OPERATIONS_BANNER
const arg = typeof $argument !== 'undefined' ? String($argument) : '';
const TYPES = arg.split('+').map((t) => t.trim()).filter((t) => /^[A-Z_]+$/.test(t));
if (!TYPES.length) TYPES.push('MARKETING_BANNER_SLIDER');
const BANNER_KEYS = ['bannerId', 'placementSlug', 'image', 'imageDark', 'config', 'creativeId'];

// 1. The page carries finished banner markup as "MFPromoBanners…@promo": { data: { body: "…" } },
//    usually percent-encoded, with inner quotes escaped. Empty that body, leave every other module alone.
function emptySsrBanners(text) {
  const forms = [
    { id: /MFPromoBanners[A-Za-z]*%40promo/, key: '%22body%22%3A%22', quote: '%22', esc: '%5C' },
    { id: /MFPromoBanners[A-Za-z]*@promo/, key: '"body":"', quote: '"', esc: '\\' },
  ];
  for (const f of forms) {
    let pos = 0, guard = 0;
    while (guard++ < 10) {
      const rel = text.slice(pos).search(f.id);
      if (rel < 0) break;
      const idAt = pos + rel;
      const start = text.indexOf(f.key, idAt);
      if (start < 0 || start - idAt > 400) { pos = idAt + 20; continue; }
      const from = start + f.key.length;
      let i = from, end = -1;
      while (i < text.length) {
        const q = text.indexOf(f.quote, i);
        if (q < 0) break;
        let back = 0;
        while (q - (back + 1) * f.esc.length >= 0 && text.substr(q - (back + 1) * f.esc.length, f.esc.length) === f.esc) back++;
        if (back % 2 === 0) { end = q; break; }
        i = q + f.quote.length;
      }
      if (end > from) text = text.slice(0, from) + text.slice(end);
      pos = from;
    }
  }
  return text;
}

// 1b. The same page also carries the banner data the app rebuilds the carousel from during
//     hydration. Empty those lists too, counting brackets and respecting escapes.
function emptyEncodedArrays(text, keys) {
  const forms = [
    { quote: '%22', esc: '%5C', open: '%5B', close: '%5D', k: (n) => `%22${n}%22%3A%5B` },
    { quote: '"', esc: '\\', open: '[', close: ']', k: (n) => `"${n}":[` },
  ];
  for (const f of forms) {
    for (const name of keys) {
      const key = f.k(name);
      let pos = 0, guard = 0;
      while (guard++ < 20) {
        const at = text.indexOf(key, pos);
        if (at < 0) break;
        const from = at + key.length;
        let i = from, depth = 1, inStr = false;
        while (i < text.length && depth > 0) {
          if (inStr && text.startsWith(f.esc, i)) {
            i += f.esc.length;
            if (text.startsWith(f.esc, i)) i += f.esc.length;
            else if (text.startsWith(f.quote, i)) i += f.quote.length;
            else i += 1;
            continue;
          }
          if (text.startsWith(f.quote, i)) { inStr = !inStr; i += f.quote.length; continue; }
          if (!inStr && text.startsWith(f.open, i)) { depth++; i += f.open.length; continue; }
          if (!inStr && text.startsWith(f.close, i)) { depth--; if (!depth) break; i += f.close.length; continue; }
          i += 1;
        }
        if (depth === 0 && i > from) text = text.slice(0, from) + text.slice(i);
        pos = from;
      }
    }
  }
  return text;
}

// 2. Main-screen data: the listed widget types arrive with no data, the state the app uses for empty widgets.
function hideWidgets(node) {
  if (Array.isArray(node)) { node.forEach(hideWidgets); return; }
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string' && TYPES.includes(node.type) && node.data !== null) node.data = null;
  for (const k of Object.keys(node)) hideWidgets(node[k]);
}

// 3. Banner query: keep the response shape, empty the innermost arrays of banners.
function emptyBannerLists(node) {
  if (Array.isArray(node)) { node.forEach(emptyBannerLists); return; }
  if (!node || typeof node !== 'object') return;
  for (const k of Object.keys(node)) {
    const v = node[k];
    emptyBannerLists(v);
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object' && BANNER_KEYS.some((b) => b in x))) node[k] = [];
  }
}

const url = $request.url;
const body = $response.body || '';
let data = null;
try { data = JSON.parse(body); } catch (e) {}

let out = body;
if (data && typeof data === 'object') {
  if (/banners\/list/.test(url)) emptyBannerLists(data);
  else hideWidgets(data);
  out = JSON.stringify(data);
} else if (/\/m\/lk\//.test(url) && body) {
  out = emptyEncodedArrays(emptySsrBanners(body), ['banners', 'creatives']);
}

const head = Object.assign({}, $response.headers || {});
for (const k of Object.keys(head)) {
  if (/^(cache-control|etag|expires|last-modified|age|pragma|content-length)$/i.test(k)) delete head[k];
}
head['Cache-Control'] = 'no-store, no-cache, must-revalidate';
head['Pragma'] = 'no-cache';

$done({ body: out, headers: head });
