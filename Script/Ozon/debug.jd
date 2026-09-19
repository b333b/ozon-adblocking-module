// Ozon Bank: carousel hider + built-in troubleshooting. d1
// Runs on the main-screen responses, applies the change, and records exactly what it saw and did.
// Pages (open in Safari):
//   https://finance.ozon.ru/__dump        what ran, and the carousel widget before/after
//   https://finance.ozon.ru/__dump/full   privacy-safe outline of the whole last response
//   https://finance.ozon.ru/__dump/raw    the last response as-is (contains personal data, don't share)
// Settings live in the module line:
//   argument=MARKETING_BANNER_SLIDER+mode:null|nodata|empty|blank|remove+order:null|empty|keep
const VERSION = 'd2';
const KEY = 'ozon_debug';
const MARK = /ob-banner-manager/i;

const arg = typeof $argument !== 'undefined' ? String($argument) : '';
const tokens = arg.split('+').map((t) => t.trim()).filter(Boolean);
const pick = (n, d) => { const t = tokens.find((x) => x.toLowerCase().startsWith(n + ':')); return t ? t.split(':')[1].toLowerCase() : d; };
const MODE = ['null', 'nodata', 'empty', 'blank', 'remove'].includes(pick('mode', 'null')) ? pick('mode', 'null') : 'null';
const ORDER = ['null', 'empty', 'keep'].includes(pick('order', 'null')) ? pick('order', 'null') : 'null';
const TYPES = tokens.filter((t) => /^[A-Z_]+$/.test(t));
if (!TYPES.length) TYPES.push('MARKETING_BANNER_SLIDER');

const changes = [];
const seen = [];
const isTarget = (w) => w && typeof w === 'object' && !Array.isArray(w) && TYPES.includes(w.type);

