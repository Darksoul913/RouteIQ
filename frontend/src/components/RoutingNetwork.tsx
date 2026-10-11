import { useEffect, useRef, useState } from 'react';
import type { Model, RouteResponse } from '../types';
import { routeBus, useReducedMotion } from '../store';
import { ctx, isLocal, ms } from '../lib/format';

/*
 * The routing network, drawn with a hand-rolled 3D projection on Canvas 2D.
 *
 * variant="chart"  ink plot on paper: particle-ribbon core, curved edges to every model.
 * variant="orbit"  the home scene: a frosted-lens core inside two gyroscope rings, model markers
 *                  in orbit over flowing line terrain that dips into a well under the router.
 *
 * Both encode the same real data: node height = capability, teal = local GGUF,
 * violet = hosted API, red = degraded (circuit not CLOSED or chaos active). In orbit mode the
 * arc around each marker fills to its capability score and the tag shows calls served.
 * Ambient motion carries no meaning; packets replay real /route results from this tab.
 * The pointer only moves the view while pressed (drag to rotate/tilt); hover shows a card.
 */

const C = {
  cyan: [11, 139, 160],
  violet: [98, 70, 216],
  magenta: [194, 64, 143],
  mint: [18, 133, 90],
  amber: [168, 100, 0],
  coral: [207, 59, 85],
  text: [15, 27, 45],
  dim: [74, 88, 114],
  paper: [255, 255, 255],
} as const;
type RGB = readonly number[];
const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

type V3 = [number, number, number];

export const degraded = (m: Model) =>
  m.circuit_breaker?.state !== 'CLOSED' || m.chaos?.kill_switch || (m.chaos?.error_rate ?? 0) > 0 || (m.chaos?.add_latency_ms ?? 0) > 0;

const RIBBONS = [
  { col: C.cyan, amp: 0.55, ph: 0, speed: 0.35, width: 0.16, tilt: 0.3 },
  { col: C.violet, amp: 0.7, ph: 2.1, speed: -0.28, width: 0.2, tilt: -0.5 },
  { col: C.magenta, amp: 0.42, ph: 4.0, speed: 0.22, width: 0.1, tilt: 1.1 },
];

const CORE_R = 0.7;
const ORBIT_R = 1.5;
const CAMERA = 4.2;
const TERRAIN_TILT = 0.3;

interface Playback {
  result: RouteResponse;
  start: number;
}

// Timeline (ms) for a replayed route event.
const T_FLARE = 450;
const T_HOP = 650;
const T_HOLD = 5200;

interface Props {
  models: Model[];
  variant?: 'chart' | 'orbit';
  focusId?: string | null;
  onSelect?: (id: string) => void;
  /** wheel zoom + zoom buttons (off where the page scrolls). Drag-rotate is always on. */
  interactive?: boolean;
  labels?: 'all' | 'focus';
  density?: number;
  className?: string;
  zoom?: number;
  /** filter: ids that should be drawn at full strength; others dimmed */
  visibleIds?: Set<string> | null;
  ariaLabel?: string;
  /** horizontal centre as a fraction of width on wide screens (home shifts right of its headline) */
  offsetX?: number;
  /** orbit only: how much of the height the orbit may use (home keeps room for overlays) */
  heightFit?: number;
  /** orbit only: how much of the width the orbit may use on wide screens */
  widthFit?: number;
}

