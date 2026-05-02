'use client';

import { useEffect, useRef } from 'react';

// ── Tune these constants ──────────────────────────────────────────────────────
const ACCENT      = { r: 255, g: 140, b: 42  };  // light orange  (secondary colour)
const BURNT       = { r: 180, g:  60, b:  0  };  // burnt orange  (tertiary colour)
const EYE_OPACITY = 0.90;   // 0–1 eye visibility
const TARGET_FPS  = 30;     // frame cap for performance
const BLINK_CYCLE = 150;    // ticks between blinks  (5 s at 30 fps)
const BLINK_CLOSE = 118;    // tick within cycle when eyelid starts closing
//   close phase: ticks 118–132 (14 ticks = 0.47 s)
//   open  phase: ticks 132–146 (14 ticks = 0.47 s)
//   eye fully closed: ticks 132 only (instant snap)
// ─────────────────────────────────────────────────────────────────────────────

/** Eight gaze positions the pupil cycles through between blinks */
const GAZE_TARGETS = [
  { x:  0.60, y:  0.00 },   // right
  { x: -0.60, y:  0.00 },   // left
  { x:  0.00, y: -0.45 },   // up
  { x:  0.50, y:  0.35 },   // right-down
  { x: -0.50, y: -0.35 },   // left-up
  { x:  0.00, y:  0.00 },   // centre (rest)
  { x:  0.55, y: -0.28 },   // right-up
  { x: -0.55, y:  0.28 },   // left-down
];

/** Traces the almond eye-shape as a closed bezier path. */
function traceLens(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  hw: number, hh: number,
) {
  ctx.moveTo(cx - hw, cy);
  ctx.bezierCurveTo(cx - hw * 0.40, cy - hh * 1.20, cx + hw * 0.40, cy - hh * 1.20, cx + hw, cy);
  ctx.bezierCurveTo(cx + hw * 0.40, cy + hh * 0.80, cx - hw * 0.40, cy + hh * 0.80, cx - hw, cy);
  ctx.closePath();
}

