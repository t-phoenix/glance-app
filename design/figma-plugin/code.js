// Recall brand screens (Glance + flat pastel Tidepool): moves the file to the new brand, then builds the brand board and all 19 screens on the "Brand screens · v2" page.
// Reuses the Recall color variables, text styles and components already in the file. Safe to re-run: it replaces its own output.

const B = { tide: '#8EE3D4', harbor: '#9CC3FF', glacier: '#A9DDF2', dusk: '#B7C0FF', sea: '#A6E9C1', amber: '#F5D98B', ink: '#0E1215', ink2: '#161B1F', ink3: '#1F262B', line: '#2C353B', paper: '#EEF3F2', mist: '#AEB8BE', fog: '#7E8A92', danger: '#F7A1A1' };
const TK = { ink: 'bg', ink2: 'surface1', ink3: 'surface2', paper: 'text', mist: 'text2', fog: 'text3', line: 'border', danger: 'danger', tide: 'brand/tide', harbor: 'brand/harbor', glacier: 'brand/glacier', dusk: 'brand/dusk', sea: 'brand/sea', amber: 'brand/amber' };
const OUT = ['Brand board', 'Entry and tabs', 'Capture', 'People', 'More', 'Recall · brand screens v2'];

let VV = {}, ST = {}, IC = {}, SET = {}, MARK = null, MARK_INK = null, page;

const hex = h => { h = (B[h] || h).replace('#', ''); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 }; };
function paint(k, op = 1) {
  const p = { type: 'SOLID', color: hex(k), opacity: op };
  return TK[k] && VV[TK[k]] ? figma.variables.setBoundVariableForPaint(p, 'color', VV[TK[k]]) : p;
}
// the brand is flat: no gradients, so a two-color pairing paints its first color only
const flat = (a, b, ao = 1) => paint(a, ao);
function rad(c, a = 0.5, tx = 0, ty = 0, s = 1) {
  return { type: 'GRADIENT_RADIAL', gradientTransform: [[s, 0, tx], [0, s, ty]], gradientStops: [{ position: 0, color: Object.assign(hex(c), { a }) }, { position: 1, color: Object.assign(hex(c), { a: 0 }) }] };
}
const shadow = (c = '#000000', a = 0.5, y = 20, r = 40) => ({ type: 'DROP_SHADOW', color: Object.assign(hex(c), { a }), offset: { x: 0, y }, radius: r, spread: 0, visible: true, blendMode: 'NORMAL' });

// ---------- layout helpers (always build top-down: append, size, then fill with children) ----------
function size(n, o) {
  const al = n.type === 'FRAME' && n.layoutMode !== 'NONE';
  if (typeof o.w === 'number' || typeof o.h === 'number') n.resize(typeof o.w === 'number' ? o.w : n.width, typeof o.h === 'number' ? o.h : n.height);
  const inAL = n.parent && n.parent.type !== 'PAGE' && n.parent.type !== 'SECTION' && n.parent.layoutMode && n.parent.layoutMode !== 'NONE';
  if (o.abs && inAL) n.layoutPositioning = 'ABSOLUTE';
  if (inAL && !o.abs) {
    if (o.w === 'fill') n.layoutSizingHorizontal = 'FILL'; else if (o.w === undefined && al) n.layoutSizingHorizontal = 'HUG';
    if (o.h === 'fill') n.layoutSizingVertical = 'FILL'; else if (o.h === undefined && al) n.layoutSizingVertical = 'HUG';
    if (o.grow) n.layoutGrow = 1;
  } else if (al) {
    if (o.w === undefined) n.primaryAxisSizingMode = n.layoutMode === 'HORIZONTAL' ? 'AUTO' : n.primaryAxisSizingMode;
    if (o.h === undefined) { if (n.layoutMode === 'VERTICAL') n.primaryAxisSizingMode = 'AUTO'; else n.counterAxisSizingMode = 'AUTO'; }
  }
  const at = o.abs || o.at; if (at) { n.x = at[0]; n.y = at[1]; }
}
function F(parent, dir, o = {}) {
  const f = figma.createAutoLayout(dir === 'H' ? 'HORIZONTAL' : dir === 'N' ? 'VERTICAL' : 'VERTICAL');
  if (dir === 'N') f.layoutMode = 'NONE';
  f.name = o.name || 'Group'; f.fills = []; f.clipsContent = !!o.clip;
  if (o.gap !== undefined) f.itemSpacing = o.gap;
  if (o.p !== undefined) { const [t, r, b, l] = Array.isArray(o.p) ? (o.p.length === 2 ? [o.p[0], o.p[1], o.p[0], o.p[1]] : o.p) : [o.p, o.p, o.p, o.p]; f.paddingTop = t; f.paddingRight = r; f.paddingBottom = b; f.paddingLeft = l; }
  if (o.fill) f.fills = Array.isArray(o.fill) ? o.fill : [typeof o.fill === 'string' ? paint(o.fill, o.op ?? 1) : o.fill];
  if (o.r !== undefined) f.cornerRadius = o.r;
  if (o.align && dir !== 'N') f.counterAxisAlignItems = o.align;
  if (o.justify && dir !== 'N') f.primaryAxisAlignItems = o.justify;
  if (o.stroke) { f.strokes = [paint(o.stroke[0], o.stroke[2] ?? 1)]; f.strokeWeight = o.stroke[1]; if (o.dash) f.dashPattern = o.dash; }
  if (o.wrap) { f.layoutWrap = 'WRAP'; f.counterAxisSpacing = o.gap ?? 8; }
  if (o.effects) f.effects = o.effects;
  if (o.opacity !== undefined) f.opacity = o.opacity;
  if (parent) { parent.appendChild(f); size(f, o); } else size(f, o);
  return f;
}
function TX(parent, chars, style, color = 'paper', o = {}) {
  const t = figma.createText();
  t.textStyleId = ST[style]; t.characters = chars; t.fills = [paint(color, o.op ?? 1)];
  if (o.size) t.fontSize = o.size;
  if (o.align) t.textAlignHorizontal = o.align;
  if (o.ls !== undefined) t.letterSpacing = { unit: 'PERCENT', value: o.ls };
  t.name = o.name || chars.slice(0, 32);
  if (parent) {
    parent.appendChild(t);
    if (o.w === 'fill') { t.layoutSizingHorizontal = 'FILL'; t.textAutoResize = 'HEIGHT'; }
    else if (typeof o.w === 'number') { t.resize(o.w, t.height); t.textAutoResize = 'HEIGHT'; }
    if (o.grow) { t.layoutGrow = 1; t.textAutoResize = 'HEIGHT'; }
    if (o.trunc) { t.textTruncation = 'ENDING'; t.maxLines = 1; }
    if (o.abs) { t.layoutPositioning = 'ABSOLUTE'; t.x = o.abs[0]; t.y = o.abs[1]; }
    if (o.at) { t.x = o.at[0]; t.y = o.at[1]; }
  }
  return t;
}
function R(parent, w, h, fill, o = {}) {
  const r = o.ellipse ? figma.createEllipse() : figma.createRectangle();
  r.resize(w, h); r.fills = fill ? [typeof fill === 'string' ? paint(fill, o.op ?? 1) : fill] : [];
  if (o.r !== undefined && !o.ellipse) r.cornerRadius = o.r;
  if (o.stroke) { r.strokes = [paint(o.stroke[0], o.stroke[2] ?? 1)]; r.strokeWeight = o.stroke[1]; }
  r.name = o.name || (o.ellipse ? 'Ellipse' : 'Rect');
  if (parent) { parent.appendChild(r); if (o.abs) { r.layoutPositioning = 'ABSOLUTE'; r.x = o.abs[0]; r.y = o.abs[1]; } if (o.at) { r.x = o.at[0]; r.y = o.at[1]; } if (o.rot) r.rotation = o.rot; }
  return r;
}
function svg(parent, s, o = {}) { const n = figma.createNodeFromSvg(s); n.name = o.name || 'Vector'; n.fills = []; if (parent) { parent.appendChild(n); if (o.at) { n.x = o.at[0]; n.y = o.at[1]; } if (o.abs) { n.layoutPositioning = 'ABSOLUTE'; n.x = o.abs[0]; n.y = o.abs[1]; } } return n; }

