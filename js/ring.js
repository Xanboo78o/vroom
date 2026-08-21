/* =============================================================================
   ring.js — the block catalog: concentric rings at the cursor (Adam's design).
   Right-click opens it, it stays open. Rings 1-3 = categories (6/10/14 slots,
   rings only appear once there are enough categories). Click a category and its
   parts bloom OUTWARD into up to 4 more rings (12/16/20/24 = 72 per category),
   basic parts closest to your hand, exotic on the rim. Hover = name in the hub,
   click = held, menu closes. Everything is data: a part just says its `cat`.
   Flat fills + darker-shade edges, icons pixelated (no smoothing).
   ============================================================================= */
import { PARTS, PART_ORDER, CATS } from './parts.js';
import { PAL, hex as phex } from './palette.js';

const CAT_CAP = [6, 10, 14];          // slots per category ring
const PART_CAP = [12, 16, 20, 24];    // slots per part ring (max 4 rings)
const HUB = 40, GAP = 5, BAND = 58;   // hub radius, ring gap, ring width (px)
const NS = 'http://www.w3.org/2000/svg';

function hex(n){ return '#' + n.toString(16).padStart(6, '0'); }
function shade(n, f){ const r = (n >> 16 & 255) * f, g = (n >> 8 & 255) * f, b = (n & 255) * f; return hex((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)); }
function el(tag, attrs = {}){ const e = document.createElementNS(NS, tag); for(const k in attrs) e.setAttribute(k, attrs[k]); return e; }