export default function CyclopsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf  = 0;
    let tick = 0;
    let last = 0;
    const MS = 1000 / TARGET_FPS;

    // ── Gaze state — persisted across frames ────────────────────────────────
    let gazeX           = 0;   // current (lerped) pupil X
    let gazeY           = 0;   // current (lerped) pupil Y
    let targetGazeX     = 0;   // gaze destination X
    let targetGazeY     = 0;   // gaze destination Y
    let gazeInitialized = false;
    let lastCycleIndex  = -1;

    // Accent colour helpers
    const a = (op: number) =>
      `rgba(${ACCENT.r},${ACCENT.g},${ACCENT.b},${Math.min(Math.max(op, 0), 1)})`;
    const b = (op: number) =>
      `rgba(${BURNT.r},${BURNT.g},${BURNT.b},${Math.min(Math.max(op, 0), 1)})`;

    function renderFrame(t: number) {
      try {
        const w  = canvas.width;
        const h  = canvas.height;
        if (w < 2 || h < 2) return;

        const cx = w * 0.5;
        const cy = h * 0.5;

        // Initialise gaze to canvas centre on first frame / after resize
        if (!gazeInitialized) {
          gazeX = cx; gazeY = cy;
          targetGazeX = cx; targetGazeY = cy;
          gazeInitialized = true;
        }

        // Eye geometry
        const hw     = Math.min(w * 0.32, 420);
        const hh     = Math.max(hw * 0.38, 1);
        const irisR  = Math.max(hh * 0.82, 2);
        const pupilR = Math.max(irisR * 0.36, 1);
        const drift  = (irisR - pupilR) * 0.70;   // max pupil travel radius

        // ── Blink + gaze cycle (every BLINK_CYCLE ticks = 5 s) ──────────────
        const phase      = t % BLINK_CYCLE;
        const cycleIndex = Math.floor(t / BLINK_CYCLE);

        // At the start of every new 5-second cycle, pick the next gaze target
        if (cycleIndex !== lastCycleIndex) {
          lastCycleIndex = cycleIndex;
          const tgt = GAZE_TARGETS[cycleIndex % GAZE_TARGETS.length];
          targetGazeX = cx + tgt.x * drift;
          targetGazeY = cy + tgt.y * drift;
        }

        // Smooth lerp toward gaze target (snappy at start, slows to a hold)
        gazeX += (targetGazeX - gazeX) * 0.10;
        gazeY += (targetGazeY - gazeY) * 0.10;
        const px = gazeX;
        const py = gazeY;

        // Blink eyelid factor: 1 = fully open, 0 = fully closed
        const HALF_BLINK = (BLINK_CYCLE - BLINK_CLOSE) / 2; // 16 ticks each side
        let blinkFactor = 1;
        if (phase >= BLINK_CLOSE) {
          const bp = phase - BLINK_CLOSE;
          blinkFactor = bp < HALF_BLINK
            ? 1 - bp / HALF_BLINK          // eyelid closing
            : (bp - HALF_BLINK) / HALF_BLINK; // eyelid opening
          blinkFactor = Math.max(0.01, blinkFactor);
        }
        const effHh = hh * blinkFactor;   // eye height collapses during blink

        // ── Draw ────────────────────────────────────────────────────────────
        ctx.clearRect(0, 0, w, h);

        // 1. Wide warm ambient halo
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, hw * 2.2 || 1);
        halo.addColorStop(0,   a(0.16));
        halo.addColorStop(0.4, a(0.06));
        halo.addColorStop(1,   a(0));
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.globalAlpha = EYE_OPACITY;

        // 2. Clip all internals to the lens shape (uses effHh for blink squint)
        ctx.save();
        ctx.beginPath();
        traceLens(ctx, cx, cy, hw, effHh);
        ctx.clip();

        // Sclera — warm peach-cream gradient for depth
        const scleraG = ctx.createRadialGradient(cx, cy, 0, cx, cy, hw);
        scleraG.addColorStop(0,   'rgb(255, 248, 235)');
        scleraG.addColorStop(0.6, 'rgb(255, 235, 210)');
        scleraG.addColorStop(1,   'rgb(245, 215, 185)');
        ctx.fillStyle = scleraG;
        ctx.fillRect(0, 0, w, h);

        // Iris — gold centre → light orange → burnt orange → deep warm brown
        const ig = ctx.createRadialGradient(px, py, 0, px, py, irisR);
        ig.addColorStop(0,    'rgb(255, 210, 130)');   // warm gold centre
        ig.addColorStop(0.20, 'rgb(255, 155,  55)');   // light orange
        ig.addColorStop(0.50, 'rgb(200,  78,   8)');   // burnt orange
        ig.addColorStop(0.80, 'rgb(130,  38,   4)');   // deep orange-brown
        ig.addColorStop(1,    'rgba(70,  18,   0, 0.15)');
        ctx.fillStyle = ig;
        ctx.beginPath();
        ctx.arc(px, py, irisR, 0, Math.PI * 2);
        ctx.fill();

        // Iris concentric rings
        for (let i = 1; i <= 8; i++) {
          ctx.beginPath();
          ctx.arc(px, py, irisR * (i / 8), 0, Math.PI * 2);
          ctx.strokeStyle = b(i % 4 === 0 ? 0.28 : 0.10);
          ctx.lineWidth   = i % 4 === 0 ? 1.0 : 0.5;
          ctx.stroke();
        }

        // Iris fiber texture (radial stroma lines)
        for (let i = 0; i < 36; i++) {
          const ang = (i / 36) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(ang) * irisR * 0.28, py + Math.sin(ang) * irisR * 0.28);
          ctx.lineTo(px + Math.cos(ang) * irisR * 0.96, py + Math.sin(ang) * irisR * 0.96);
          ctx.strokeStyle = b(0.07);
          ctx.lineWidth   = 0.4;
          ctx.stroke();
        }

        // Slow-rotating scan spokes
        const rot = t * 0.004;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * irisR * 0.30, Math.sin(ang) * irisR * 0.30);
          ctx.lineTo(Math.cos(ang) * irisR * 0.94, Math.sin(ang) * irisR * 0.94);
          ctx.strokeStyle = a(0.12);
          ctx.lineWidth   = 0.8;
          ctx.stroke();
        }
        ctx.restore();

        // Pupil soft penumbra
        const pg = ctx.createRadialGradient(px, py, 0, px, py, pupilR * 1.8);
        pg.addColorStop(0,    'rgba(0,0,0,1)');
        pg.addColorStop(0.55, 'rgba(0,0,0,0.80)');
        pg.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(px, py, pupilR * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Pupil core
        ctx.fillStyle = 'rgb(10, 4, 0)';
        ctx.beginPath();
        ctx.arc(px, py, pupilR, 0, Math.PI * 2);
        ctx.fill();

        // Specular highlights (glass-like depth)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
        ctx.beginPath();
        ctx.arc(px - pupilR * 0.30, py - pupilR * 0.30, pupilR * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(px + pupilR * 0.22, py + pupilR * 0.24, pupilR * 0.09, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // end lens clip

        // Eyelid edge stroke — light orange (secondary colour)
        ctx.beginPath();
        traceLens(ctx, cx, cy, hw, effHh);
        ctx.strokeStyle = a(0.72);
        ctx.lineWidth   = 2.5;
        ctx.stroke();

        // Outer glow halo around eyelids
        ctx.beginPath();
        traceLens(ctx, cx, cy, hw * 1.05, effHh * 1.14);
        ctx.strokeStyle = a(0.20);
        ctx.lineWidth   = 11;
        ctx.stroke();

        // Pulsing iris glow (~6 s breathe cycle)
        const pulse = 1 + Math.sin(t * 0.008) * 0.07;
        const gr    = Math.max(irisR * 1.25 * pulse, irisR * 0.5 + 1);
        const gg    = ctx.createRadialGradient(px, py, irisR * 0.4, px, py, gr);
        gg.addColorStop(0,   a(0.20));
        gg.addColorStop(0.5, a(0.07));
        gg.addColorStop(1,   a(0));
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(px, py, gr, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // end globalAlpha

      } catch (err) {
        // Canvas errors are non-fatal — background is purely decorative
        if (process.env.NODE_ENV !== 'production') console.warn('[CyclopsBackground]', err);
      }
    }

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      gazeInitialized = false;   // re-centre gaze after resize
      renderFrame(tick);
    }
    resize();
    window.addEventListener('resize', resize);

    // Draw one static frame immediately (visible even without animation)
    renderFrame(0);

    if (!prefersReduced) {
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (now - last < MS) return;
        last = now;
        tick++;
        renderFrame(tick);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      'fixed',
        inset:         0,
        zIndex:        0,
        pointerEvents: 'none',
        // Warm orange outer halo around all visible canvas pixels
        filter: 'drop-shadow(0 0 50px rgba(255, 140, 42, 0.32))',
      }}
    />
  );
}