// ---------- component helpers ----------
const tint = (n, k) => n.findAll(x => x.type === 'VECTOR').forEach(v => { v.strokes = [paint(k)]; });
function icon(parent, name, s = 24, c = 'paper', o = {}) {
  const i = IC[name].createInstance(); i.resize(s, s); tint(i, c);
  if (parent) { parent.appendChild(i); if (o.abs) { i.layoutPositioning = 'ABSOLUTE'; i.x = o.abs[0]; i.y = o.abs[1]; } if (o.at) { i.x = o.at[0]; i.y = o.at[1]; } }
  return i;
}
const propKey = (set, name) => Object.keys(set.componentPropertyDefinitions).find(k => k.split('#')[0] === name);
function variant(set, name) { const v = set.children.find(c => c.name === name); if (!v) throw new Error(`${set.name} has no variant "${name}"`); return v.createInstance(); }
function button(parent, label, kind = 'Primary', sz = 'Large', ic, o = {}) {
  const b = variant(SET.Button, `Kind=${kind}, Size=${sz}`);
  const p = { [propKey(SET.Button, 'Label')]: label, [propKey(SET.Button, 'Show icon')]: !!ic };
  if (ic) p[propKey(SET.Button, 'Icon')] = IC[ic].id;
  b.setProperties(p);
  if (ic) { const i = b.findOne(n => n.type === 'INSTANCE'); if (i) tint(i, o.icon || (kind === 'Secondary' ? 'paper' : 'ink')); }
  parent.appendChild(b);
  if (o.w === 'fill') b.layoutSizingHorizontal = 'FILL'; else if (typeof o.w === 'number') { b.resize(o.w, b.height); }
  if (o.grow) b.layoutGrow = 1;
  return b;
}
function chip(parent, label, on = false, o = {}) {
  if (o.icon) { // instances can't take extra children, so an icon chip is drawn to the same spec
    const f = F(parent, 'H', { name: 'Chip · ' + label, h: 36, p: [0, 14], r: 18, gap: 6, align: 'CENTER', fill: o.fill === null ? undefined : (o.fill || (on ? 'paper' : 'ink3')) });
    icon(f, o.icon, 16, o.iconColor || o.text || 'paper'); TX(f, label, 'Button small', o.text || (on ? 'ink' : 'paper'), { size: 14 });
    return f;
  }
  const c = variant(SET.Chip, `State=${on ? 'On' : 'Off'}`);
  c.setProperties({ [propKey(SET.Chip, 'Label')]: label });
  if (o.fill !== undefined) c.fills = o.fill ? [paint(o.fill, o.op ?? 1)] : [];
  if (o.text) c.findOne(n => n.type === 'TEXT').fills = [paint(o.text)];
  if (o.stroke) { c.strokes = [paint(o.stroke, 0.45)]; c.strokeWeight = 1.5; }
  parent.appendChild(c);
  return c;
}
function personRow(parent, p, state, trailing) {
  const r = variant(SET.PersonRow, `State=${state}`);
  const props = { [propKey(SET.PersonRow, 'Name')]: p.n, [propKey(SET.PersonRow, 'Role')]: p.r, [propKey(SET.PersonRow, 'Initials')]: ini(p.n) };
  if (state === 'Due') props[propKey(SET.PersonRow, 'Trailing')] = trailing || `${p.f} due`;
  r.setProperties(props);
  const av = r.findOne(n => n.name === 'Avatar'); if (av) av.fills = [flat(p.g[0], p.g[1])];
  parent.appendChild(r); r.layoutSizingHorizontal = 'FILL';
  return r;
}
const rowFor = p => p.f ? 'Due' : p.ok ? 'Confirmed' : 'Needs account';
function tabBar(scr, active) { const t = variant(SET.TabBar, `Active=${active}`); scr.appendChild(t); t.layoutSizingHorizontal = 'FILL'; return t; }

// ---------- brand atoms ----------
const ppl = [
  { n: 'Priya Raman', r: 'Founder, Proofkit', g: ['glacier', 'dusk'], ok: true, f: 2 },
  { n: 'Karan Mehta', r: 'Partner, Monsoon Capital', g: ['amber', 'tide'], ok: true, f: 1 },
  { n: 'Ananya Iyer', r: 'Design lead, Juspay', g: ['sea', 'harbor'], ok: false, f: 0 },
  { n: 'Dev Malhotra', r: 'Protocol eng, Polygon', g: ['dusk', 'harbor'], ok: true, f: 0 },
  { n: 'Sana Qureshi', r: 'Product, Razorpay', g: ['tide', 'glacier'], ok: false, f: 1 },
  { n: 'Arjun Nair', r: 'Angel investor', g: ['amber', 'sea'], ok: true, f: 0 },
];
const ini = n => n.split(' ').map(w => w[0]).join('');
function avatar(parent, p, s = 48, o = {}) {
  const a = F(parent, 'H', { name: 'Avatar', w: s, h: s, r: s / 2, justify: 'CENTER', align: 'CENTER', fill: flat(p.g[0], p.g[1]), at: o.at });
  if (o.ring !== false) { a.strokes = [paint(p.ok ? 'sea' : 'line')]; a.strokeWeight = s > 60 ? 3 : 2.5; a.strokeAlign = 'OUTSIDE'; }
  TX(a, ini(p.n), 'Headline', 'ink', { size: Math.round(s * 0.36) });
  return a;
}
const PLAT = { X: ['paper', 'X'], in: ['harbor', 'in'], gh: ['mist', 'gh'], wa: ['sea', 'wa'], web: ['amber', 'W'], fc: ['dusk', 'fc'] };
function plat(parent, k, s = 34) { const f = F(parent, 'H', { name: 'Platform/' + k, w: s, h: s, r: Math.round(s * 0.3), fill: PLAT[k][0], justify: 'CENTER', align: 'CENTER' }); TX(f, PLAT[k][1], 'Headline', 'ink', { size: Math.round(s * 0.42) }); return f; }
function pill(parent, text, color, o = {}) { const f = F(parent, 'H', { name: 'Pill', h: 24, p: [0, 9], r: 12, align: 'CENTER', gap: 4, fill: o.bg ? paint(o.bg) : paint(color, 0.15) }); if (o.icon) icon(f, o.icon, 12, color); if (text) TX(f, text, 'Caption', color, { size: 12 }); return f; }
const label = (parent, text, color = 'fog') => TX(parent, text.toUpperCase(), 'Caption', color, { ls: 8 });
function card(parent, o = {}) { return F(parent, o.dir || 'V', Object.assign({ name: 'Card', gap: 10, p: 16, r: 22, fill: 'ink2', w: 'fill', align: o.dir === 'H' ? 'CENTER' : undefined }, o)); }
function field(parent, text, o = {}) {
  const f = F(parent, 'H', { name: 'Field', w: 'fill', p: [15, 16], r: 16, gap: 10, align: o.multi ? 'MIN' : 'CENTER', fill: 'ink2', stroke: o.stroke });
  if (o.icon) icon(f, o.icon, 20, 'fog');
  TX(f, text, 'Body', o.value ? 'paper' : 'fog', { grow: true });
  if (o.trail) o.trail(f);
  return f;
}
function list(parent, o = {}) { return F(parent, 'V', { name: 'List', w: 'fill', p: [0, 16], r: 22, fill: o.fill || 'ink2' }); }
function li(lst, o) {
  const r = F(lst, 'H', { name: 'Item', w: 'fill', h: 60, gap: 14, align: 'CENTER' });
  r.strokes = [paint('paper', 0.06)]; r.strokeTopWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0; r.strokeBottomWeight = o.last ? 0 : 1;
  if (o.lead) o.lead(r);
  if (o.tile) { const t = F(r, 'H', { name: 'Tile', w: 34, h: 34, r: 10, justify: 'CENTER', align: 'CENTER', fill: o.tile[1] }); if (o.tile[0]) icon(t, o.tile[0], 18, o.tile[2]); else if (o.tileFill) o.tileFill(t); }
  const col = F(r, 'V', { name: 'Text', gap: 1, grow: true });
  TX(col, o.title, 'Body', 'paper', { w: 'fill', trunc: true });
  if (o.sub) TX(col, o.sub, o.mono ? 'Mono' : 'Footnote', 'fog', { w: 'fill', trunc: true });
  if (o.trail) o.trail(r);
  return r;
}
function sw(parent, on = true) { const s = F(parent, 'N', { name: on ? 'Switch on' : 'Switch off', w: 51, h: 31, r: 16, fill: on ? 'sea' : 'ink3' }); R(s, 27, 27, '#FFFFFF', { ellipse: true, at: [on ? 22 : 2, 2] }); return s; }
function seg(parent, items, on = 0) { const s = F(parent, 'H', { name: 'Segmented', w: 'fill', p: 4, gap: 4, r: 14, fill: 'ink2' }); items.forEach((t, i) => { const c = F(s, 'H', { name: 'Segment', h: 36, r: 10, grow: true, justify: 'CENTER', align: 'CENTER', fill: i === on ? 'ink3' : undefined }); TX(c, t, 'Button small', i === on ? 'paper' : 'mist', { size: 14 }); }); return s; }
function wave(parent, n, played, color, maxH = 34, w = 4) { const f = F(parent, 'H', { name: 'Waveform', gap: w === 4 ? 4 : 3, align: 'CENTER', h: maxH + 10 }); for (let i = 0; i < n; i++) R(f, w, Math.round(8 + Math.abs(Math.sin(i * 1.7)) * maxH), i < played ? color : 'line', { r: 2 }); return f; }
function bar(parent, pct, color, w = 250) { const t = F(parent, 'N', { name: 'Bar', w, h: 6, r: 3, fill: 'ink3', clip: true }); R(t, Math.max(6, Math.round(w * pct)), 6, color, { r: 3, at: [0, 0] }); return t; }
function iconTile(parent, name, s, bg, fg, r = 14) { const t = F(parent, 'H', { name: 'Icon tile', w: s, h: s, r, justify: 'CENTER', align: 'CENTER', fill: bg }); icon(t, name, Math.round(s * 0.5), fg); return t; }
function photo(parent, w, h, a, b, shape) {
  const p = F(parent, 'N', { name: 'Photo', w, h, r: 14, fill: flat(a, b), clip: true });
  if (shape === 'head') { R(p, w * 0.5, w * 0.5, 'ink', { ellipse: true, op: 0.4, at: [w * 0.25, h * 0.3] }); R(p, w * 0.8, h * 0.5, 'ink', { op: 0.4, r: w * 0.4, at: [w * 0.1, h * 0.72] }); }
  if (shape === 'board') R(p, w * 0.6, h * 0.42, 'paper', { op: 0.35, r: 8, at: [w * 0.2, h * 0.28] });
  return p;
}
function qrSvg(px) {
  let s = ''; const n = 21; let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    if (finder) { const lx = x > 13 ? x - 14 : x, ly = y > 13 ? y - 14 : y; if (lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx > 1 && lx < 5 && ly > 1 && ly < 5)) s += `<rect x="${x}" y="${y}" width="1" height="1" rx=".3"/>`; }
    else if (x >= 8 && x <= 12 && y >= 8 && y <= 12) continue;
    else if (rnd() > 0.52) s += `<rect x="${x}" y="${y}" width="1" height="1" rx=".3"/>`;
  }
  return `<svg width="${px}" height="${px}" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg"><g fill="${B.ink}">${s}</g><circle cx="10.5" cy="10.5" r="1.7" fill="${B.tide}"/></svg>`;
}

