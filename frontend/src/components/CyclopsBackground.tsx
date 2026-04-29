'use client';

import { useEffect, useRef } from 'react';

// ── Tune these constants ──────────────────────────────────────────────────────
const ACCENT      = { r: 0, g: 255, b: 136 };  // neon green (RGB)
const SPEED       = 0.28;   // scan speed — lower = slower pupil movement
const EYE_OPACITY = 0.82;   // 0–1 eye visibility (0.5 = subtle, 1.0 = full)
const TARGET_FPS  = 30;     // frame cap for performance
// ─────────────────────────────────────────────────────────────────────────────

/** Traces the almond eye-shape as a closed bezier path. Caller must beginPath() first. */
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

    // Accent color helper
    const a = (op: number) =>
      `rgba(${ACCENT.r},${ACCENT.g},${ACCENT.b},${Math.min(Math.max(op, 0), 1)})`;

    // Wrap every draw call in try/catch — the background is decorative and must
    // never crash the application.
    function renderFrame(t: number) {
      try {
        const w  = canvas.width;
        const h  = canvas.height;
        // Skip draw if canvas has zero dimensions (can happen briefly on init)
        if (w < 2 || h < 2) return;

        const cx = w * 0.5;
        const cy = h * 0.5;

        // Eye geometry — scales with viewport, capped for large screens
        const hw     = Math.min(w * 0.32, 420);       // half-width of eye
        const hh     = Math.max(hw * 0.38, 1);         // half-height
        const irisR  = Math.max(hh * 0.82, 2);         // iris radius
        const pupilR = Math.max(irisR * 0.36, 1);      // pupil radius

        // Pupil scan path: Lissajous figure-8 (two incommensurate frequencies)
        const drift = (irisR - pupilR) * 0.55;
        const px    = cx + Math.sin(t * 0.009)        * drift;
        const py    = cy + Math.sin(t * 0.006 + 1.35) * drift * 0.50;

        ctx.clearRect(0, 0, w, h);

        // 1. Wide ambient halo that bleeds past the eyelids
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, hw * 2.0 || 1);
        halo.addColorStop(0,   a(0.18));
        halo.addColorStop(0.4, a(0.06));
        halo.addColorStop(1,   a(0));
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);

        // 2. All eye internals drawn at EYE_OPACITY
        ctx.save();
        ctx.globalAlpha = EYE_OPACITY;

        // 3. Clip drawing to the lens shape
        ctx.save();
        ctx.beginPath();
        traceLens(ctx, cx, cy, hw, hh);
        ctx.clip();

        // Sclera — deep navy, clearly distinct from the near-black page background
        ctx.fillStyle = 'rgb(4, 13, 28)';
        ctx.fillRect(0, 0, w, h);

        // Iris radial gradient: bright neon green at center, fading to dark edge
        const ig = ctx.createRadialGradient(px, py, 0, px, py, irisR);
        ig.addColorStop(0,    `rgb(0, 255, 136)`);
        ig.addColorStop(0.25, `rgba(0, 210, 105, 0.92)`);
        ig.addColorStop(0.55, `rgba(0, 130,  62, 0.72)`);
        ig.addColorStop(0.85, `rgba(0,  55,  28, 0.40)`);
        ig.addColorStop(1,    `rgba(0,  18,   9, 0.05)`);
        ctx.fillStyle = ig;
        ctx.beginPath();
        ctx.arc(px, py, irisR, 0, Math.PI * 2);
        ctx.fill();

        // Iris concentric rings
        for (let i = 1; i <= 8; i++) {
          ctx.beginPath();
          ctx.arc(px, py, irisR * (i / 8), 0, Math.PI * 2);
          ctx.strokeStyle = a(i % 4 === 0 ? 0.30 : 0.12);
          ctx.lineWidth   = i % 4 === 0 ? 1.0 : 0.5;
          ctx.stroke();
        }

        // Iris fiber texture (radial lines like real stroma)
        for (let i = 0; i < 36; i++) {
          const ang = (i / 36) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(ang) * irisR * 0.28, py + Math.sin(ang) * irisR * 0.28);
          ctx.lineTo(px + Math.cos(ang) * irisR * 0.96, py + Math.sin(ang) * irisR * 0.96);
          ctx.strokeStyle = a(0.07);
          ctx.lineWidth   = 0.4;
          ctx.stroke();
        }

        // Slow-rotating scan spokes — full rotation ~5 min at default SPEED
        const rot = t * 0.004;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * irisR * 0.30, Math.sin(ang) * irisR * 0.30);
          ctx.lineTo(Math.cos(ang) * irisR * 0.94, Math.sin(ang) * irisR * 0.94);
          ctx.strokeStyle = a(0.14);
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
        ctx.fillStyle = 'rgb(0, 1, 3)';
        ctx.beginPath();
        ctx.arc(px, py, pupilR, 0, Math.PI * 2);
        ctx.fill();

        // Specular highlights (glass-like depth on pupil)
        ctx.fillStyle = a(0.45);
        ctx.beginPath();
        ctx.arc(px - pupilR * 0.30, py - pupilR * 0.30, pupilR * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = a(0.18);
        ctx.beginPath();
        ctx.arc(px + pupilR * 0.22, py + pupilR * 0.24, pupilR * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // end lens clip

        // Eyelid edge stroke
        ctx.beginPath();
        traceLens(ctx, cx, cy, hw, hh);
        ctx.strokeStyle = a(0.55);
        ctx.lineWidth   = 2.0;
        ctx.stroke();

        // Outer glow halo around eyelids
        ctx.beginPath();
        traceLens(ctx, cx, cy, hw * 1.05, hh * 1.14);
        ctx.strokeStyle = a(0.15);
        ctx.lineWidth   = 9;
        ctx.stroke();

        // Pulsing iris glow (~6s breathe cycle)
        const pulse = 1 + Math.sin(t * 0.008) * 0.07;
        const gr    = Math.max(irisR * 1.25 * pulse, irisR * 0.5 + 1);
        const gg    = ctx.createRadialGradient(px, py, irisR * 0.4, px, py, gr);
        gg.addColorStop(0,   a(0.22));
        gg.addColorStop(0.5, a(0.07));
        gg.addColorStop(1,   a(0));
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(px, py, gr, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // end globalAlpha

      } catch (err) {
        // Canvas errors are non-fatal — background is decorative only
        if (process.env.NODE_ENV !== 'production') console.warn('[CyclopsBackground]', err);
      }
    }

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      renderFrame(tick);
    }
    resize();
    window.addEventListener('resize', resize);

    // Always draw one static frame immediately (visible even if animation is off)
    renderFrame(0);

    // Start animation loop unless user prefers reduced motion
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
        // CSS filter adds a green outer halo around all visible canvas pixels
        filter: 'drop-shadow(0 0 40px rgba(0, 255, 136, 0.28))',
      }}
    />
  );
}
