'use client';

import { useEffect, useRef } from 'react';

// ── Tune these constants to adjust the look ───────────────────────────────────
const ACCENT      = { r: 0, g: 255, b: 136 };  // neon green — RGB values
const SPEED       = 0.32;  // overall animation speed (lower = slower scanning)
const EYE_OPACITY = 0.62;  // how visible the eye is (0–1). 0.5 = medium, 0.8 = vivid
const TARGET_FPS  = 30;    // cap for performance on mid-range hardware
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Traces the almond / lens eye-shape path using two bezier curves.
 * hw = half-width (center → left/right corner)
 * hh = half-height (center → top/bottom arc apex)
 */
function traceLens(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  hw: number, hh: number,
) {
  ctx.moveTo(cx - hw, cy);
  // Upper lid — arched
  ctx.bezierCurveTo(
    cx - hw * 0.42, cy - hh * 1.18,
    cx + hw * 0.42, cy - hh * 1.18,
    cx + hw, cy,
  );
  // Lower lid — flatter
  ctx.bezierCurveTo(
    cx + hw * 0.42, cy + hh * 0.82,
    cx - hw * 0.42, cy + hh * 0.82,
    cx - hw, cy,
  );
  ctx.closePath();
}

export default function CyclopsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf  = 0;
    let tick = 0;
    let last = 0;
    const MS = 1000 / TARGET_FPS;

    function resize() {
      canvas!.width  = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Shorthand for accent color at given opacity
    const a = (op: number) =>
      `rgba(${ACCENT.r},${ACCENT.g},${ACCENT.b},${Math.min(Math.max(op, 0), 1)})`;

    function draw(now: number) {
      raf = requestAnimationFrame(draw);
      if (now - last < MS) return;
      last = now;
      tick++;

      const t  = tick * SPEED;
      const w  = canvas!.width;
      const h  = canvas!.height;
      const cx = w * 0.5;
      const cy = h * 0.5;

      // ── Eye geometry — scales with viewport ──────────────────────────────
      // hw: half-width of the eye (cornea-to-corner). Cap at 360px on large screens.
      const hw = Math.min(w * 0.29, 360);
      // hh: half-height. Ratio ~0.38 mirrors a realistic eye proportion.
      const hh = hw * 0.38;
      // Iris radius sits inside the eye height.
      const irisR = hh * 0.80;
      // Pupil radius
      const pupilR = irisR * 0.38;

      // ── Pupil scan path (Lissajous — incommensurate freqs = non-repeating) ─
      // Adjust the multipliers to change scan speed and range.
      const drift  = (irisR - pupilR) * 0.58;
      const px     = cx + Math.sin(t * 0.009)          * drift;
      const py     = cy + Math.sin(t * 0.0062 + 1.35)  * drift * 0.52;

      ctx!.clearRect(0, 0, w, h);

      // ── 1. Soft ambient glow around the eye (bleeds past eyelids) ────────
      const ambient = ctx!.createRadialGradient(cx, cy, 0, cx, cy, hw * 1.6);
      ambient.addColorStop(0,   a(0.09));
      ambient.addColorStop(0.4, a(0.03));
      ambient.addColorStop(1,   a(0));
      ctx!.fillStyle = ambient;
      ctx!.fillRect(0, 0, w, h);

      // ── 2. Everything inside the eye shape at EYE_OPACITY ────────────────
      ctx!.save();
      ctx!.globalAlpha = EYE_OPACITY;

      // ── 3. Clip to lens shape ─────────────────────────────────────────────
      ctx!.save();
      ctx!.beginPath();
      traceLens(ctx!, cx, cy, hw, hh);
      ctx!.clip();

      // Sclera — very dark navy, not pure black, gives depth
      ctx!.fillStyle = 'rgba(3, 8, 16, 0.97)';
      ctx!.fillRect(0, 0, w, h);

      // ── Iris base radial gradient ─────────────────────────────────────────
      const ig = ctx!.createRadialGradient(px, py, 0, px, py, irisR);
      ig.addColorStop(0,    'rgba(0, 190, 105, 0.95)');
      ig.addColorStop(0.28, 'rgba(0, 130,  72, 0.82)');
      ig.addColorStop(0.60, 'rgba(0,  72,  40, 0.58)');
      ig.addColorStop(1,    'rgba(0,  22,  12, 0.08)');
      ctx!.fillStyle = ig;
      ctx!.beginPath();
      ctx!.arc(px, py, irisR, 0, Math.PI * 2);
      ctx!.fill();

      // ── Iris concentric rings ─────────────────────────────────────────────
      for (let i = 1; i <= 8; i++) {
        ctx!.beginPath();
        ctx!.arc(px, py, irisR * (i / 8), 0, Math.PI * 2);
        // Every 4th ring slightly brighter — creates banding
        ctx!.strokeStyle = a(i % 4 === 0 ? 0.16 : 0.07);
        ctx!.lineWidth   = i % 4 === 0 ? 0.9 : 0.4;
        ctx!.stroke();
      }

      // ── Iris fiber texture (radial lines like real iris stroma) ──────────
      for (let i = 0; i < 36; i++) {
        const ang = (i / 36) * Math.PI * 2;
        ctx!.beginPath();
        ctx!.moveTo(px + Math.cos(ang) * irisR * 0.30, py + Math.sin(ang) * irisR * 0.30);
        ctx!.lineTo(px + Math.cos(ang) * irisR * 0.96, py + Math.sin(ang) * irisR * 0.96);
        ctx!.strokeStyle = a(0.04);
        ctx!.lineWidth   = 0.4;
        ctx!.stroke();
      }

      // ── Slow-rotating scan spokes from iris center ────────────────────────
      // Full rotation ≈ every 5 min at default SPEED. Gives "active scanning" feel.
      const rot = t * 0.0038;
      ctx!.save();
      ctx!.translate(px, py);
      ctx!.rotate(rot);
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        ctx!.beginPath();
        ctx!.moveTo(Math.cos(ang) * irisR * 0.32, Math.sin(ang) * irisR * 0.32);
        ctx!.lineTo(Math.cos(ang) * irisR * 0.92, Math.sin(ang) * irisR * 0.92);
        ctx!.strokeStyle = a(0.10);
        ctx!.lineWidth   = 0.7;
        ctx!.stroke();
      }
      ctx!.restore();

      // ── Pupil penumbra (soft edge) ────────────────────────────────────────
      const pGlow = ctx!.createRadialGradient(px, py, 0, px, py, pupilR * 1.7);
      pGlow.addColorStop(0,   'rgba(0,0,0,1)');
      pGlow.addColorStop(0.55,'rgba(0,0,0,0.75)');
      pGlow.addColorStop(1,   'rgba(0,0,0,0)');
      ctx!.fillStyle = pGlow;
      ctx!.beginPath();
      ctx!.arc(px, py, pupilR * 1.7, 0, Math.PI * 2);
      ctx!.fill();

      // ── Pupil core ────────────────────────────────────────────────────────
      ctx!.fillStyle = 'rgba(0, 1, 4, 1)';
      ctx!.beginPath();
      ctx!.arc(px, py, pupilR, 0, Math.PI * 2);
      ctx!.fill();

      // ── Specular highlights (gives the pupil glass-like depth) ───────────
      ctx!.fillStyle = a(0.32);
      ctx!.beginPath();
      ctx!.arc(px - pupilR * 0.30, py - pupilR * 0.30, pupilR * 0.14, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = a(0.12);
      ctx!.beginPath();
      ctx!.arc(px + pupilR * 0.20, py + pupilR * 0.22, pupilR * 0.07, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.restore(); // end clip

      // ── Eyelid edge stroke ────────────────────────────────────────────────
      ctx!.beginPath();
      traceLens(ctx!, cx, cy, hw, hh);
      ctx!.strokeStyle = a(0.45);
      ctx!.lineWidth   = 1.8;
      ctx!.stroke();

      // ── Outer halo glow around eyelids ────────────────────────────────────
      ctx!.beginPath();
      traceLens(ctx!, cx, cy, hw * 1.04, hh * 1.12);
      ctx!.strokeStyle = a(0.10);
      ctx!.lineWidth   = 7;
      ctx!.stroke();

      // ── Pulsing iris glow (slow breathe, ~7s period) ─────────────────────
      const pulse  = 1 + Math.sin(t * 0.007) * 0.07;
      const glowR  = irisR * 1.2 * pulse;
      const iGlow  = ctx!.createRadialGradient(px, py, irisR * 0.45, px, py, glowR);
      iGlow.addColorStop(0,   a(0.16));
      iGlow.addColorStop(0.5, a(0.05));
      iGlow.addColorStop(1,   a(0));
      ctx!.fillStyle = iGlow;
      ctx!.beginPath();
      ctx!.arc(px, py, glowR, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.restore(); // end globalAlpha
    }

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