// ---------- screen chrome ----------
function screen(name, free = false, bg) {
  const f = figma.createFrame(); f.name = name; f.resize(390, 844); f.clipsContent = true;
  f.fills = bg || [paint('ink')];
  if (!free) { f.layoutMode = 'VERTICAL'; f.primaryAxisSizingMode = 'FIXED'; f.counterAxisSizingMode = 'FIXED'; f.itemSpacing = 0; }
  return f;
}
function statusBar(parent, o = {}) {
  const s = F(parent, 'H', Object.assign({ name: 'Status bar', w: o.at ? 390 : 'fill', h: 54, p: [18, 32, 0, 40], justify: 'SPACE_BETWEEN', align: 'CENTER' }, o));
  TX(s, '9:41', 'Headline', 'paper');
  svg(s, `<svg width="70" height="13" viewBox="0 0 70 13" xmlns="http://www.w3.org/2000/svg" fill="${B.paper}"><rect x="0" y="8" width="3" height="5" rx="1"/><rect x="5" y="5.5" width="3" height="7.5" rx="1"/><rect x="10" y="3" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="13" rx="1"/><path d="M33 3.2a9 9 0 0 1 12 0l-1.6 1.7a6.6 6.6 0 0 0-8.8 0zM36.2 6.6a4.6 4.6 0 0 1 5.6 0L39 9.6z"/><rect x="50.5" y=".5" width="17" height="12" rx="3.5" fill="none" stroke="${B.paper}" stroke-opacity=".5"/><rect x="52.5" y="2.5" width="13" height="8" rx="2"/></svg>`, { name: 'Indicators' });
  return s;
}
function body(scr, o = {}) { return F(scr, 'V', Object.assign({ name: 'Body', w: 'fill', grow: true, gap: 14, p: [6, 20, 16, 20], clip: true }, o)); }
function nav(parent, title = '', right = '') {
  const n = F(parent, 'H', { name: 'Nav', w: 'fill', h: 44, justify: 'SPACE_BETWEEN', align: 'CENTER' });
  const b = F(n, 'H', { name: 'Back', gap: 2, align: 'CENTER', w: 80 }); icon(b, 'back', 22, 'harbor'); TX(b, 'Back', 'Body', 'harbor');
  if (title) TX(n, title, 'Headline', 'paper', { align: 'CENTER' });
  const r = F(n, 'H', { name: 'Right', w: 80, justify: 'MAX', align: 'CENTER' }); if (right) TX(r, right, 'Body', 'harbor');
  return n;
}
function actionBar(scr) { return F(scr, 'H', { name: 'ActionBar', w: 'fill', gap: 10, p: [12, 20, 34, 20], fill: 'ink' }); }
function sheetOverlay(scr, top) {
  R(scr, 390, 844, '#05070B', { op: 0.72, abs: [0, 0], name: 'Scrim' });
  const sh = F(scr, 'V', { name: 'Sheet', w: 390, gap: 14, p: [10, 20, 34, 20], fill: 'ink2', abs: [0, top || 300], effects: [shadow('#000000', 0.6, -20, 60)] });
  sh.topLeftRadius = 34; sh.topRightRadius = 34;
  const gr = F(sh, 'H', { name: 'Grabber row', w: 'fill', justify: 'CENTER' }); F(gr, 'H', { name: 'Grabber', w: 40, h: 5, r: 3, fill: 'line' });
  return sh;
}
function pinSheet(sh) { sh.y = 844 - sh.height; }
function hdr(parent) { return F(parent, 'H', { name: 'Header', w: 'fill', justify: 'SPACE_BETWEEN', align: 'MAX', gap: 10 }); }