// annular sector path between radii r0..r1, angles a0..a1 (radians, clockwise from top)
function sector(r0, r1, a0, a1){
  const g0 = 2.2 / r0, g1 = 2.2 / r1;            // ~2px gap between neighbours
  const P = (r, a) => [Math.sin(a) * r, -Math.cos(a) * r];
  const [x0, y0] = P(r1, a0 + g1), [x1, y1] = P(r1, a1 - g1), [x2, y2] = P(r0, a1 - g0), [x3, y3] = P(r0, a0 + g0);
  const big = (a1 - a0) > Math.PI ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r1} ${r1} 0 ${big} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} A${r0} ${r0} 0 ${big} 0 ${x3.toFixed(1)} ${y3.toFixed(1)} Z`;
}

// split a list into rings by capacity: [[...cap0], [...cap1], ...]
function ringsOf(items, caps){
  const out = []; let i = 0;
  for(const cap of caps){ if(i >= items.length) break; out.push(items.slice(i, i + cap)); i += cap; }
  return out;
}

export function makeRing({ iconFor, held, onPick }){
  const root = el('svg', { id: 'ring' });
  root.style.display = 'none';
  document.body.appendChild(root);
  const R = { open: false, cat: null, cx: 0, cy: 0, scale: 1 };

  function catsUsed(){ return CATS.filter(c => PART_ORDER.some(t => PARTS[t].cat === c.id)); }
  function partsIn(cat){ return PART_ORDER.filter(t => PARTS[t].cat === cat); }

  function render(){
    while(root.firstChild) root.removeChild(root.firstChild);
    const cats = catsUsed();
    const catRings = ringsOf(cats, CAT_CAP);
    const parts = R.cat ? partsIn(R.cat) : [];
    const partRings = ringsOf(parts, PART_CAP);
    const nRings = catRings.length + partRings.length;
    const maxR = HUB + GAP + nRings * (BAND + GAP);
    // fit: scale down on small screens, keep the whole dial on screen
    R.scale = Math.min(1, (Math.min(innerWidth, innerHeight) / 2 - 8) / maxR);
    const m = maxR * R.scale;
    const cx = Math.max(m + 4, Math.min(innerWidth - m - 4, R.cx));
    const cy = Math.max(m + 4, Math.min(innerHeight - m - 4, R.cy));

    // backdrop: a click anywhere off the dial closes it
    const bd = el('rect', { x: 0, y: 0, width: innerWidth, height: innerHeight, fill: 'transparent' });
    bd.addEventListener('mousedown', e => { e.preventDefault(); close(); });
    root.appendChild(bd);
    const g = el('g', { transform: `translate(${cx} ${cy}) scale(${R.scale})` });
    root.appendChild(g);

    let r0 = HUB + GAP;
    const hubIcon = el('image', { x: -28, y: -28, width: 56, height: 56, href: iconFor(held()) });
    const hubText = el('text', { x: 0, y: 4, class: 'hubText' });
    const setHover = (label) => { hubText.textContent = label || ''; hubIcon.style.display = label ? 'none' : ''; };

    // category rings
    catRings.forEach(ring => {
      const r1 = r0 + BAND, step = 2 * Math.PI / ring.length;
      ring.forEach((c, i) => {
        const a0 = i * step, a1 = a0 + step, mid = (a0 + a1) / 2, rm = (r0 + r1) / 2;
        const open = R.cat === c.id, dim = R.cat && !open;
        const p = el('path', { d: sector(r0, r1, a0, a1), class: 'cat' + (open ? ' open' : '') + (dim ? ' dim' : ''),
          fill: open ? hex(c.color) : phex(PAL.cream), stroke: open ? shade(c.color, .72) : phex(PAL.border) });
        // colour band on the inner edge says "this is a category"
        const band = el('path', { d: sector(r0, r0 + 8, a0, a1), fill: hex(c.color), stroke: 'none', 'pointer-events': 'none' });
        const hero = PART_ORDER.find(t => PARTS[t].cat === c.id);
        const ic = el('image', { x: Math.sin(mid) * rm - 21, y: -Math.cos(mid) * rm - 21 + 3, width: 42, height: 42, href: iconFor(hero), 'pointer-events': 'none', class: dim ? 'dim' : '' });
        p.addEventListener('mouseenter', () => setHover(c.label));
        p.addEventListener('mouseleave', () => setHover(''));
        p.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); if(e.button === 0){ R.cat = open ? null : c.id; render(); } });
        g.append(p, band, ic);
      });
      r0 = r1 + GAP;
    });

    // part rings (outward from the categories)
    const cat = CATS.find(c => c.id === R.cat);
    partRings.forEach(ring => {
      const r1 = r0 + BAND, step = 2 * Math.PI / ring.length;
      ring.forEach((t, i) => {
        const a0 = i * step, a1 = a0 + step, mid = (a0 + a1) / 2, rm = (r0 + r1) / 2;
        const isHeld = t === held();
        const p = el('path', { d: sector(r0, r1, a0, a1), class: 'part' + (isHeld ? ' held' : ''),
          fill: isHeld ? phex(PAL.paper) : phex(PAL.cream), stroke: isHeld ? hex(cat.color) : phex(PAL.border) });
        const sz = BAND - 10;
        const ic = el('image', { x: Math.sin(mid) * rm - sz / 2, y: -Math.cos(mid) * rm - sz / 2, width: sz, height: sz, href: iconFor(t), 'pointer-events': 'none' });
        p.addEventListener('mouseenter', () => setHover(PARTS[t].label));
        p.addEventListener('mouseleave', () => setHover(''));
        p.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); if(e.button === 0){ onPick(t); close(); } });
        g.append(p, ic);
      });
      r0 = r1 + GAP;
    });

    // hub: what you're holding / what you're hovering
    const hub = el('circle', { r: HUB, class: 'hub', fill: phex(PAL.cream), stroke: phex(PAL.border) });
    g.append(hub, hubIcon, hubText);
  }

  function open(x, y){ R.open = true; R.cx = x; R.cy = y; root.style.display = ''; render(); }
  function close(){ R.open = false; root.style.display = 'none'; }
  function toggle(x, y){ R.open ? close() : open(x, y); }
  return { open, close, toggle, render, get isOpen(){ return R.open; } };
}
