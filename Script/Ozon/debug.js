// Ozon Bank: carousel hider + built-in troubleshooting. d1
// Runs on the main-screen responses, applies the change, and records exactly what it saw and did.
// Pages (open in Safari):
//   https://finance.ozon.ru/__dump        what ran, and the carousel widget before/after
//   https://finance.ozon.ru/__dump/full   privacy-safe outline of the whole last response
//   https://finance.ozon.ru/__dump/raw    the last response as-is (contains personal data, don't share)
// Settings live in the module line:
//   argument=MARKETING_BANNER_SLIDER+mode:null|nodata|empty|blank|remove+order:null|empty|keep
const VERSION = 'd9';
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

// In the page HTML: empty the server-rendered body of the promo banner microfrontends.
// The page carries them as "MFPromoBanners...@promo": { data: { body: "<html...>" } },
// usually percent-encoded, with inner quotes escaped as \\".
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
      if (end > from) {
        changes.push(`page: rendered banner block emptied (${end - from} chars)`);
        text = text.slice(0, from) + text.slice(end);
      }
      pos = from;
    }
  }
  return text;
}

// In the page HTML: empty arrays of banners inside the embedded state (e.g. "banners":[...]),
// in both percent-encoded and plain form, brackets counted with escapes respected.
function emptyEncodedArrays(text, keys) {
  const forms = [
    { enc: true, quote: '%22', esc: '%5C', open: '%5B', close: '%5D', k: (n) => `%22${n}%22%3A%5B` },
    { enc: false, quote: '"', esc: '\\', open: '[', close: ']', k: (n) => `"${n}":[` },
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
        if (depth === 0 && i > from) {
          changes.push(`page: "${name}" list emptied (${i - from} chars)`);
          text = text.slice(0, from) + text.slice(i);
        }
        pos = from;
      }
    }
  }
  return text;
}

// Locate a phrase in the page and, when it sits in a promo-ish module, empty that module's body.
const PHRASES = ['Заказать бесплатно', 'Карта с выгодой'];
const SAFE_MF = /(promo|ca-traffic|banner|offer)/i;
let findReport = '';
function handlePhrases(text) {
  for (const phrase of PHRASES) {
    for (const needle of [encodeURIComponent(phrase), phrase]) {
      const at = text.indexOf(needle);
      if (at < 0) continue;
      const back = text.slice(Math.max(0, at - 30000), at);
      const ids = back.match(/MF[A-Za-z0-9]+(?:%40|@)[A-Za-z0-9-]+/g) || [];
      const id = ids.length ? ids[ids.length - 1] : '(no module id found)';
      findReport += `phrase: ${phrase}\nfound at: ${at}\nnearest module: ${id}\n\n`;
      if (SAFE_MF.test(id)) {
        const enc = id.indexOf('%40') > 0;
        const key = enc ? '%22body%22%3A%22' : '"body":"';
        const quote = enc ? '%22' : '"';
        const esc = enc ? '%5C' : '\\';
        const idAt = text.lastIndexOf(id, at);
        const start = text.indexOf(key, idAt);
        if (start > 0 && start < at) {
          const from = start + key.length;
          let i = from, end = -1;
          while (i < text.length) {
            const q = text.indexOf(quote, i);
            if (q < 0) break;
            let b = 0;
            while (q - (b + 1) * esc.length >= 0 && text.substr(q - (b + 1) * esc.length, esc.length) === esc) b++;
            if (b % 2 === 0) { end = q; break; }
            i = q + quote.length;
          }
          if (end > from) {
            changes.push(`page: ${id} body emptied (${end - from} chars)`);
            text = text.slice(0, from) + text.slice(end);
          }
        }
      }
      break;
    }
  }
  return text;
}