// ---------- screens ----------
const SCREENS = [
// ===== Entry and tabs
{ row: 'Entry and tabs', name: 'Launch', note: 'Replaces the bare Unlock screen. Glance turns in 3D, its eyes look up and blink, and Face ID runs on its own behind the animation. A button appears only if Face ID fails.', build() {
  const s = screen('Launch', true, [paint('ink')]);
  statusBar(s, { at: [0, 0] });
  const cx = 195, cy = 340;
  [[320, 110, -18, 'sea', 0.35], [270, 96, 32, 'tide', 0.55], [220, 220, 0, 'dusk', 0.4]].forEach(([w, h, rot, c, op], i) => {
    const e = R(s, w, h, null, { ellipse: true, stroke: [c, 2, op], name: 'Orbit ' + (i + 1) });
    e.x = cx - w / 2; e.y = cy - h / 2; if (rot) { e.rotation = rot; const rr = rot * Math.PI / 180; e.x = cx - (w / 2 * Math.cos(rr) + h / 2 * Math.sin(rr)); e.y = cy - (-w / 2 * Math.sin(rr) + h / 2 * Math.cos(rr)); }
  });
  [[62, 300, 'tide', 12], [318, 372, 'sea', 10], [168, 232, 'dusk', 12], [290, 260, 'amber', 8], [110, 420, 'glacier', 9]].forEach(([x, y, c, d]) => { const o = R(s, d, d, c, { ellipse: true, at: [x, y], name: 'Person' }); o.effects = [shadow(B[c], 0.8, 0, 14)]; });
  const m = MARK.createInstance(); m.resize(130, 130); s.appendChild(m); m.x = cx - 65; m.y = cy - 65; m.effects = [shadow('#8EE3D4', 0.45, 0, 40)];
  const wm = TX(s, 'recall.', 'Display', 'paper', { size: 68, align: 'CENTER' }); wm.x = (390 - wm.width) / 2; wm.y = 520;
  const tl = TX(s, 'Every hello, remembered.', 'Body', 'mist', { align: 'CENTER' }); tl.x = (390 - tl.width) / 2; tl.y = 604;
  const fid = F(s, 'V', { name: 'Face ID', gap: 8, align: 'CENTER', at: [0, 740], w: 390 }); icon(fid, 'face', 30, 'fog', {}); TX(fid, 'Unlocking with Face ID', 'Footnote', 'fog');
  fid.counterAxisAlignItems = 'CENTER';
  return s;
}},
{ row: 'Entry and tabs', name: 'Today', note: 'The event card leads, with a Change link instead of a row of chips. A stats strip uses the role colors. Each row shows its state: sea-glass ring confirmed, grey ring still needs an account, amber chip for follow-ups.', build() {
  const s = screen('Today'); statusBar(s); const b = body(s);
  const h = hdr(b); const tc = F(h, 'V', { name: 'Title', gap: 2 }); TX(tc, 'Tuesday, 27 October', 'Footnote', 'mist'); TX(tc, 'Today', 'Large title');
  const g = F(h, 'H', { name: 'Settings (44)', w: 44, h: 44, r: 22, fill: 'ink2', justify: 'CENTER', align: 'CENTER' }); icon(g, 'gear', 22, 'mist');
  const ev = card(b, { fill: flat('tide', 'amber', 0.16, 0.08), stroke: ['tide', 1, 0.35] });
  const er = F(ev, 'H', { name: 'Row', w: 'fill', justify: 'SPACE_BETWEEN', align: 'CENTER' }); label(er, 'Now at', 'amber'); TX(er, 'Change', 'Headline', 'harbor');
  TX(ev, 'Founders Day · Bengaluru', 'Title 2', 'paper', { w: 'fill' });
  const tg = F(ev, 'H', { name: 'Tags', gap: 6 }); pill(tg, '#investor', 'glacier'); pill(tg, '#zk', 'dusk'); pill(tg, '#hiring', 'harbor');
  const st = F(b, 'H', { name: 'Stats', w: 'fill', gap: 8 });
  [['12', 'people met', 'glacier'], ['4', 'loops open', 'amber'], ['3', 'voice notes', 'tide']].forEach(([n, l, c]) => { const k = F(st, 'V', { name: 'Stat', grow: true, p: 12, r: 18, fill: 'ink2', gap: 0 }); TX(k, n, 'Title', c, { size: 30 }); TX(k, l, 'Footnote', 'mist', { size: 13 }); });
  label(b, 'Met today');
  const l = F(b, 'V', { name: 'People', w: 'fill' }); ppl.slice(0, 4).forEach(p => personRow(l, p, rowFor(p)));
  tabBar(s, 'Today'); return s;
}},
{ row: 'Entry and tabs', name: 'People', note: 'Search sits right under the title. Filter chips are 36pt high. Letter headers and state chips make a long list quick to scan.', build() {
  const s = screen('People'); statusBar(s); const b = body(s);
  const h = hdr(b); TX(h, 'People', 'Large title'); TX(h, '148 total', 'Mono', 'fog');
  field(b, 'Search names, companies, notes', { icon: 'search' });
  const c = F(b, 'H', { name: 'Filters', w: 'fill', gap: 8, clip: true }); chip(c, 'All', true); chip(c, 'Confirmed', false, { icon: 'check', iconColor: 'sea' }); chip(c, 'Needs account'); chip(c, '#investor', false, { text: 'glacier' });
  label(b, 'A'); let l = F(b, 'V', { name: 'Group A', w: 'fill' }); [ppl[2], ppl[5]].forEach(p => personRow(l, p, rowFor(p)));
  label(b, 'D – K'); l = F(b, 'V', { name: 'Group D–K', w: 'fill' }); [ppl[3], ppl[1]].forEach(p => personRow(l, p, rowFor(p)));
  tabBar(s, 'People'); return s;
}},
{ row: 'Entry and tabs', name: 'Follow-ups', note: 'Done is on every card, so you can close a loop you handled outside the app. Overdue shows a count, and the tab carries a badge.', build() {
  const s = screen('Follow-ups'); statusBar(s); const b = body(s);
  TX(b, 'Follow-ups', 'Large title');
  const c = F(b, 'H', { name: 'Filters', w: 'fill', gap: 8 }); chip(c, 'Overdue · 2', true, { fill: 'amber', text: 'ink' }); chip(c, 'Today · 2'); chip(c, 'Later · 5');
  [[ppl[1], 'Send the deck and the climate hardware memo.', 'Due yesterday'], [ppl[0], 'Intro her to Dev for the proving benchmark.', 'Due 2 days ago']].forEach(([p, t, w]) => {
    const k = card(b, { stroke: ['amber', 1, 0.35], gap: 12 });
    const top = F(k, 'H', { name: 'Who', w: 'fill', gap: 12, align: 'CENTER' }); avatar(top, p, 40); const col = F(top, 'V', { name: 'Text', grow: true }); TX(col, p.n, 'Headline', 'paper', { w: 'fill' }); TX(col, w, 'Footnote', 'amber', { w: 'fill' });
    TX(k, t, 'Body', 'paper', { w: 'fill' });
    const a = F(k, 'H', { name: 'Actions', w: 'fill', gap: 8 }); button(a, 'Open', 'Secondary', 'Small', null, { grow: true }); button(a, 'Done', 'Done', 'Small', 'check', { grow: true });
  });
  TX(b, 'Swipe a card left to snooze it a day', 'Footnote', 'fog', { w: 'fill', align: 'CENTER' });
  tabBar(s, 'Follow-ups'); return s;
}},
{ row: 'Entry and tabs', name: 'Me', note: 'Your QR code comes first, on a flat Tide frame. Swipe between links. Links opens its own sheet. Wallet, Recap, Keys and Settings sit in one list.', build() {
  const s = screen('Me'); statusBar(s); const b = body(s);
  const h = hdr(b); h.counterAxisAlignItems = 'CENTER'; TX(h, 'Me', 'Large title'); chip(h, 'Links', false, { icon: 'link', iconColor: 'harbor' });
  const fr = F(b, 'V', { name: 'QR frame', w: 'fill', p: 3, r: 30, fill: flat('tide', 'harbor'), effects: [shadow('#8EE3D4', 0.25, 16, 40)] });
  const qc = F(fr, 'V', { name: 'QR card', w: 'fill', p: 22, r: 27, fill: 'paper', gap: 10, align: 'CENTER' });
  svg(qc, qrSvg(200), { name: 'QR code' });
  TX(qc, 'Abhinil Agarwal', 'Title 2', 'ink');
  const lk = F(qc, 'H', { name: 'Link', gap: 8, align: 'CENTER' }); plat(lk, 'in', 22); TX(lk, 'linkedin.com/in/abhinil', 'Footnote', 'ink', { op: 0.65 });
  const dots = F(b, 'H', { name: 'Pager', w: 'fill', gap: 6, justify: 'CENTER' }); R(dots, 22, 6, 'paper', { r: 3 }); for (let i = 0; i < 3; i++) R(dots, 6, 6, 'line', { r: 3 });
  const l = list(b);
  li(l, { tile: ['wallet', paint('sea', 0.15), 'sea'], title: 'Wallet', sub: '12.40 USDC · Base', mono: true, trail: r => icon(r, 'chev', 18, 'fog') });
  li(l, { tile: ['clock', paint('amber', 0.15), 'amber'], title: 'Recap', sub: '3 people need keep or drop', trail: r => icon(r, 'chev', 18, 'fog') });
  li(l, { tile: ['key', paint('dusk', 0.15), 'dusk'], title: 'Keys and settings', last: true, trail: r => icon(r, 'chev', 18, 'fog') });
  tabBar(s, 'Me'); return s;
}},
// ===== Capture
{ row: 'Capture', name: 'Scanner', note: 'The camera dims everywhere except the frame, so you know where to aim. Rush mode keeps a live count with an End button. Hold the shutter to start Rush.', build() {
  const s = screen('Scanner', true, [paint('#0E1518'), rad('#1F4A55', 0.9, -0.25, -0.2, 1), rad('#1E3A66', 0.8, 0.3, 0.25, 1)]);
  const dim = R(s, 390, 844, '#05070B', { at: [0, 0] }); const hole = R(s, 240, 240, '#000000', { r: 30, at: [75, 234] });
  const cut = figma.subtract([dim, hole], s); cut.name = 'Dim outside reticle'; cut.fills = [paint('#05070B', 0.72)];
  statusBar(s, { at: [0, 0] });
  const corners = [['M3 54V24A21 21 0 0 1 24 3h30', 75, 234], ['M0 3h30a21 21 0 0 1 21 21v30', 261, 234], ['M3 0v30a21 21 0 0 0 21 21h30', 75, 420], ['M51 0v30a21 21 0 0 1-21 21H0', 261, 420]];
  corners.forEach(([d, x, y]) => svg(s, `<svg width="54" height="54" viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="none" stroke="${B.tide}" stroke-width="5" stroke-linecap="round"/></svg>`, { at: [x, y], name: 'Corner' }));
  R(s, 208, 2, 'amber', { at: [91, 352], name: 'Scan line' });
  const close = F(s, 'H', { name: 'Close (44)', w: 44, h: 44, r: 22, fill: 'ink', op: 0.7, justify: 'CENTER', align: 'CENTER', at: [20, 66] }); icon(close, 'x', 22, 'paper');
  const rush = F(s, 'H', { name: 'Rush counter', gap: 10, align: 'CENTER', p: [5, 5, 5, 14], r: 24, fill: 'ink', op: 0.85, at: [0, 66] });
  R(rush, 8, 8, 'tide', { ellipse: true }).effects = [shadow('#8EE3D4', 0.9, 0, 8)]; TX(rush, 'Rush · 3 scanned', 'Headline'); button(rush, 'End', 'Light', 'Small');
  rush.x = 370 - rush.width;
  const hint = TX(s, 'Point at a QR code or a name badge', 'Body', 'paper', { align: 'CENTER' }); hint.x = (390 - hint.width) / 2; hint.y = 500;
  const st = F(s, 'N', { name: 'Rush stack', w: 56, h: 56, r: 16, fill: flat('dusk', 'glacier'), at: [28, 744] }); st.clipsContent = false;
  const bd = F(st, 'H', { name: 'Count', h: 22, p: [0, 7], r: 11, fill: 'paper', align: 'CENTER', at: [40, -8] }); TX(bd, '3', 'Caption', 'ink');
  const sh = F(s, 'N', { name: 'Shutter (84)', w: 84, h: 84, at: [153, 730] }); R(sh, 84, 84, null, { ellipse: true, stroke: ['paper', 5], at: [0, 0] }); R(sh, 64, 64, flat('tide', 'harbor'), { ellipse: true, at: [10, 10] });
  const fl = F(s, 'H', { name: 'Flash (56)', w: 56, h: 56, r: 28, fill: 'ink', op: 0.7, justify: 'CENTER', align: 'CENTER', at: [306, 744] }); icon(fl, 'bolt', 24, 'amber');
  const hold = TX(s, 'Hold the shutter for Rush', 'Footnote', 'mist'); hold.x = (390 - hold.width) / 2; hold.y = 822 - 8;
  return s;
}},
{ row: 'Capture', name: 'Capture', note: 'Record comes first: an 88pt button where your thumb rests, with listening rings. Typing is one tap above it. Photo and Save sit in the bottom bar, with Save on the right.', build() {
  const s = screen('Capture'); statusBar(s); const b = body(s); nav(b, 'New note');
  const pc = card(b, { dir: 'H', gap: 12 }); avatar(pc, ppl[0], 52);
  const col = F(pc, 'V', { name: 'Text', grow: true, gap: 4 }); TX(col, 'Priya Raman', 'Headline', 'paper', { w: 'fill' });
  const hr = F(col, 'H', { name: 'Handle', gap: 6, align: 'CENTER' }); plat(hr, 'X', 18); TX(hr, '@priyaraman · confirmed', 'Mono', 'mist');
  const c = F(b, 'V', { name: 'Recorder', w: 'fill', grow: true, gap: 20, align: 'CENTER', justify: 'CENTER' });
  TX(c, '0:42', 'Mono', 'paper', { size: 46 });
  wave(c, 28, 20, 'tide');
  const rec = F(c, 'N', { name: 'Record (88)', w: 150, h: 150 });
  R(rec, 150, 150, null, { ellipse: true, stroke: ['tide', 2, 0.2], at: [0, 0] }); R(rec, 118, 118, null, { ellipse: true, stroke: ['tide', 2, 0.45], at: [16, 16] });
  const btn = F(rec, 'H', { name: 'Stop', w: 88, h: 88, r: 44, fill: flat('tide', 'harbor'), justify: 'CENTER', align: 'CENTER', at: [31, 31], effects: [shadow('#8EE3D4', 0.45, 10, 30)] }); R(btn, 30, 30, 'ink', { r: 8 });
  TX(c, 'Listening · tap to stop', 'Footnote', 'mist');
  TX(c, 'Type a note instead', 'Headline', 'harbor');
  const ab = actionBar(s); button(ab, 'Photo', 'Secondary', 'Large', 'cam', { w: 130 }); button(ab, 'Save note', 'Primary', 'Large', 'check', { grow: true });
  return s;
}},
{ row: 'Capture', name: 'Use AI?', note: 'Kept from the current app because it works: say what the AI will do and what it costs, then ask. Restyled in Dusk, the AI color.', build() {
  const s = screen('Use AI?'); statusBar(s); const b = body(s, { opacity: 0.35 }); nav(b, 'New note'); TX(b, '0:42', 'Mono', 'paper', { size: 46 });
  const sh = sheetOverlay(s);
  const t = F(sh, 'H', { name: 'AI tile', w: 64, h: 64, r: 20, fill: flat('dusk', 'glacier'), justify: 'CENTER', align: 'CENTER' }); icon(t, 'spark', 32, 'ink');
  TX(sh, 'Structure this note with AI?', 'Title 2', 'paper', { w: 'fill', size: 26 });
  TX(sh, 'Claude reads the 42-second transcript and fills in name, company, role and a follow-up draft. The audio stays on your phone.', 'Body', 'mist', { w: 'fill' });
  const l = list(sh, { fill: 'ink3' });
  li(l, { title: 'Cost', trail: r => TX(r, '≈ 0.004 USDC', 'Mono', 'paper') });
  li(l, { title: 'Spent today', last: true, trail: r => TX(r, '0.31 of 2.00', 'Mono', 'paper') });
  const a = F(sh, 'H', { name: 'Actions', w: 'fill', gap: 10 }); button(a, 'Not now', 'Secondary', 'Large', null, { grow: true }); button(a, 'Structure', 'AI', 'Large', 'spark', { grow: true });
  pinSheet(sh); return s;
}},
{ row: 'Capture', name: 'Review', note: 'Dusk marks everything the AI wrote. Each field shows how sure it is, and you edit before anything is saved.', build() {
  const s = screen('Review'); statusBar(s); const b = body(s, { gap: 12 }); nav(b, 'Review');
  const ai = card(b, { dir: 'H', gap: 12, fill: flat('dusk', 'glacier', 0.18, 0.1), stroke: ['dusk', 1, 0.4] }); icon(ai, 'spark', 26, 'dusk');
  const col = F(ai, 'V', { name: 'Text', grow: true }); TX(col, 'Structured from a 42s voice note', 'Headline', 'paper', { w: 'fill' }); TX(col, "Edit anything before it's saved.", 'Footnote', 'mist', { w: 'fill' });
  [['Name', 'Priya Raman', 'sure', 'sea'], ['Company', 'Proofkit', 'sure', 'sea'], ['Role', 'Founder', 'likely', 'amber'], ['What they do', 'Building faster zk proving for mobile wallets.', 'sure', 'sea']].forEach(([l, v, c, k]) => {
    const g = F(b, 'V', { name: l, w: 'fill', gap: 6 }); const r = F(g, 'H', { name: 'Label row', w: 'fill', justify: 'SPACE_BETWEEN', align: 'CENTER' }); label(r, l); pill(r, c, k); field(g, v, { value: true });
  });
  const d = F(b, 'V', { name: 'Draft', w: 'fill', gap: 6 }); label(d, 'Draft follow-up', 'dusk');
  field(d, "Hi Priya, great meeting you at Founders Day. Sharing Dev's benchmark repo as promised…", { value: true, multi: true, stroke: ['dusk', 1, 0.35] });
  const ab = actionBar(s); button(ab, 'Redo', 'Secondary', 'Large', 'spark', { w: 130, icon: 'dusk' }); button(ab, 'Save', 'Primary', 'Large', 'check', { grow: true });
  return s;
}},
{ row: 'Capture', name: 'Huddle', note: 'For a group chat at a table. Write one note and the AI splits it into a card per person. Keep or drop each one.', build() {
  const s = screen('Huddle'); statusBar(s); const b = body(s); nav(b, 'Huddle');
  const h = hdr(b); h.counterAxisAlignItems = 'CENTER'; const tc = F(h, 'V', { name: 'Title', gap: 2, grow: true }); TX(tc, "Say who's who", 'Title', 'paper', { w: 'fill' }); TX(tc, '3 people mentioned in one note', 'Footnote', 'mist', { w: 'fill' });
  iconTile(h, 'users', 48, paint('glacier', 0.15), 'glacier');
  field(b, 'Priya is building proofs. Karan runs a fund. Sana leads payments product and wants beta testers.', { value: true, multi: true });
  [[ppl[0], 'Building proofs', 1], [ppl[1], 'Runs a fund', 1], [ppl[4], 'Payments product, wants beta testers', 0]].forEach(([p, t, keep]) => {
    const k = card(b, { dir: 'H', gap: 10, opacity: keep ? 1 : 0.5 }); avatar(k, p, 42);
    const col = F(k, 'V', { name: 'Text', grow: true }); TX(col, p.n, 'Headline', 'paper', { w: 'fill', trunc: true }); TX(col, t, 'Footnote', 'mist', { w: 'fill', trunc: true });
    button(k, 'Drop', 'Secondary', 'Small'); button(k, 'Keep', 'Done', 'Small');
  });
  const ab = actionBar(s); button(ab, 'Split again', 'AI', 'Large', 'spark', { grow: true }); button(ab, 'Save 2', 'Primary', 'Large', 'check', { grow: true });
  return s;
}},
// ===== People
{ row: 'People', name: 'Person', note: "A pastel hero in the person's color, accounts as tappable marks, and one row of actions. Notes, Photos and Accounts are tabs instead of one long scroll.", build() {
  const s = screen('Person');
  const hero = F(s, 'V', { name: 'Hero', w: 'fill', h: 268, justify: 'SPACE_BETWEEN', fill: [paint('ink2'), paint('glacier', 0.16)] });
  statusBar(hero); const hp = F(hero, 'V', { name: 'Hero content', w: 'fill', grow: true, p: [0, 20, 18, 20], justify: 'SPACE_BETWEEN' }); nav(hp, '', 'Edit');
  const id = F(hp, 'H', { name: 'Identity', w: 'fill', gap: 14, align: 'MAX' }); avatar(id, ppl[0], 84);
  const col = F(id, 'V', { name: 'Name', grow: true, gap: 2 }); TX(col, 'Priya Raman', 'Title', 'paper', { w: 'fill' }); TX(col, 'Founder, Proofkit · met 6:42 pm', 'Footnote', 'mist', { w: 'fill' });
  const b = body(s, { p: [14, 20, 16, 20] });
  const acc = F(b, 'H', { name: 'Accounts', w: 'fill', gap: 8, align: 'CENTER' }); plat(acc, 'X', 36); plat(acc, 'in', 36); plat(acc, 'gh', 36); chip(acc, 'Find more', false, { icon: 'plus', iconColor: 'harbor' });
  const a = F(b, 'H', { name: 'Actions', w: 'fill', gap: 8 }); button(a, 'Note', 'Primary', 'Small', 'mic', { grow: true }); button(a, 'Photo', 'Secondary', 'Small', 'cam', { grow: true }); button(a, 'Message', 'Secondary', 'Small', 'send', { grow: true });
  seg(b, ['Notes', 'Photos · 4', 'Accounts']);
  const v = card(b, { dir: 'H', gap: 12 }); const pl = F(v, 'H', { name: 'Play', w: 40, h: 40, r: 20, fill: 'tide', justify: 'CENTER', align: 'CENTER' }); icon(pl, 'play', 18, 'ink');
  const wv = wave(v, 30, 9, 'tide', 22, 3); wv.layoutGrow = 1; TX(v, '0:42', 'Mono', 'mist');
  const n = card(b); label(n, 'Notes'); TX(n, 'Building faster zk proving for mobile wallets. Wants an intro to Dev for the benchmark. Lives in Indiranagar, into bouldering.', 'Body', 'paper', { w: 'fill' });
  const f = card(b, { dir: 'H', gap: 12, stroke: ['amber', 1, 0.35] }); R(f, 10, 10, 'amber', { ellipse: true }); TX(f, 'Intro to Dev · due in 2 days', 'Body', 'paper', { grow: true }); button(f, 'Done', 'Done', 'Small', 'check');
  return s;
}},
{ row: 'People', name: 'Photos', note: 'Event photos get their own grid, grouped under the meeting they came from. Long-press to set one as the profile face.', build() {
  const s = screen('Photos'); statusBar(s); const b = body(s, { gap: 12 }); nav(b, 'Photos', 'Select');
  const t = F(b, 'V', { name: 'Title', gap: 2, w: 'fill' }); TX(t, "Priya's photos", 'Title', 'paper', { w: 'fill' }); TX(t, '4 photos from 2 meetings', 'Footnote', 'mist');
  label(b, 'Founders Day · today');
  const g = F(b, 'H', { name: 'Grid', w: 'fill', gap: 8 }); photo(g, 196, 230, 'glacier', 'dusk', 'head');
  const c = F(g, 'V', { name: 'Column', gap: 8 }); photo(c, 146, 111, 'amber', 'tide', 'head'); photo(c, 146, 111, 'sea', 'harbor', 'board');
  label(b, 'Proof Summit · 3 Sep');
  const g2 = F(b, 'H', { name: 'Grid', w: 'fill', gap: 8 }); photo(g2, 111, 111, 'dusk', 'harbor', 'head');
  const add = F(g2, 'H', { name: 'Add photo', w: 111, h: 111, r: 14, justify: 'CENTER', align: 'CENTER', stroke: ['line', 2], dash: [6, 5] }); icon(add, 'plus', 28, 'fog');
  const h = card(b, { dir: 'H', gap: 12 }); icon(h, 'star', 20, 'amber'); TX(h, "Long-press a photo to use it as Priya's face.", 'Footnote', 'paper', { grow: true });
  const ab = actionBar(s); button(ab, 'Library', 'Secondary', 'Large', 'photo', { grow: true }); button(ab, 'Take photo', 'Primary', 'Large', 'cam', { grow: true });
  return s;
}},
{ row: 'People', name: 'Find accounts', note: 'Candidates are ranked by how well they match, with a bar you can read at a glance. Adding one is a single big target, and the primary account gets a star.', build() {
  const s = screen('Find accounts'); statusBar(s); const b = body(s, { gap: 12 }); nav(b, 'Accounts');
  TX(b, "Find Priya's accounts", 'Title', 'paper', { w: 'fill' });
  field(b, 'Priya Raman Proofkit', { icon: 'search', value: true });
  label(b, 'Selected');
  const sel = card(b, { dir: 'H', gap: 12, stroke: ['sea', 1.5] }); plat(sel, 'X', 40); const c0 = F(sel, 'V', { name: 'Text', grow: true }); TX(c0, 'Priya Raman', 'Headline', 'paper', { w: 'fill' }); TX(c0, '@priyaraman · 4.2k', 'Mono', 'mist'); icon(sel, 'star', 22, 'amber');
  label(b, 'Suggested');
  [['in', 'Priya Raman', 'in/priya-raman-zk', 0.92], ['gh', 'priyar', 'github.com/priyar', 0.78], ['X', 'Priya R.', '@priya_builds', 0.41]].forEach(([k, n, h, m]) => {
    const cd = card(b, { gap: 10 }); const r = F(cd, 'H', { name: 'Row', w: 'fill', gap: 12, align: 'CENTER' }); plat(r, k, 40);
    const col = F(r, 'V', { name: 'Text', grow: true }); TX(col, n, 'Headline', 'paper', { w: 'fill' }); TX(col, h, 'Mono', 'mist', { w: 'fill', trunc: true });
    button(r, m > 0.7 ? 'Add' : 'Check', m > 0.7 ? 'Done' : 'Secondary', 'Small');
    const mr = F(cd, 'H', { name: 'Match', w: 'fill', gap: 10, align: 'CENTER' }); bar(mr, m, m > 0.7 ? 'sea' : 'amber', 230); TX(mr, `${Math.round(m * 100)}% match`, 'Mono', 'mist', { size: 12 });
  });
  return s;
}},
{ row: 'People', name: 'Attendee directory', note: 'One sheet for the event registry and LinkedIn search, switched by a segment, instead of two separate modals.', build() {
  const s = screen('Attendee directory'); statusBar(s); body(s, { opacity: 0.3 });
  const sh = sheetOverlay(s);
  const h = F(sh, 'H', { name: 'Header', w: 'fill', justify: 'SPACE_BETWEEN', align: 'CENTER' }); TX(h, "Who's here", 'Title 2'); TX(h, 'Close', 'Headline', 'harbor');
  seg(sh, ['Event list · 412', 'LinkedIn']);
  field(sh, 'Search attendees', { icon: 'search' });
  const l = F(sh, 'V', { name: 'Results', w: 'fill' });
  [ppl[3], ppl[4], ppl[5], { n: 'Meera Joshi', r: 'Speaker · Wallet UX', g: ['harbor', 'sea'], ok: true }, { n: 'Rohan Das', r: 'Founder, Kiln', g: ['tide', 'dusk'], ok: false }, { n: 'Kavya Rao', r: 'Investor, Lightspeed', g: ['glacier', 'amber'], ok: true }].forEach(p => personRow(l, p, 'Add'));
  pinSheet(sh); return s;
}},
{ row: 'People', name: 'Event and tags', note: 'Pick the event and its tags in one sheet. Each tag gets a Tidepool color that shows up on rows across the app.', build() {
  const s = screen('Event and tags'); statusBar(s); const b = body(s, { opacity: 0.3 }); TX(b, 'Today', 'Large title');
  const sh = sheetOverlay(s);
  TX(sh, 'Where are you?', 'Title 2');
  const l = list(sh, { fill: 'ink3' });
  li(l, { tile: ['tag', flat('tide', 'harbor'), 'ink'], title: 'Founders Day · Bengaluru', sub: 'Today · 1.2 km away', trail: r => icon(r, 'check', 22, 'sea') });
  li(l, { tile: ['tag', paint('ink2'), 'fog'], title: 'ZK Hack Night', sub: 'Tomorrow · Koramangala', last: true });
  label(sh, 'Tags for people you meet here');
  const w = F(sh, 'H', { name: 'Tags', w: 'fill', gap: 8, wrap: true });
  [['#investor', 'glacier', 1], ['#zk', 'dusk', 1], ['#hiring', 'harbor', 1], ['#design', 'sea', 0], ['#press', 'amber', 0], ['#speaker', 'tide', 0]].forEach(([t, c, on]) => on ? chip(w, t, true, { fill: c, text: 'ink' }) : chip(w, t, false, { fill: null, text: c, stroke: c }));
  chip(w, 'New tag', false, { text: 'harbor', icon: 'plus', iconColor: 'harbor' });
  button(sh, 'Done', 'Primary', 'Large', null, { w: 'fill' });
  pinSheet(sh); return s;
}},
// ===== More
{ row: 'More', name: 'Manage links', note: 'Drag to reorder. The star picks the link your QR opens on. A switch hides a link from the QR without deleting it. Paste anything and the app detects the platform.', build() {
  const s = screen('Manage links'); statusBar(s); const b = body(s, { opacity: 0.3 }); TX(b, 'Me', 'Large title');
  const sh = sheetOverlay(s);
  const h = F(sh, 'H', { name: 'Header', w: 'fill', justify: 'SPACE_BETWEEN', align: 'CENTER' }); TX(h, 'Your links', 'Title 2'); TX(h, 'Done', 'Headline', 'harbor');
  TX(sh, 'The starred link opens first when someone scans you.', 'Footnote', 'mist', { w: 'fill' });
  const l = list(sh, { fill: 'ink3' });
  const L = [['in', 'LinkedIn', 'linkedin.com/in/abhinil', 1, 1], ['X', 'X', '@abhinil', 0, 1], ['gh', 'GitHub', 'github.com/abhinil', 0, 1], ['wa', 'WhatsApp', '+91 98••• ••210', 0, 0], ['web', 'Website', 'abhinil.dev', 0, 1]];
  L.forEach(([k, n, u, star, on], i) => li(l, { lead: r => { icon(r, 'grip', 18, 'fog'); plat(r, k, 34); }, title: n, sub: u, mono: true, last: i === L.length - 1, trail: r => { icon(r, 'star', 20, star ? 'amber' : 'line'); sw(r, !!on); } }));
  label(sh, 'Add a link');
  field(sh, 'farcaster.xyz/abhinil', { value: true, stroke: ['harbor', 1.5], trail: f => plat(f, 'fc', 26) });
  const d = F(sh, 'H', { name: 'Detected', gap: 6, align: 'CENTER' }); icon(d, 'spark', 14, 'dusk'); TX(d, 'Detected Farcaster', 'Footnote', 'dusk');
  button(sh, 'Add Farcaster', 'Primary', 'Large', 'plus', { w: 'fill' });
  pinSheet(sh); return s;
}},
{ row: 'More', name: 'Recap', note: 'The day ends with a quick keep-or-drop pile, one big card at a time. A ring shows how much of today is settled.', build() {
  const s = screen('Recap'); statusBar(s); const b = body(s); nav(b, 'Recap');
  const h = F(b, 'H', { name: 'Header', w: 'fill', gap: 16, align: 'CENTER' });
  const ring = F(h, 'N', { name: 'Progress ring', w: 86, h: 86 });
  svg(ring, `<svg width="86" height="86" viewBox="0 0 86 86" xmlns="http://www.w3.org/2000/svg"><circle cx="43" cy="43" r="36" fill="none" stroke="${B.line}" stroke-width="9"/><circle cx="43" cy="43" r="36" fill="none" stroke="${B.sea}" stroke-width="9" stroke-linecap="round" stroke-dasharray="170 227" transform="rotate(-90 43 43)"/></svg>`, { at: [0, 0], name: 'Ring' });
  const rt = TX(ring, '9/12', 'Headline'); rt.x = 43 - rt.width / 2; rt.y = 43 - rt.height / 2;
  const tc = F(h, 'V', { name: 'Title', grow: true, gap: 2 }); TX(tc, 'Today, settled', 'Title', 'paper', { w: 'fill' }); TX(tc, '3 people still need a keep or drop', 'Footnote', 'mist', { w: 'fill' });
  const stack = F(b, 'N', { name: 'Card stack', w: 350, h: 360 });
  R(stack, 306, 300, 'ink3', { r: 22, at: [22, 60] }); R(stack, 328, 310, '#16232A', { r: 22, at: [11, 36] });
  const fc = F(stack, 'V', { name: 'Front card', w: 350, h: 330, r: 22, fill: 'ink2', stroke: ['line', 1], gap: 12, align: 'CENTER', justify: 'CENTER', p: 24, at: [0, 0], effects: [shadow('#000000', 0.45, 18, 40)] });
  avatar(fc, ppl[4], 84); TX(fc, 'Sana Qureshi', 'Title', 'paper', { align: 'CENTER' }); TX(fc, 'Product, Razorpay · 4:12 pm', 'Footnote', 'mist'); TX(fc, '"Wants beta testers for the new payouts flow."', 'Body', 'mist', { w: 'fill', align: 'CENTER' });
  const j = card(b, { dir: 'H', gap: 10 }); icon(j, 'check', 20, 'sea'); TX(j, 'Background jobs · nothing failed', 'Footnote', 'paper', { grow: true });
  const ab = actionBar(s); button(ab, 'Drop', 'Secondary', 'Large', 'x', { grow: true }); button(ab, 'Keep', 'Done', 'Large', 'check', { grow: true });
  return s;
}},
{ row: 'More', name: 'Wallet', note: 'Balance and the daily cap come first. The private key shows for 30 seconds behind Face ID and is never copied to the clipboard, which fixes the audit finding.', build() {
  const s = screen('Wallet'); statusBar(s); const b = body(s, { gap: 12 }); nav(b, 'Wallet');
  const bal = card(b, { gap: 6, fill: flat('sea', 'harbor', 0.2, 0.12), stroke: ['sea', 1, 0.3], p: 18 });
  label(bal, 'USDC on Base', 'sea'); TX(bal, '12.40', 'Display', 'paper', { size: 52 }); TX(bal, '0x7a3f…c41e', 'Mono', 'mist');
  const a = F(bal, 'H', { name: 'Actions', w: 'fill', gap: 8 }); button(a, 'Send', 'Light', 'Small', 'send', { grow: true }); button(a, 'Address', 'Secondary', 'Small', null, { grow: true });
  const cap = card(b, { gap: 10 }); const cr = F(cap, 'H', { name: 'Row', w: 'fill', justify: 'SPACE_BETWEEN', align: 'CENTER' }); label(cr, "Today's cap"); TX(cr, '0.31 / 2.00', 'Mono', 'paper'); bar(cap, 0.16, 'amber', 318);
  label(b, 'Lookup history');
  const l = list(b); [['Profile lookup · Priya', '−0.004'], ['X search · Karan', '−0.010'], ['Structure note', '−0.004']].forEach(([t, v], i) => li(l, { title: t, sub: 'Today', last: i === 2, trail: r => TX(r, v, 'Mono', 'paper') }));
  const k = list(b); li(k, { tile: ['eye', paint('danger', 0.15), 'danger'], title: 'Show private key', sub: 'Face ID · hides after 30s · never copied', last: true, trail: r => icon(r, 'chev', 18, 'fog') });
  return s;
}},
{ row: 'More', name: 'Settings', note: "Grouped by what you're trying to do. Each key shows whether it's connected, and the Keychain note sits right under them.", build() {
  const s = screen('Settings'); statusBar(s); const b = body(s, { gap: 12 }); nav(b, 'Settings');
  TX(b, 'Settings', 'Title');
  label(b, 'AI and voice');
  const l = list(b);
  li(l, { tile: ['spark', paint('dusk', 0.15), 'dusk'], title: 'Anthropic key', sub: 'sk-ant-••••3f2a', mono: true, trail: r => pill(r, 'Connected', 'sea') });
  li(l, { tile: ['mic', paint('tide', 0.15), 'tide'], title: 'Groq key, for voice notes', sub: 'Free at console.groq.com', trail: r => pill(r, 'Add', 'amber') });
  li(l, { tile: [null, paint('paper', 0.1)], tileFill: t => plat(t, 'X', 22), title: 'twitterapi.io key', sub: 'Search X by name', last: true, trail: r => pill(r, 'Off', 'fog', { bg: 'ink3' }) });
  TX(b, 'Keys stay in the iPhone Keychain. They are not in backups.', 'Footnote', 'fog', { w: 'fill' });
  label(b, 'Your data');
  const d = list(b);
  li(d, { tile: ['cloud', paint('harbor', 0.15), 'harbor'], title: 'Back up now', sub: 'Last backup yesterday, 11:02 pm', trail: r => icon(r, 'chev', 18, 'fog') });
  li(d, { tile: ['star', paint('glacier', 0.15), 'glacier'], title: 'People you want to meet', sub: '4 on your list', trail: r => icon(r, 'chev', 18, 'fog') });
  li(d, { tile: ['face', paint('sea', 0.15), 'sea'], title: 'Lock with Face ID', last: true, trail: r => sw(r, true) });
  return s;
}},
];