export default function RoutingNetwork({
  models, variant = 'chart', focusId = null, onSelect, interactive = false, labels = 'all', density = 1, className, zoom = 1, visibleIds = null, ariaLabel, offsetX = 0.5, heightFit = 1.3, widthFit = 0.72,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const ctl = useRef({ redraw: () => {}, zoomBy: (_f: number) => {} });
  const orbit = variant === 'orbit';

  // Latest props for the imperative loop.
  const live = useRef({ models, focusId, labels, zoom, visibleIds, offsetX, heightFit, widthFit, hoverId: null as string | null, onSelect });
  live.current = { ...live.current, models, focusId, labels, zoom, visibleIds, offsetX, heightFit, widthFit, onSelect };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const g = canvas.getContext('2d')!;
    let w = 0, h = 0, dpr = 1;
    let raf = 0;
    let visible = true;
    let rot = 0.6;
    let tilt = orbit ? 0.32 : 0.5;
    let userZoom = 1;
    let spinV = 0; // rotation velocity left over from a drag, decays to the ambient drift
    let dragging: { x: number; y: number; lt: number; rot: number; tilt: number; moved: boolean } | null = null;
    let last = performance.now();
    let playback: Playback | null = null;
    const projected = new Map<string, { x: number; y: number; r: number; z: number }>();

    // Fibonacci sphere shell + ribbon particles for the core.
    const N = Math.round(1100 * density);
    const pts: V3[] = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963229728653;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    const ribbon = Array.from({ length: Math.round((orbit ? 1500 : 2400) * density) }, (_, i) => ({
      k: i % RIBBONS.length,
      u: Math.random(),
      w: Math.random() + Math.random() - 1, // triangular spread: dense centre, soft edges
    }));

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (reduced) draw(performance.now());
    };

    const nodePos = (i: number, n: number, m: Model): V3 => {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      const y = (m.capability_score - 0.7) * 1.5;
      return [Math.cos(a) * ORBIT_R, y, Math.sin(a) * ORBIT_R];
    };

    const focal = () =>
      (orbit ? Math.min(w * (w < 600 ? 0.8 : live.current.widthFit), h * live.current.heightFit) : Math.min(w * 0.78, h * 1.5)) * live.current.zoom * userZoom;
    const cx0 = () => (w > 980 ? w * live.current.offsetX : w / 2);
    const cy0 = () => h * (orbit ? 0.53 : 0.46); // a little above middle: front nodes project downward

    const projectWith = (p: V3, ry: number, rx: number) => {
      let [x, y, z] = p;
      const cy_ = Math.cos(ry), sy_ = Math.sin(ry);
      [x, z] = [x * cy_ - z * sy_, x * sy_ + z * cy_];
      const cx_ = Math.cos(rx), sx_ = Math.sin(rx);
      [y, z] = [y * cx_ - z * sx_, y * sx_ + z * cx_];
      const s = focal() / (CAMERA - z);
      return { x: cx0() + x * s, y: cy0() - y * s, s, z };
    };
    const project = (p: V3) => projectWith(p, rot, tilt);

    const bez = (a: V3, b: V3, c: V3, t: number): V3 => {
      const u = 1 - t;
      return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1], u * u * a[2] + 2 * u * t * b[2] + t * t * c[2]];
    };
    const edgeOf = (node: V3): [V3, V3, V3] => {
      const len = Math.hypot(node[0], node[1], node[2]) || 1;
      const k = CORE_R * (orbit ? 0.68 : 1.02);
      const start: V3 = [(node[0] / len) * k, (node[1] / len) * k, (node[2] / len) * k];
      const ctrl: V3 = [(start[0] + node[0]) / 2, (start[1] + node[1]) / 2 + (orbit ? 0.3 : 0.38), (start[2] + node[2]) / 2];
      return [start, ctrl, node];
    };
    const strokeEdge = (a: V3, b: V3, c: V3) => {
      const pa = project(a), pb = project(b), pc = project(c);
      g.beginPath();
      g.moveTo(pa.x, pa.y);
      g.quadraticCurveTo(pb.x, pb.y, pc.x, pc.y);
      g.stroke();
    };

    /* ---------- orbit-scene layers ---------- */
    const ROWS = Math.round(46 * Math.max(0.6, density));
    const COLS = 96;
    function drawTerrain(t: number, flare: number) {
      const tt = reduced ? 0 : t;
      for (let j = 0; j < ROWS; j++) {
        const depth = j / (ROWS - 1);
        const z = -6 + depth * 7.2; // far → near
        g.beginPath();
        for (let i = 0; i <= COLS; i++) {
          const x = -8 + (i / COLS) * 16;
          const r2 = x * x + (z + 0.2) * (z + 0.2);
          const y =
            -1.25 +
            0.24 * Math.sin(x * 0.6 + tt * 0.32 + z * 0.55) +
            0.12 * Math.sin(x * 1.5 - tt * 0.21 + z * 1.3) +
            0.07 * Math.sin(z * 2.2 + tt * 0.45) -
            (0.85 + 0.15 * flare) * Math.exp(-r2 / 2.4); // the router's well
          const p = projectWith([x, y, z], 0, TERRAIN_TILT);
          if (i) g.lineTo(p.x, p.y);
          else g.moveTo(p.x, p.y);
        }
        g.strokeStyle = rgba(mix(C.violet, C.cyan, 0.15 + depth * 0.6), 0.035 + 0.15 * depth);
        g.lineWidth = 0.4 + depth * 0.5;
        g.stroke();
      }
    }

    function drawRibbons(coreR: number, cs: number, sn: number, tt: number, flare: number, tint: (c: RGB) => RGB, alphaMul: number, sizeMul = 1) {
      for (const rp of ribbon) {
        const R = RIBBONS[rp.k];
        const th = rp.u * Math.PI * 2;
        const lat = R.amp * Math.sin(2 * th + R.ph + tt * R.speed) + 0.22 * Math.sin(3 * th - tt * 0.27 + R.ph) + rp.w * R.width;
        const rr = coreR * (1 + 0.03 * rp.w + 0.02 * Math.sin(th * 5 + tt));
        const x = Math.cos(lat) * Math.cos(th);
        let y = Math.sin(lat), z = Math.cos(lat) * Math.sin(th);
        const ct = Math.cos(R.tilt), st = Math.sin(R.tilt);
        [y, z] = [y * ct - z * st, y * st + z * ct];
        const p = project([(x * cs - z * sn) * rr, y * rr, (x * sn + z * cs) * rr]);
        const front = clamp((p.z + coreR) / (2 * coreR));
        const core = 1 - Math.abs(rp.w);
        g.fillStyle = rgba(tint(R.col), Math.min(1, (0.1 + 0.6 * front) * (0.2 + core * 0.85) * (1 + 0.6 * flare) * alphaMul));
        const sz = (0.5 + front * 1.0 + core * 0.7) * (p.s / 120) * sizeMul;
        g.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      }
    }

    /** Two hairline gyroscope rings around the core, each with a travelling light. */
    function drawGyro(cx: number, cy: number, R: number, back: boolean, flare: number, t: number) {
      const rings = [
        { rx: R * 1.6, ry: R * 1.6 * Math.max(0.12, Math.sin(tilt)), rot: -0.08, speed: 0.45, ph: 0, col: C.violet },
        { rx: R * 1.32, ry: R * 0.5, rot: 0.62, speed: -0.6, ph: 2.2, col: C.cyan },
      ];
      for (const rg of rings) {
        g.save();
        g.translate(cx, cy);
        g.rotate(rg.rot);
        g.beginPath();
        g.ellipse(0, 0, rg.rx, rg.ry, 0, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI);
        g.strokeStyle = rgba(rg.col, (back ? 0.18 : 0.5) + 0.3 * flare);
        g.lineWidth = back ? 1 : 1.25;
        g.stroke();
        const a = (reduced ? 0.8 : t * rg.speed) + rg.ph;
        const behind = Math.sin(a) < 0;
        if (behind === back) {
          const bx = Math.cos(a) * rg.rx, by = Math.sin(a) * rg.ry;
          const gl = g.createRadialGradient(bx, by, 0, bx, by, 9);
          gl.addColorStop(0, rgba(rg.col, back ? 0.25 : 0.45));
          gl.addColorStop(1, rgba(rg.col, 0));
          g.fillStyle = gl;
          g.fillRect(bx - 9, by - 9, 18, 18);
          g.beginPath();
          g.arc(bx, by, back ? 1.8 : 2.4, 0, 7);
          g.fillStyle = back ? rgba(rg.col, 0.5) : '#fff';
          g.fill();
          if (!back) {
            g.lineWidth = 1.2;
            g.strokeStyle = rgba(rg.col, 0.9);
            g.stroke();
          }
        }
        g.restore();
      }
    }

    /** The router as a frosted lens: translucent disc, hairline rim, fine routing threads inside. */
    function drawLensCore(cx: number, cy: number, R: number, flare: number, refusedFade: number, coreR: number, cs: number, sn: number, tt: number, tint: (c: RGB) => RGB, t: number) {
      const bloom = g.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 3);
      const bc = refusedFade > 0 ? mix(C.violet, C.amber, refusedFade) : C.violet;
      bloom.addColorStop(0, rgba(bc, 0.12 + 0.14 * flare));
      bloom.addColorStop(1, rgba(bc, 0));
      g.fillStyle = bloom;
      g.fillRect(cx - R * 3, cy - R * 3, R * 6, R * 6);

      drawGyro(cx, cy, R, true, flare, t);

      const body = g.createRadialGradient(cx, cy - R * 0.25, R * 0.1, cx, cy, R);
      body.addColorStop(0, 'rgba(255,255,255,0.9)');
      body.addColorStop(0.7, 'rgba(240,237,255,0.72)');
      body.addColorStop(1, 'rgba(214,206,252,0.62)');
      g.beginPath();
      g.arc(cx, cy, R, 0, 7);
      g.fillStyle = body;
      g.fill();

      g.save();
      g.beginPath();
      g.arc(cx, cy, R * 0.96, 0, 7);
      g.clip();
      drawRibbons(coreR * 0.82, cs, sn, tt, flare, tint, 0.9, 0.55);
      g.restore();

      g.beginPath();
      g.arc(cx, cy, R, 0, 7);
      g.lineWidth = 1;
      g.strokeStyle = rgba(C.violet, 0.4 + 0.35 * flare);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy, R - 2.5, 0, 7);
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.stroke();

      drawGyro(cx, cy, R, false, flare, t);
    }

    function pill(x: number, y: number, wd: number, ht: number) {
      const r = ht / 2;
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + wd, y, x + wd, y + ht, r);
      g.arcTo(x + wd, y + ht, x, y + ht, r);
      g.arcTo(x, y + ht, x, y, r);
      g.arcTo(x, y, x + wd, y, r);
      g.closePath();
    }

    function draw(now: number) {
      const dt = Math.min(64, now - last);
      last = now;
      const t = now / 1000;
      const tt = reduced ? 0 : t;
      const { models: ms_, focusId: fid, labels: lab, visibleIds: vis, hoverId } = live.current;
      if (!dragging) {
        rot += spinV * dt + (reduced ? 0 : dt * (orbit ? 0.00005 : 0.00006));
        spinV *= Math.pow(0.992, dt);
        if (Math.abs(spinV) < 1e-6) spinV = 0;
      }

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      // playback state
      let pb = playback;
      let el = 0;
      if (pb) {
        el = reduced ? 1e9 : now - pb.start;
        if (el > T_HOLD + 2500 && !reduced) { playback = null; pb = null; }
      }
      const res = pb?.result;
      const hops = res ? [...res.failover_chain.map((f) => ({ id: f.model_id, ok: false })), ...(res.chosen_model ? [{ id: res.chosen_model, ok: true }] : [])] : [];
      const fade = pb ? (reduced ? 1 : 1 - clamp((el - T_HOLD) / 2500)) : 0;
      const coreFlare = pb ? (reduced ? 0.4 : Math.max(0, 1 - el / T_FLARE) + 0.25 * fade) : 0;
      const refused = !!res?.no_valid_model;
      const tint = (c: RGB) => (refused && pb ? mix(c, C.amber, 0.65 * fade) : c);

      if (orbit) drawTerrain(t, coreFlare);

      const n = ms_.length;
      const nodes = ms_.map((m, i) => {
        const p3 = nodePos(i, n, m);
        return { m, p3, p: project(p3) };
      });
      const order = [...nodes].sort((a, b) => a.p.z - b.p.z);
      const center = project([0, 0, 0]);
      const pulse = reduced ? 1 : 1 + (orbit ? 0.012 : 0.025) * Math.sin(t * 1.6);
      const coreR = CORE_R * (orbit ? 0.68 : 1) * pulse * (1 + 0.06 * coreFlare);
      const spin = reduced ? 0 : t * 0.25;
      const cs = Math.cos(spin), sn = Math.sin(spin);

      /* ---- edges / orbit track ---- */
      if (orbit) {
        // the orbit plane: a faint track, and a dotted stem from each model down to it (height = capability)
        g.strokeStyle = rgba(C.violet, 0.22);
        g.lineWidth = 1;
        g.beginPath();
        for (let i = 0; i <= 96; i++) {
          const a = (i / 96) * Math.PI * 2;
          const p = project([Math.cos(a) * ORBIT_R, 0, Math.sin(a) * ORBIT_R]);
          if (i) g.lineTo(p.x, p.y);
          else g.moveTo(p.x, p.y);
        }
        g.stroke();
        g.setLineDash([2, 4]);
        for (const nd of order) {
          const base = project([nd.p3[0], 0, nd.p3[2]]);
          g.strokeStyle = rgba(C.dim, 0.3);
          g.beginPath();
          g.moveTo(base.x, base.y);
          g.lineTo(nd.p.x, nd.p.y);
          g.stroke();
        }
        g.setLineDash([]);
        // spokes: faint links from the router to every model, stronger for the one in focus
        for (const nd of order) {
          const [a, b, c] = edgeOf(nd.p3);
          const pa = project(a), pc = project(c);
          const col = degraded(nd.m) ? C.coral : isLocal(nd.m) ? C.cyan : C.violet;
          const on = fid === nd.m.id || hoverId === nd.m.id;
          const dim = vis && !vis.has(nd.m.id) ? 0.3 : 1;
          const lg = g.createLinearGradient(pa.x, pa.y, pc.x, pc.y);
          lg.addColorStop(0, rgba(col, 0));
          lg.addColorStop(1, rgba(col, (on ? 0.6 : 0.22) * dim));
          g.strokeStyle = lg;
          g.lineWidth = on ? 1.3 : 1;
          g.setLineDash(degraded(nd.m) ? [3, 4] : []);
          strokeEdge(a, b, c);
          g.setLineDash([]);
        }
      } else {
        for (const nd of order) {
          const [a, b, c] = edgeOf(nd.p3);
          const bad = degraded(nd.m);
          const dimmed = vis && !vis.has(nd.m.id);
          const base = isLocal(nd.m) ? C.cyan : C.violet;
          const depth = clamp((nd.p.z + ORBIT_R) / (2 * ORBIT_R));
          let alpha = (0.18 + 0.27 * depth) * (dimmed ? 0.3 : 1);
          if (fid === nd.m.id || hoverId === nd.m.id) alpha = 0.8;
          g.setLineDash(bad ? [3, 5] : []);
          g.strokeStyle = rgba(bad ? C.coral : base, bad ? alpha * 0.9 : alpha);
          g.lineWidth = 1;
          strokeEdge(a, b, c);
          g.setLineDash([]);
          if (!bad && !dimmed && !reduced) {
            const k = (t * 0.12 + nd.m.id.length * 0.137) % 1;
            const q = project(bez(a, b, c, k));
            g.fillStyle = rgba(base, 0.45 * depth + 0.15);
            g.beginPath();
            g.arc(q.x, q.y, 1.3, 0, 7);
            g.fill();
          }
        }
      }

      /* ---- packets (computed up-front so node state is known) ---- */
      const hopState = new Map<string, 'fail' | 'ok'>();
      const drawPackets = () => {
        if (!pb || !res) return;
        hops.forEach((hop, i) => {
          const nd = nodes.find((x) => x.m.id === hop.id);
          if (!nd) return;
          const t0 = T_FLARE + i * T_HOP * 1.15;
          const k = reduced ? 1 : (el - t0) / T_HOP;
          if (k < 0) return;
          const [a, b, c] = edgeOf(nd.p3);
          if (k < 1) {
            const col = hop.ok ? C.cyan : C.coral;
            for (let j = 0; j < 8; j++) {
              const q = project(bez(a, b, c, clamp(ease(k) - j * 0.025)));
              g.fillStyle = rgba(col, (1 - j / 8) * 0.9);
              g.beginPath();
              g.arc(q.x, q.y, (orbit ? 3.2 : 2.6) - j * 0.25, 0, 7);
              g.fill();
            }
          } else {
            hopState.set(hop.id, hop.ok ? 'ok' : 'fail');
            if (hop.ok) {
              g.strokeStyle = rgba(C.cyan, 0.9 * fade);
              g.lineWidth = orbit ? 2.4 : 2;
              g.shadowColor = rgba(C.cyan, 0.35 * fade);
              g.shadowBlur = 8;
              strokeEdge(a, b, c);
              g.shadowBlur = 0;
              g.lineWidth = 1;
              const kb = reduced ? 1 : (k - 1) / 1.1;
              if (kb > 0 && kb < 1) {
                const q = project(bez(c, b, a, ease(kb)));
                g.fillStyle = rgba(C.mint, 0.95);
                g.beginPath();
                g.arc(q.x, q.y, orbit ? 3 : 2.4, 0, 7);
                g.fill();
              }
            }
          }
        });
      };

      /* ---- core ---- */
      const drawCore = () => {
        if (orbit) {
          drawLensCore(center.x, center.y, center.s * coreR, coreFlare, refused && pb ? fade : 0, coreR, cs, sn, tt, tint, t);
          return;
        }
        const glowR = center.s * coreR * 2.1;
        const grd = g.createRadialGradient(center.x, center.y, 0, center.x, center.y, glowR);
        const coreTint = refused && pb ? mix(C.violet, C.amber, fade) : C.violet;
        grd.addColorStop(0, rgba(coreTint, 0.1 + 0.12 * coreFlare));
        grd.addColorStop(0.45, rgba(C.cyan, 0.04 + 0.06 * coreFlare));
        grd.addColorStop(1, rgba(C.violet, 0));
        g.fillStyle = grd;
        g.fillRect(center.x - glowR, center.y - glowR, glowR * 2, glowR * 2);
        for (let i = 0; i < pts.length; i += 2) {
          const [px, py, pz] = pts[i];
          const p = project([(px * cs - pz * sn) * coreR, py * coreR, (px * sn + pz * cs) * coreR]);
          const front = clamp((p.z + coreR) / (2 * coreR));
          g.fillStyle = rgba(tint(mix(C.dim, C.violet, 0.3 + py * 0.3)), (0.06 + 0.2 * front) * (1 + coreFlare));
          const sz = (0.5 + front * 0.7) * (p.s / 130);
          g.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
        }
        drawRibbons(coreR, cs, sn, tt, coreFlare, tint, 1);
      };

      /* ---- nodes ---- */
      projected.clear();
      const placed: { x: number; y: number; w: number }[] = [];
      const drawNode = (nd: (typeof nodes)[number]) => {
        const { m, p } = nd;
        const bad = degraded(m);
        const base = isLocal(m) ? C.cyan : C.violet;
        const r = orbit ? (4.5 + m.capability_score * 3.5) * (p.s / 165) : (4 + m.capability_score * 6) * (p.s / 150);
        const rr = orbit ? r + 5.5 * (p.s / 165) : r; // gauge ring radius
        const isFocus = fid === m.id || hoverId === m.id;
        const dimmedByFilter = vis && !vis.has(m.id);
        const cand = res?.candidates.find((c) => c.model_id === m.id);
        const rejected = !!(pb && cand && !cand.passed);
        const state = hopState.get(m.id);
        const depth = clamp((p.z + ORBIT_R) / (2 * ORBIT_R));
        let alpha = orbit ? 0.78 + 0.22 * depth : 0.55 + 0.45 * depth;
        if (dimmedByFilter) alpha *= 0.25;
        if (rejected) alpha *= 1 - 0.6 * fade;
        projected.set(m.id, { x: p.x, y: p.y, r: Math.max(rr, 9), z: p.z });

        const ring = state === 'fail' ? C.coral : state === 'ok' ? C.mint : bad ? C.coral : base;
        const lit = state === 'ok' ? fade : isFocus ? 0.7 : 0;
        if (lit > 0 || state === 'fail') {
          const hr = orbit ? rr * (state === 'ok' ? 3.2 : 2.4) : r * (state === 'ok' ? 4.2 : 3);
          const hg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, hr);
          hg.addColorStop(0, rgba(ring, (orbit ? 0.3 : 0.22) * (lit || 0.8 * fade)));
          hg.addColorStop(1, rgba(ring, 0));
          g.fillStyle = hg;
          g.fillRect(p.x - hr, p.y - hr, hr * 2, hr * 2);
        }

        if (orbit) {
          // marker: soft halo, gauge ring whose arc fills to the capability score, solid core dot
          const col = state === 'fail' || bad ? C.coral : base;
          g.fillStyle = rgba(col, 0.045 * alpha);
          g.beginPath();
          g.arc(p.x, p.y, rr * 1.6, 0, 7);
          g.fill();
          g.lineWidth = 2;
          g.setLineDash(bad && !state ? [2.5, 3] : []);
          g.strokeStyle = rgba(col, 0.2 * alpha);
          g.beginPath();
          g.arc(p.x, p.y, rr, 0, 7);
          g.stroke();
          g.setLineDash([]);
          g.lineCap = 'round';
          g.strokeStyle = rgba(col, 0.95 * alpha);
          g.beginPath();
          g.arc(p.x, p.y, rr, -Math.PI / 2, -Math.PI / 2 + m.capability_score * Math.PI * 2);
          g.stroke();
          g.lineCap = 'butt';
          g.beginPath();
          g.arc(p.x, p.y, r * 0.7, 0, 7);
          g.fillStyle = rgba(col, alpha);
          g.fill();
          g.lineWidth = 1.5;
          g.strokeStyle = rgba(C.paper, alpha);
          g.stroke();
          if (state === 'ok' || isFocus) {
            g.lineWidth = 1.2;
            g.strokeStyle = rgba(state === 'ok' ? C.mint : col, state === 'ok' ? 0.9 * fade : 0.7);
            g.beginPath();
            g.arc(p.x, p.y, rr + 4.5, 0, 7);
            g.stroke();
          }
        } else {
          g.beginPath();
          g.arc(p.x, p.y, r, 0, 7);
          g.fillStyle = rgba(C.paper, 0.96);
          g.fill();
          g.lineWidth = isFocus || state ? 1.8 : 1.2;
          g.strokeStyle = rgba(ring, alpha);
          g.stroke();
          g.beginPath();
          g.arc(p.x, p.y, Math.max(1.4, r * 0.32), 0, 7);
          g.fillStyle = rgba(bad || state === 'fail' ? C.coral : state === 'ok' ? C.mint : base, alpha);
          g.fill();
        }

        if (rejected && fade > 0.05) {
          g.strokeStyle = rgba(C.coral, 0.85 * fade);
          g.lineWidth = 1.6;
          const s = Math.min(r * 0.9, 7);
          const ox = p.x + rr + 3, oy = p.y - rr * 0.6;
          g.beginPath();
          g.moveTo(ox, oy - s / 2);
          g.lineTo(ox + s, oy + s / 2);
          g.moveTo(ox + s, oy - s / 2);
          g.lineTo(ox, oy + s / 2);
          g.stroke();
        }

        if (orbit && ((lab === 'all' && w >= 520 && depth > 0.3) || isFocus || state)) {
          const calls = m.telemetry?.requests ?? 0;
          const main = m.id;
          const extra = calls > 0 ? `${calls}` : '';
          g.font = '500 11.5px "IBM Plex Mono", ui-monospace, monospace';
          const mw = g.measureText(main).width;
          const ew = extra ? g.measureText(extra).width + 8 : 0;
          const tw = 18 + mw + ew + 9;
          const th = 21;
          let lx = clamp(p.x - tw / 2, 4, w - tw - 4);
          let ly = p.y - rr - 12 - th;
          for (let k = 0; k < 5 && placed.some((b) => Math.abs(b.y - ly) < th + 3 && lx < b.x + b.w + 4 && lx + tw + 4 > b.x); k++) ly -= th + 4;
          placed.push({ x: lx, y: ly, w: tw });
          const a = (isFocus || state ? 1 : 0.55 + 0.45 * depth) * (dimmedByFilter ? 0.35 : 1) * (rejected ? 1 - 0.5 * fade : 1);
          // leader
          g.strokeStyle = rgba(C.dim, 0.35 * a);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(p.x, p.y - rr - 3);
          g.lineTo(clamp(p.x, lx + 8, lx + tw - 8), ly + th);
          g.stroke();
          // tag
          pill(lx, ly, tw, th);
          g.fillStyle = `rgba(255,255,255,${0.92 * a})`;
          g.fill();
          g.strokeStyle = isFocus || state === 'ok' ? rgba(state === 'ok' ? C.mint : base, 0.7 * a) : rgba(C.text, 0.12 * a);
          g.stroke();
          g.beginPath();
          g.arc(lx + 10, ly + th / 2, 3, 0, 7);
          g.fillStyle = rgba(bad || state === 'fail' ? C.coral : C.mint, a);
          g.fill();
          g.textBaseline = 'middle';
          g.textAlign = 'left';
          g.fillStyle = rgba(C.text, 0.92 * a);
          g.fillText(main, lx + 18, ly + th / 2 + 0.5);
          if (extra) {
            g.fillStyle = rgba(C.dim, 0.75 * a);
            g.fillText(extra, lx + 18 + mw + 8, ly + th / 2 + 0.5);
          }
        } else if (!orbit && ((lab === 'all' && w >= 520 && depth > 0.42) || isFocus || state)) {
          g.font = `500 ${Math.round(10.5 + depth * 1.5)}px "IBM Plex Mono", ui-monospace, monospace`;
          g.fillStyle = rgba(state === 'ok' || isFocus ? C.text : C.dim, (isFocus || state ? 1 : 0.6 + 0.4 * depth) * (dimmedByFilter ? 0.4 : 1));
          g.textBaseline = 'middle';
          g.textAlign = 'left';
          const tw = g.measureText(m.id).width;
          const gap = r + 8 + (rejected && fade > 0.05 ? r + 6 : 0); // clear the rejection ×
          let lx = p.x < w / 2 ? p.x - r - 8 - tw : p.x + gap;
          let ly = p.y;
          if (lx < 4 || lx + tw > w - 4) {
            lx = clamp(p.x - tw / 2, 4, w - tw - 4);
            ly = p.y + r + 11;
          }
          for (let k = 0; k < 4 && placed.some((b) => Math.abs(b.y - ly) < 13 && lx < b.x + b.w && lx + tw > b.x); k++) ly += 13;
          placed.push({ x: lx, y: ly, w: tw });
          g.fillText(m.id, lx, ly);
        }
      };

      if (orbit) {
        // depth-correct: models behind the core first, then the core, then the rest
        const behind = order.filter((nd) => nd.p.z < center.z - 0.05);
        const front = order.filter((nd) => nd.p.z >= center.z - 0.05);
        // decide hop states before drawing any node
        drawPacketsStateOnly();
        behind.forEach(drawNode);
        drawCore();
        drawPackets();
        front.forEach(drawNode);
      } else {
        drawCore();
        drawPackets();
        order.forEach(drawNode);
      }

      function drawPacketsStateOnly() {
        if (!pb || !res) return;
        hops.forEach((hop, i) => {
          const k = reduced ? 1 : (el - (T_FLARE + i * T_HOP * 1.15)) / T_HOP;
          if (k >= 1) hopState.set(hop.id, hop.ok ? 'ok' : 'fail');
        });
      }
    }

    const loop = (now: number) => {
      if (visible) draw(now);
      raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting && !document.hidden));
    io.observe(wrap);
    const vis = () => (visible = !document.hidden);
    document.addEventListener('visibilitychange', vis);

    if (reduced) draw(performance.now());
    else raf = requestAnimationFrame(loop);

    const off = routeBus.on(({ result }) => {
      playback = { result, start: performance.now() };
      if (reduced) draw(performance.now());
    });

    // pointer: the view only moves while pressed. Hover shows the card; click selects.
    const hit = (x: number, y: number) => {
      let best: string | null = null;
      let bz = -Infinity;
      projected.forEach((p, id) => {
        if (Math.hypot(p.x - x, p.y - y) <= p.r + 6 && p.z > bz) { best = id; bz = p.z; }
      });
      return best as string | null;
    };
    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const setHoverId = (id: string | null) => {
      if (id === live.current.hoverId) return;
      live.current.hoverId = id;
      if (reduced) draw(performance.now());
    };
    const onMove = (e: PointerEvent) => {
      const { x, y } = local(e);
      if (dragging) {
        const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
        if (!dragging.moved && Math.hypot(dx, dy) > 4) {
          dragging.moved = true;
          canvas.style.cursor = 'grabbing';
          setHoverId(null);
          setHover(null);
        }
        if (dragging.moved) {
          const now = performance.now();
          const nextRot = dragging.rot + dx * 0.006;
          spinV = (nextRot - rot) / Math.max(8, now - dragging.lt);
          dragging.lt = now;
          rot = nextRot;
          tilt = clamp(dragging.tilt + dy * 0.004, 0.05, orbit ? 0.75 : 1.0);
          if (reduced) draw(now);
        }
        return;
      }
      const id = hit(x, y);
      setHoverId(id);
      canvas.style.cursor = id ? 'pointer' : 'grab';
      setHover(id ? { id, x, y } : null);
    };
    const onLeave = () => {
      if (dragging) return;
      setHoverId(null);
      setHover(null);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
      spinV = 0;
      dragging = { x: e.clientX, y: e.clientY, lt: performance.now(), rot, tilt, moved: false };
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      const moved = dragging.moved;
      dragging = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
      canvas.style.cursor = 'grab';
      if (reduced) spinV = 0;
      if (moved) return;
      spinV = 0;
      const { x, y } = local(e);
      const id = hit(x, y);
      if (id) live.current.onSelect?.(id);
    };
    const onWheel = (e: WheelEvent) => {
      if (!interactive) return;
      e.preventDefault();
      userZoom = clamp(userZoom * (e.deltaY > 0 ? 0.92 : 1.08), 0.6, 1.9);
      if (reduced) draw(performance.now());
    };
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    ctl.current = {
      redraw: () => draw(performance.now()),
      zoomBy: (f: number) => {
        userZoom = clamp(f === 0 ? 1 : userZoom * f, 0.6, 1.9);
        if (f === 0) { rot = 0.6; tilt = orbit ? 0.32 : 0.5; spinV = 0; }
        if (reduced) draw(performance.now());
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      off();
      document.removeEventListener('visibilitychange', vis);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
    // The loop reads props through `live`; only remount on motion preference / density / variant.
  }, [reduced, density, interactive, orbit]);

  // Reduced motion has no loop: redraw the static frame when data changes.
  useEffect(() => {
    if (reduced) ctl.current.redraw();
  }, [reduced, models, focusId, visibleIds]);

  const hm = hover && models.find((m) => m.id === hover.id);
  const zoomBy = (f: number) => ctl.current.zoomBy(f);

  return (
    <div ref={wrapRef} className={`net ${orbit ? 'net-orbit' : ''} ${className ?? ''}`} role="img" aria-label={ariaLabel ?? `Routing network with ${models.length} model endpoints`}>
      <canvas ref={canvasRef} />
      {interactive && (
        <div className="net-zoom" role="group" aria-label="Network zoom">
          <button className="icon-btn" onClick={() => zoomBy(1.15)} aria-label="Zoom in">+</button>
          <button className="icon-btn" onClick={() => zoomBy(1 / 1.15)} aria-label="Zoom out">−</button>
          <button className="icon-btn" onClick={() => zoomBy(0)} aria-label="Reset view">⟲</button>
        </div>
      )}
      {hm && hover && (
        <div className="net-tip" style={{ left: Math.min(hover.x, (wrapRef.current?.clientWidth ?? 9999) - 250), top: hover.y }}>
          <div className="net-tip-title">{hm.name}</div>
          <div className="kv"><span>endpoint</span><b>{isLocal(hm) ? 'Local GGUF' : `Hosted · ${hm.api_provider ?? hm.family}`}</b></div>
          <div className="kv"><span>context</span><b>{ctx(hm.context_window)}</b></div>
          <div className="kv"><span>latency</span><b>{hm.telemetry.p95_latency_ms ? `p95 ${ms(hm.telemetry.p95_latency_ms)}` : `base ${ms(hm.base_latency_ms)}`}</b></div>
          <div className="kv"><span>capability</span><b>{hm.capability_score.toFixed(2)}</b></div>
          <div className="kv"><span>calls served</span><b>{hm.telemetry.requests}</b></div>
          <div className="kv"><span>circuit</span><b className={degraded(hm) ? 't-coral' : 't-mint'}>{hm.circuit_breaker.state}{hm.chaos.kill_switch ? ' · killed' : ''}</b></div>
        </div>
      )}
    </div>
  );
}