// For banner-list responses: empty any array whose items look like banners
const BANNER_KEYS = ['bannerId', 'placementSlug', 'image', 'imageDark', 'config', 'creativeId'];
function emptyBannerLists(node, path) {
  if (Array.isArray(node)) { node.forEach((v, i) => emptyBannerLists(v, `${path}[${i}]`)); return; }
  if (!node || typeof node !== 'object') return;
  for (const k of Object.keys(node)) {
    const v = node[k];
    emptyBannerLists(v, `${path}.${k}`); // innermost first
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object' && BANNER_KEYS.some((b) => b in x))) {
      changes.push(`${path}.${k}: ${v.length} banners cleared`);
      node[k] = [];
    }
  }
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
function save(s) {
  if ($persistentStore.write(JSON.stringify(s), KEY)) return;
  s.raw = '';
  if (!$persistentStore.write(JSON.stringify(s), KEY)) { s.fulls = (s.fulls || []).slice(-1); $persistentStore.write(JSON.stringify(s), KEY); }
}

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
  // Non-JSON responses (the main screen's HTML): look for banner traces, change nothing
  if (!data) {
    const isPage = /\/m\/lk\//.test(url);
    const newBody = isPage ? handlePhrases(emptyEncodedArrays(emptySsrBanners(body), ['banners', 'creatives'])) : body;
    const hits = (re) => (body.match(re) || []).length;
    const snips = [];
    const re = /ob-banner-manager/gi;
    let m;
    while ((m = re.exec(body)) && snips.length < 3) {
      snips.push(body.slice(Math.max(0, m.index - 150), m.index + 150).replace(/[0-9]{3,}/g, '#').replace(/[А-Яа-яЁё]+/g, '…'));
    }
    const s2 = load();
    s2.runs = (s2.runs || []).concat([{
      time: new Date().toISOString(), version: VERSION, url,
      settings: 'text response, not modified',
      json: `NOT JSON, ${body.length} chars`,
      cache: cacheInfo,
      widgets: `ob-banner-manager: ${hits(/ob-banner-manager/gi)} | MARKETING_BANNER_SLIDER: ${hits(/MARKETING_BANNER_SLIDER/g)} | bannersV2: ${hits(/bannersV2/g)} | creatives: ${hits(/creatives/g)}`,
      changes: changes.length ? changes.join('; ') : '(no server-rendered banner block found)',
      sent: (newBody === body ? 'original body' : `modified body (${body.length - newBody.length} chars removed)`) + ' sent, caching turned off',
      before: snips.length ? snips.join('\n---\n').slice(0, 900) : '(no banner links in this response)',
      after: '(unchanged)',
    }]).slice(-6);
    // keep a readable window around the first banner link for /__dump/html
    const dec = (t) => t.replace(/(?:%[0-9A-Fa-f]{2})+/g, (g) => { try { return decodeURIComponent(g); } catch (e) { return g; } });
    const at = body.search(/ob-banner-manager/i);
    if (at >= 0) {
      const win = body.slice(Math.max(0, at - 6000), at + 3000);
      s2.html = { url, when: new Date().toISOString(), hits: (body.match(/ob-banner-manager/gi) || []).length, text: dec(dec(win)).replace(/\\"/g, '"') };
    }
    const at2 = body.search(/bannersV2/);
    if (at2 >= 0) s2.html2 = { url, when: new Date().toISOString(), text: dec(dec(body.slice(Math.max(0, at2 - 3000), at2 + 6000))).replace(/\\\\"/g, '"') };
    if (findReport) {
      const p0 = body.indexOf(encodeURIComponent(PHRASES[0]));
      const p1 = p0 >= 0 ? p0 : body.indexOf(PHRASES[0]);
      s2.find = findReport + (p1 >= 0 ? '\n' + dec(dec(body.slice(Math.max(0, p1 - 4000), p1 + 2000))).replace(/\\\\"/g, '"') : '');
    }
    s2.raw = body.slice(0, 200000);
    save(s2);
    $done({ body: newBody, headers: head });
  } else {
    let before = '(no target widget in this response)', after = before;
    const isList = /banners\/list|\/banners$/.test(url);
    if (data && typeof data === 'object') {
      if (isList) {
        before = JSON.stringify(outline(data, 0), null, 1);
        emptyBannerLists(data, '$');
        after = JSON.stringify(outline(data, 0), null, 1);
      } else {
        const t = find(data, []);
        if (t.length) before = JSON.stringify(outline(t[0], 0), null, 1);
        walk(data);
        const t2 = find(data, []);
        after = t2.length ? JSON.stringify(outline(t2[0], 0), null, 1) : '(widget no longer present)';
      }
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
    if (data) {
      s.fulls = (s.fulls || []).filter((f) => f.url !== url).concat([{ url, when: new Date().toISOString(), text: JSON.stringify(outline(data, 0), null, 1) }]).slice(-3);
      s.raw = body;
    }
    save(s);
    $done({ body: data ? JSON.stringify(data) : body, headers: head });
  }
} else {
  const s = load();
  const url = $request.url;
  let out;
  if (/\/find/.test(url)) out = s.find || 'phrase not seen yet';
  else if (/\/html2/.test(url)) out = s.html2 ? `### ${s.html2.url} (${s.html2.when})\n\n${s.html2.text}` : 'no page captured yet';
  else if (/\/html/.test(url)) out = s.html ? `### ${s.html.url} (${s.html.when})  ob-banner-manager hits: ${s.html.hits}\n\n${s.html.text}` : 'no page captured yet';
  else if (/\/raw/.test(url)) out = s.raw || 'nothing captured';
  else if (/\/full/.test(url)) out = (s.fulls && s.fulls.length)
    ? s.fulls.map((f) => `### ${f.url}  (${f.when})\n${f.text}`).join('\n\n')
    : 'nothing captured';
  else {
    out = `script ${VERSION} loaded. This page opened at ${new Date().toISOString()}.\nIf the newest run below is older than your last app launch, the app did not fetch the main screen: it used its cached copy.\n\n`;
    out += (s.runs && s.runs.length)
      ? s.runs.map((r) => `=== ${r.time} [${r.version}]\nurl:      ${r.url}\nsettings: ${r.settings}\nbody:     ${r.json}\ncaching:  ${r.cache || '(not recorded)'}\nwidgets:  ${r.widgets}\nchanges:  ${r.changes}\nresult:   ${r.sent}\n\ncarousel widget BEFORE:\n${r.before}\n\ncarousel widget AFTER:\n${r.after}\n`).join('\n')
      : 'No responses processed. The response scripts are not running:\ncheck that script-path is a real URL in every line and that no other module matches the same URLs.';
  }
  $done({ response: { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: out } });
}