// ---------- brand board ----------
function brandBoard(x, y) {
  const sec = figma.createSection(); sec.name = 'Brand board'; sec.x = x; sec.y = y; sec.resizeWithoutConstraints(2400, 920); sec.fills = [paint('ink')];
  page.appendChild(sec);
  // hero
  const hero = F(null, 'N', { name: 'Hero', w: 820, h: 440, r: 32, fill: [paint('ink2')], clip: true });
  sec.appendChild(hero); hero.x = 40; hero.y = 40;
  [[460, 150, -14, 'sea', 0.35], [380, 130, 24, 'tide', 0.5]].forEach(([w, h, rot, c, op]) => { const e = R(hero, w, h, null, { ellipse: true, stroke: [c, 2, op], at: [600 - w / 2, 200 - h / 2] }); e.rotation = rot; });
  const m = MARK.createInstance(); m.resize(220, 220); hero.appendChild(m); m.x = 490; m.y = 80; m.effects = [shadow('#8EE3D4', 0.4, 0, 60)];
  TX(hero, 'recall.', 'Display', 'paper', { size: 132, at: [40, 230] });
  TX(hero, 'Never forget a face.', 'Title 2', 'paper', { at: [46, 380] });
  TX(hero, 'BRAND KIT · V1 · OCT 2026', 'Caption', 'fog', { ls: 14, at: [46, 40] });
  // story
  const story = F(null, 'V', { name: 'Story', w: 520, gap: 14, p: 28, r: 28, fill: 'ink2' }); sec.appendChild(story); story.x = 880; story.y = 40;
  label(story, 'Name and story');
  TX(story, 'When you try to remember someone, your eyes drift up and to the side.', 'Title', 'paper', { w: 'fill' });
  TX(story, 'The mark is Glance: a speech bubble, the hello you shared, caught in that moment of remembering. One circle, one tail, two eyes looking up and to the left. Nothing else.', 'Body', 'mist', { w: 'fill' });
  const ic = F(story, 'H', { name: 'App icons', gap: 14, align: 'MAX' });
  [[flat('ink', 'ink'), MARK, 84], [flat('tide', 'harbor'), MARK_INK, 84], [flat('paper', 'paper'), MARK_INK, 60]].forEach(([bg, mk, s]) => { const t = F(ic, 'H', { name: 'App icon', w: s, h: s, r: s * 0.26, fill: bg, justify: 'CENTER', align: 'CENTER', stroke: ['line', 1], effects: [shadow('#000000', 0.5, 10, 24)] }); const mm = mk.createInstance(); mm.resize(s * 0.68, s * 0.68); t.appendChild(mm); });
  // palette tags
  const pal = F(null, 'N', { name: 'Tidepool palette', w: 920, h: 440 }); sec.appendChild(pal); pal.x = 1440; pal.y = 40;
  TX(pal, 'TIDEPOOL PALETTE · EACH COLOR HAS ONE JOB', 'Caption', 'fog', { ls: 10, at: [0, 0] });
  [['Tide', 'tide', '#8EE3D4', 'Primary · record'], ['Harbor', 'harbor', '#9CC3FF', 'Links · navigation'], ['Glacier', 'glacier', '#A9DDF2', 'People · tags'], ['Dusk', 'dusk', '#B7C0FF', 'AI · insight'], ['Sea glass', 'sea', '#A6E9C1', 'Confirmed · done'], ['Butter', 'amber', '#F5D98B', 'Due · the one warm']].forEach(([n, k, h, role], i) => {
    const t = F(pal, 'V', { name: 'Tag/' + n, w: 150, h: 260, r: 20, fill: k, p: [36, 16, 16, 16], justify: 'SPACE_BETWEEN', effects: [shadow('#000000', 0.55, 22, 36)] });
    t.x = 10 + i * 146; t.y = 70 + Math.abs(i - 2.5) * 14; t.rotation = (2.5 - i) * 3;
    const top = F(t, 'V', { name: 'Name', gap: 2 }); TX(top, n, 'Title 2', 'ink'); TX(top, h, 'Mono', 'ink', { op: 0.7 }); TX(t, role, 'Headline', 'ink', { size: 14 });
    R(t, 34, 8, 'ink', { r: 4, op: 0.25, abs: [58, 14], name: 'Slot' });
  });
  // neutrals + pairings (flat, no gradients)
  const nr = F(null, 'H', { name: 'Neutrals', gap: 10 }); sec.appendChild(nr); nr.x = 40; nr.y = 510;
  [['Ink', 'ink', 'bg'], ['Ink 2', 'ink2', 'surface'], ['Ink 3', 'ink3', 'raised'], ['Line', 'line', 'divider'], ['Fog', 'fog', 'text 3'], ['Mist', 'mist', 'text 2'], ['Paper', 'paper', 'text']].forEach(([n, k, role]) => { const c = F(nr, 'V', { name: n, w: 112, h: 96, r: 16, p: 12, justify: 'MAX', fill: k, stroke: ['line', 1] }); const dark = ['fog', 'mist', 'paper'].includes(k); TX(c, n, 'Headline', dark ? 'ink' : 'paper', { size: 14 }); TX(c, `${B[k]} · ${role}`, 'Mono', dark ? 'ink' : 'mist', { size: 10 }); });
  const gr = F(null, 'H', { name: 'Gradients', gap: 10 }); sec.appendChild(gr); gr.x = 40; gr.y = 630;
  [['Tide + Ink · primary actions, the mark', 'tide', 'tide'], ['Dusk + Ink · anything the AI does', 'dusk', 'dusk'], ['Sea glass + Ink · confirmed, recap done', 'sea', 'sea']].forEach(([n, a, b2]) => { const g = F(gr, 'V', { name: n, w: 256, h: 110, r: 18, p: 14, justify: 'MAX', fill: flat(a, b2) }); TX(g, n, 'Headline', 'ink', { size: 14 }); });
  const cn = TX(sec, 'Flat pastels only, never gradients. Text on any color is Ink, never white: every pastel clears 9:1 against Ink.', 'Footnote', 'mist', { at: [40, 760] });
  // type
  const ty = F(null, 'V', { name: 'Type', w: 760, gap: 12, p: 28, r: 28, fill: 'ink2' }); sec.appendChild(ty); ty.x = 880; ty.y = 500;
  label(ty, 'Type · Bricolage Grotesque, Instrument Sans, JetBrains Mono');
  [['Display', 'Priya Raman', 'Display 64'], ['Large title', 'Today', 'Large title 36'], ['Title 2', 'Possible accounts', 'Title 2 22'], ['Headline', 'Karan Mehta', 'Headline 17'], ['Body', 'Runs a seed fund for climate hardware.', 'Body 17'], ['Footnote', 'Met at Founders Day · 6:42 pm', 'Footnote 14'], ['Mono', '@priyaraman · 0.40 USDC · 18:42 IST', 'Mono 13']].forEach(([st, txt, cap]) => { const r = F(ty, 'H', { name: st, w: 'fill', gap: 16, align: 'BASELINE' }); TX(r, cap, 'Mono', 'fog', { size: 11, w: 110 }); TX(r, txt, st, st === 'Footnote' ? 'mist' : st === 'Mono' ? 'harbor' : 'paper', { grow: true }); });
  // voice
  const vo = F(null, 'V', { name: 'Voice', w: 680, gap: 12, p: 28, r: 28, fill: 'ink2' }); sec.appendChild(vo); vo.x = 1680; vo.y = 500;
  label(vo, 'Voice · say it like a friend');
  [['No encounters found.', 'Nobody yet today. Scan a badge or a QR to start.'], ['Transcription failed (401).', 'Voice notes need a Groq key. Add one in Settings, or type the note.'], ['Action item marked complete.', "Done. Karan's loop is closed."]].forEach(([no, yes]) => { const r = F(vo, 'H', { name: 'Pair', w: 'fill', gap: 10 }); const a = F(r, 'V', { name: 'Avoid', grow: true, p: 12, r: 12, fill: 'danger', op: 0.12 }); TX(a, no, 'Footnote', '#F5B8B8', { w: 'fill' }); const b2 = F(r, 'V', { name: 'Say', grow: true, p: 12, r: 12, fill: 'sea', op: 0.12 }); TX(b2, yes, 'Footnote', 'paper', { w: 'fill' }); });
  const maxB = Math.max(...sec.children.map(n => n.y + n.height)) + 40; sec.resizeWithoutConstraints(2400, maxB);
  return sec;
}

