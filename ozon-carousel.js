// Ozon Bank: hide main-screen ad widgets. v3
// Runs on the main-screen data (MFEMainMobile) and on refreshes (updateMainPage),
// and serves a self-check page at https://finance.ozon.ru/__status
//
// Everything is set in the module line, so this file never needs editing:
//   argument=MARKETING_BANNER_SLIDER            widget types to hide, joined with +
//   argument=...+mode:null|nodata|empty|blank|remove   how to hide them (default null)
//   argument=...+order:null|empty|keep          the "order card" button (default null)
const VERSION = 'v4';
const KEY = 'ozon_carousel_status';

const arg = typeof $argument !== 'undefined' ? String($argument) : '';
const tokens = arg.split('+').map((t) => t.trim()).filter(Boolean);
const pick = (name, def) => {
  const t = tokens.find((x) => x.toLowerCase().startsWith(name + ':'));
  return t ? t.split(':')[1].toLowerCase() : def;
};
const MODES = ['null', 'nodata', 'empty', 'blank', 'remove'];
const MODE = MODES.includes(pick('mode', 'null')) ? pick('mode', 'null') : 'null';
const MARK = /ob-banner-manager/i;
const ORDER = ['null', 'empty', 'keep'].includes(pick('order', 'null')) ? pick('order', 'null') : 'null';
const TYPES = tokens.filter((t) => /^[A-Z_]+$/.test(t));
if (!TYPES.length) TYPES.push('MARKETING_BANNER_SLIDER');
const ORDER_ACTIONS = ['ORDER_CARD'];

const changes = [];
const seen = [];
const isTarget = (w) => w && typeof w === 'object' && !Array.isArray(w) && TYPES.includes(w.type);

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
      if (MODE === 'nodata' && node.data && node.data.creativeData !== null) {
        node.data.creativeData = null; changes.push(`${node.type}: creativeData null`);
      }
      if (MODE === 'empty') {
        const c = node.data && node.data.creativeData;
        if (c && Array.isArray(c.creatives) && c.creatives.length) { changes.push(`${node.type}: ${c.creatives.length} banners cleared`); c.creatives = []; }
      }
      if (MODE === 'blank' && node.data) {
        const n = blankImages(node.data);
        if (n) changes.push(`${node.type}: ${n} image links blanked`);
      }
    }
    const ab = node.actionButton;
    if (ORDER !== 'keep' && ab && typeof ab === 'object' && Array.isArray(ab.actions) && ab.actions.some((a) => ORDER_ACTIONS.includes(a))) {
      if (ORDER === 'null') { node.actionButton = null; changes.push('order card button: null'); }
      else { ab.actions = ab.actions.filter((a) => !ORDER_ACTIONS.includes(a)); changes.push('order card button: action removed'); }
    }
    for (const k of Object.keys(node)) walk(node[k]);
  }
}

// blank every banner image link inside a widget, including links packed into JSON strings
function blankImages(node) {
  let n = 0;
  if (Array.isArray(node)) node.forEach((v, i) => { const r = blankOne(node, i); n += r; });
  else if (node && typeof node === 'object') for (const k of Object.keys(node)) n += blankOne(node, k);
  return n;
}
function blankOne(holder, key) {
  const v = holder[key];
  if (v && typeof v === 'object') return blankImages(v);
  if (typeof v !== 'string' || !MARK.test(v)) return 0;
  if (/^\s*[\[{]/.test(v)) {
    try { const d = JSON.parse(v); const n = blankImages(d); if (n) { holder[key] = JSON.stringify(d); return n; } } catch (e) {}
  }
  holder[key] = '';
  return 1;
}

function log(entry) {
  let list = [];
  try { list = JSON.parse($persistentStore.read(KEY) || '[]'); } catch (e) {}
  list.push(entry);
  $persistentStore.write(JSON.stringify(list.slice(-4)), KEY);
}

if (typeof $response !== 'undefined') {
  const body = $response.body || '';
  let data = null;
  try { data = JSON.parse(body); } catch (e) {}
  if (data && typeof data === 'object') walk(data);
  log({
    time: new Date().toISOString(),
    version: VERSION,
    url: $request.url.split('?')[0].replace('https://finance.ozon.ru', ''),
    settings: `mode ${MODE} | order ${ORDER} | types ${TYPES.join(', ')}`,
    json: data ? `yes, ${body.length} chars` : `NO - not JSON, ${body.length} chars`,
    widgets: [...new Set(seen)].join(', ') || '(none found)',
    changes: changes.length ? changes.join('; ') : '(nothing matched)',
  });
  $done(changes.length ? { body: JSON.stringify(data) } : {});
} else {
  let list = [];
  try { list = JSON.parse($persistentStore.read(KEY) || '[]'); } catch (e) {}
  let out = `script ${VERSION} is loaded and the status page works.\n\n`;
  out += list.length
    ? list.map((r) => `=== ${r.time}  [${r.version}]\nurl:      ${r.url}\nsettings: ${r.settings}\nbody:     ${r.json}\nwidgets:  ${r.widgets}\nchanges:  ${r.changes}\n`).join('\n')
    : 'No responses processed yet. Open Ozon Bank, then reload this page.\nIf this stays empty, the response script is not running.';
  $done({ response: { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: out } });
}