function outline(v, d) {
  if (d > 30) return '<deep>';
  if (Array.isArray(v)) return v.map((x) => outline(x, d + 1));
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = outline(v[k], d + 1); return o; }
  if (typeof v === 'number') return Number.isInteger(v) ? 0 : 0.5;
  if (typeof v !== 'string') return v;
  if (MARK.test(v)) return '<BANNER_IMAGE>';
  if (/^\s*[\[{]/.test(v)) { try { return { '<json-in-string>': outline(JSON.parse(v), d + 1) }; } catch (e) {} }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v.split('?')[0].replace(/[0-9a-f]{8,}/gi, '#');
  if (/^[A-Za-z][A-Za-z0-9_.\/-]{0,40}$/.test(v) && !/\d{4,}/.test(v)) return v;
  return `<text ${v.length}>`;
}
const find = (node, out) => {
  if (Array.isArray(node)) node.forEach((x) => find(x, out));
  else if (node && typeof node === 'object') {
    if (isTarget(node)) out.push(node);
    for (const k of Object.keys(node)) find(node[k], out);
  }
  return out;
};

function blankImages(node) {
  let n = 0;
  if (Array.isArray(node)) node.forEach((v, i) => { n += blankOne(node, i); });
  else if (node && typeof node === 'object') for (const k of Object.keys(node)) n += blankOne(node, k);
  return n;
}
function blankOne(holder, key) {
  const v = holder[key];
  if (v && typeof v === 'object') return blankImages(v);
  if (typeof v !== 'string' || !MARK.test(v)) return 0;
  if (/^\s*[\[{]/.test(v)) { try { const d = JSON.parse(v); const n = blankImages(d); if (n) { holder[key] = JSON.stringify(d); return n; } } catch (e) {} }
  holder[key] = '';
  return 1;
}

function walk(node) {
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      if (MODE === 'remove' && isTarget(node[i])) { changes.push(`${node[i].type}: removed`); node.splice(i, 1); continue; }
      walk(node[i]);
    }
  } else if (node && typeof node === 'object') {
    if (typeof node.type === 'string' && /^[A-Z][A-Z_]+$/.test(node.type) && node.status) seen.push(node.type);
    if (isTarget(node)) {
      if (MODE === 'null' && node.data !== null) { node.data = null; changes.push(`${node.type}: data null`); }
      if (MODE === 'nodata' && node.data && node.data.creativeData !== null) { node.data.creativeData = null; changes.push(`${node.type}: creativeData null`); }
      if (MODE === 'empty') { const c = node.data && node.data.creativeData;
        if (c && Array.isArray(c.creatives) && c.creatives.length) { changes.push(`${node.type}: ${c.creatives.length} banners cleared`); c.creatives = []; } }
      if (MODE === 'blank' && node.data) { const n = blankImages(node.data); if (n) changes.push(`${node.type}: ${n} image links blanked`); }
    }
    const ab = node.actionButton;
    if (ORDER !== 'keep' && ab && typeof ab === 'object' && Array.isArray(ab.actions) && ab.actions.includes('ORDER_CARD')) {
      if (ORDER === 'null') { node.actionButton = null; changes.push('order card button: null'); }
      else { ab.actions = ab.actions.filter((a) => a !== 'ORDER_CARD'); changes.push('order card button: action removed'); }
    }
    for (const k of Object.keys(node)) walk(node[k]);
  }
}

function load() { try { return JSON.parse($persistentStore.read(KEY) || '{}'); } catch (e) { return {}; } }
function save(s) { if (!$persistentStore.write(JSON.stringify(s), KEY)) { s.raw = ''; s.full = ''; $persistentStore.write(JSON.stringify(s), KEY); } }

if (typeof $response !== 'undefined') {
  const body = $response.body || '';
  const head = Object.assign({}, $response.headers || {});
  const hv = (n) => { const k = Object.keys(head).find((x) => x.toLowerCase() === n); return k ? head[k] : ''; };
  const cacheInfo = `cache-control: ${hv('cache-control') || '(none)'} | etag: ${hv('etag') ? 'yes' : 'no'} | age: ${hv('age') || '-'} | expires: ${hv('expires') || '-'}`;
  // stop the app from reusing this response next launch
  for (const k of Object.keys(head)) if (/^(cache-control|etag|expires|last-modified|age|pragma|content-length)$/i.test(k)) delete head[k];
  head['Cache-Control'] = 'no-store, no-cache, must-revalidate';
  head['Pragma'] = 'no-cache';
  const url = $request.url.split('?')[0].replace('https://finance.ozon.ru', '');
  let data = null;
  try { data = JSON.parse(body); } catch (e) {}
  let before = '(no target widget in this response)', after = before;
  if (data && typeof data === 'object') {
    const t = find(data, []);
    if (t.length) before = JSON.stringify(outline(t[0], 0), null, 1);
    walk(data);
    const t2 = find(data, []);
    after = t2.length ? JSON.stringify(outline(t2[0], 0), null, 1) : '(widget no longer present)';
  }
  const s = load();
  s.runs = (s.runs || []).concat([{
    time: new Date().toISOString(), version: VERSION, url,
    settings: `mode ${MODE} | order ${ORDER} | types ${TYPES.join(', ')}`,
    json: data ? `yes, ${body.length} chars` : `NO - not JSON, ${body.length} chars`,
    widgets: [...new Set(seen)].join(', ') || '(none)',
    changes: changes.length ? changes.join('; ') : '(nothing matched)',
    sent: (changes.length ? 'modified body' : 'original body') + ' sent, caching turned off',
    cache: cacheInfo,
    before: before.slice(0, 900), after: after.slice(0, 900),
  }]).slice(-6);
  if (data && /MFEMainMobile/.test(url)) { s.full = JSON.stringify(outline(data, 0), null, 1); s.raw = body; }
  save(s);
  $done({ body: data ? JSON.stringify(data) : body, headers: head });
} else {
  const s = load();
  const url = $request.url;
  let out;
  if (/\/raw/.test(url)) out = s.raw || 'nothing captured';
  else if (/\/full/.test(url)) out = s.full || 'nothing captured';
  else {
    out = `script ${VERSION} loaded. This page opened at ${new Date().toISOString()}.\nIf the newest run below is older than your last app launch, the app did not fetch the main screen: it used its cached copy.\n\n`;
    out += (s.runs && s.runs.length)
      ? s.runs.map((r) => `=== ${r.time} [${r.version}]\nurl:      ${r.url}\nsettings: ${r.settings}\nbody:     ${r.json}\ncaching:  ${r.cache || '(not recorded)'}\nwidgets:  ${r.widgets}\nchanges:  ${r.changes}\nresult:   ${r.sent}\n\ncarousel widget BEFORE:\n${r.before}\n\ncarousel widget AFTER:\n${r.after}\n`).join('\n')
      : 'No responses processed. The response scripts are not running:\ncheck that script-path is a real URL in every line and that no other module matches the same URLs.';
  }
  $done({ response: { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: out } });
}