function glanceSvg(ink) {
  const f = ink ? B.ink : B.tide, k = ink ? B.tide : B.ink;
  return `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 18a32 32 0 1 1-17.6 58.7L20 82l4.3-12.6A32 32 0 0 1 50 18z" fill="${f}"/><rect x="37" y="36" width="7" height="13" rx="3.5" fill="${k}"/><rect x="52" y="36" width="7" height="13" rx="3.5" fill="${k}"/></svg>`;
}

// ---------- run ----------
async function setup() {
  page = figma.root.children.find(p => p.name.startsWith('Brand screens')) || figma.currentPage;
  await figma.setCurrentPageAsync(page);
  // Tidepool migration: rename the old brand variables and retune every color token in place
  const RENAME = { 'brand/coral': 'brand/tide', 'brand/marigold': 'brand/amber', 'brand/lagoon': 'brand/sea', 'brand/iris': 'brand/dusk', 'brand/bloom': 'brand/glacier', 'brand/sky': 'brand/harbor' };
  const VALUES = { bg: 'ink', surface1: 'ink2', surface2: 'ink3', text: 'paper', text2: 'mist', text3: 'fog', border: 'line', danger: 'danger', dangerStrong: '#D9534F', action: 'harbor', actionText: 'ink', linked: 'sea', warning: 'amber', input: '#5A6B74', 'brand/tide': 'tide', 'brand/harbor': 'harbor', 'brand/glacier': 'glacier', 'brand/dusk': 'dusk', 'brand/sea': 'sea', 'brand/amber': 'amber' };
  for (const c of await figma.variables.getLocalVariableCollectionsAsync()) for (const id of c.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    if (RENAME[v.name]) v.name = RENAME[v.name];
    if (VALUES[v.name] && v.resolvedType === 'COLOR') v.setValueForMode(c.modes[0].modeId, hex(VALUES[v.name]));
    VV[v.name] = v;
  }
  const fonts = [['Instrument Sans', 'Regular'], ['Instrument Sans', 'Medium'], ['Instrument Sans', 'SemiBold'], ['Instrument Sans', 'Bold'], ['Bricolage Grotesque', 'ExtraBold'], ['Bricolage Grotesque', 'Bold'], ['Bricolage Grotesque', 'SemiBold'], ['JetBrains Mono', 'Medium'], ['JetBrains Mono', 'Regular']];
  for (const [family, style] of fonts) await figma.loadFontAsync({ family, style });
  for (const s of await figma.getLocalTextStylesAsync()) { await figma.loadFontAsync(s.fontName); ST[s.name] = s.id; }
  for (const n of ['Large title', 'Title', 'Title 2', 'Headline', 'Body', 'Footnote', 'Caption', 'Mono', 'Display', 'Button', 'Button small']) if (!ST[n]) throw new Error(`Text style "${n}" is missing`);
  for (const c of page.findAllWithCriteria({ types: ['COMPONENT'] })) { if (c.name.startsWith('Icon/')) IC[c.name.slice(5)] = c; if (c.name === 'Logo/Mark') MARK = c; if (c.name === 'Logo/Mark ink') MARK_INK = c; }
  for (const s of page.findAllWithCriteria({ types: ['COMPONENT_SET'] })) SET[s.name] = s;
  for (const n of ['Button', 'Chip', 'TabBar', 'PersonRow']) if (!SET[n]) throw new Error(`Component set "${n}" is missing on ${page.name}`);
  if (!MARK || !MARK_INK || !IC.check) throw new Error('Logo or icon components are missing');
  // swap the logo artwork for Glance; every instance follows
  for (const [comp, ink] of [[MARK, false], [MARK_INK, true]]) {
    for (const c of [...comp.children]) c.remove();
    const art = figma.createNodeFromSvg(glanceSvg(ink));
    for (const c of [...art.children]) comp.appendChild(c);
    art.remove(); comp.resize(100, 100);
    comp.description = 'Glance: a hello, being remembered. Tail bottom left, eyes look up left. Tide and Ink only, always flat.';
  }
  // older runs painted gradients here; make them flat and bound to the Tide variable
  for (const v of SET.Button.children) if (v.name.startsWith('Kind=Primary')) v.fills = [flat('tide', 'harbor')];
  for (const fab of SET.TabBar.findAll(n => n.name === 'Scan button (72)')) { fab.fills = [flat('tide', 'harbor')]; fab.effects = [shadow('#8EE3D4', 0.35, 12, 30)]; }
  // the PersonRow name/role texts were left at zero width by the last MCP session
  for (const v of SET.PersonRow.children) { const tx = v.findOne(x => x.name === 'Text'); if (!tx) continue; for (const t of tx.children) { if (t.type !== 'TEXT') continue; t.textAutoResize = 'WIDTH_AND_HEIGHT'; t.layoutSizingHorizontal = 'FILL'; t.textAutoResize = 'HEIGHT'; t.textTruncation = 'ENDING'; t.maxLines = 1; } }
}

async function run() {
  await setup();
  for (const n of [...page.children]) if (OUT.includes(n.name)) n.remove();
  const title = TX(page, 'Recall · brand screens v2', 'Large title', 'paper'); title.x = 0; title.y = 0; title.name = 'Recall · brand screens v2';
  const errors = [];
  try { brandBoard(0, 80); } catch (e) { errors.push('Brand board: ' + e.message); }
  const comps = page.children.find(n => n.type === 'SECTION' && n.name === 'Components');
  if (comps) { comps.x = 0; comps.y = 1080; }
  let y = (comps ? comps.y + comps.height : 1900) + 120;
  const rows = [...new Set(SCREENS.map(s => s.row))];
  for (const row of rows) {
    const items = SCREENS.filter(s => s.row === row);
    const sec = figma.createSection(); sec.name = row; page.appendChild(sec); sec.x = 0; sec.y = y; sec.fills = [paint('ink2')];
    TX(sec, row.toUpperCase(), 'Caption', 'fog', { ls: 14, at: [40, 28] });
    let maxH = 0;
    items.forEach((def, i) => {
      const x = 40 + i * 460;
      try {
        const scr = def.build(); sec.appendChild(scr); scr.x = x; scr.y = 70; scr.effects = [shadow('#000000', 0.5, 24, 60)];
        const note = F(null, 'V', { name: 'Note · ' + def.name, w: 390, gap: 6 }); sec.appendChild(note); note.x = x; note.y = 70 + 844 + 24;
        TX(note, def.name.toUpperCase(), 'Caption', 'tide', { ls: 10 }); TX(note, def.note, 'Footnote', 'mist', { w: 'fill' });
        maxH = Math.max(maxH, note.y + note.height);
      } catch (e) { errors.push(`${def.name}: ${e.message}`); }
    });
    sec.resizeWithoutConstraints(40 + items.length * 460 - 30, maxH + 50);
    y += sec.height + 80;
  }
  figma.viewport.scrollAndZoomIntoView(page.children.filter(n => n.type === 'SECTION'));
  return errors;
}

run().then(errors => {
  if (errors.length) { console.error(errors); figma.notify(`Built with ${errors.length} problem(s): ${errors.join(' · ')}`, { error: true, timeout: 15000 }); }
  else figma.notify('Recall brand board and 19 screens built.');
  figma.closePlugin();
}).catch(e => { console.error(e); figma.closePlugin('Recall plugin failed: ' + e.message); });
