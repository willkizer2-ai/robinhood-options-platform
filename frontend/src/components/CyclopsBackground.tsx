'use client';

import { useEffect, useRef } from 'react';

// ── Tune these values to adjust the effect ────────────────────────────────────
const ACCENT         = { r: 0, g: 255, b: 136 }; // neon green — change to adjust color
const SPEED          = 0.4;   // animation speed multiplier (lower = slower)
const RING_OPACITY   = 0.10;  // max ring stroke opacity (0–1)
const GLOW_OPACITY   = 0.04;  // ambient radial wash opacity
const TARGET_FPS     = 30;    // cap framerate for performance
// ─────────────────────────────────────────────────────────────────────────────

export default function CyclopsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respect user accessibility preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf  = 0;
    let tick = 0;
    let last = 0;
    const MS_PER_FRAME = 1000 / TARGET_FPS;

    function resize() {
      canvas!.width  = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Shorthand for accent rgba string
    const a = (opacity: number) =>
      `rgba(${ACCENT.r},${ACCENT.g},${ACCENT.b},${Math.min(opacity, 1)})`;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (now - last < MS_PER_FRAME) return;
      last = now;
      tick++;

      const t  = tick * SPEED;
      const w  = canvas!.width;
      const h  = canvas!.height;
      const cx = w * 0.5;
      const cy = h * 0.5;
      // R is the base radius — eye occupies ~45% of the shorter viewport dimension
      const R  = Math.min(w, h) * 0.45;

      ctx!.clearRect(0, 0, w, h);

      // ── 1. Ambient radial wash (background glow) ──────────────────────────
      const wash = ctx!.createRadialGradient(cx, cy, 0, cx, cy, R * 1.9);
      wash.addColorStop(0,   a(GLOW_OPACITY * 2.0));
      wash.addColorStop(0.4, a(GLOW_OPACITY));
      wash.addColorStop(1,   a(0));
      ctx!.fillStyle = wash;
      ctx!.fillRect(0, 0, w, h);

      // ── 2. Slow pulse factor — sine wave, ~7s period at default SPEED ─────
      const pulse = 1 + Math.sin(t * 0.008) * 0.05;

      // ── 3. Concentric rings (the "iris" structure) ────────────────────────
      // Each ring: rFactor = fraction of R, lw = line width, op = opacity multiplier
      const RINGS = [
        { f: 1.00, lw: 0.5, op: RING_OPACITY * 0.40 },
        { f: 0.72, lw: 0.5, op: RING_OPACITY * 0.55 },
        { f: 0.52, lw: 0.8, op: RING_OPACITY * 1.00 },
        { f: 0.35, lw: 0.5, op: RING_OPACITY * 0.80 },
        { f: 0.20, lw: 1.0, op: RING_OPACITY * 1.20 },
        { f: 0.09, lw: 1.4, op: RING_OPACITY * 1.60 },
      ] as const;

      for (const { f, lw, op } of RINGS) {
        ctx!.beginPath();
        ctx!.arc(cx, cy, R * f * pulse, 0, Math.PI * 2);
        ctx!.strokeStyle = a(op);
        ctx!.lineWidth   = lw;
        ctx!.stroke();
      }

      // ── 4. Outer rotating arcs (slow scan / awareness feel) ───────────────
      // At SPEED=0.4, TARGET_FPS=30: t increases ~12/s → full rotation ≈ 8 min
      const rot1 = t * 0.0012;

      ctx!.save();
      ctx!.translate(cx, cy);
      ctx!.rotate(rot1);
      for (let i = 0; i < 4; i++) {
        const o = (i / 4) * Math.PI * 2;
        ctx!.beginPath();
        ctx!.arc(0, 0, R * 1.10, o, o + 0.75); // 0.75 rad ≈ 43° arc
        ctx!.strokeStyle = a(RING_OPACITY * 0.30);
        ctx!.lineWidth   = 0.5;
        ctx!.stroke();
      }
      ctx!.restore();

      // ── 5. Inner counter-rotating arcs (depth / complexity) ──────────────
      ctx!.save();
      ctx!.translate(cx, cy);
      ctx!.rotate(-rot1 * 1.35); // opposite direction, slightly different speed
      for (let i = 0; i < 3; i++) {
        const o = (i / 3) * Math.PI * 2;
        ctx!.beginPath();
        ctx!.arc(0, 0, R * 0.62, o, o + 0.52);
        ctx!.strokeStyle = a(RING_OPACITY * 0.40);
        ctx!.lineWidth   = 0.4;
        ctx!.stroke();
      }
      ctx!.restore();

      // ── 6. Core inner glow (the "pupil") ──────────────────────────────────
      const coreR = R * 0.07 * pulse;
      const coreG = ctx!.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      coreG.addColorStop(0,   a(0.20));
      coreG.addColorStop(0.5, a(0.08));
      coreG.addColorStop(1,   a(0));
      ctx!.fillStyle = coreG;
      ctx!.beginPath();
      ctx!.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx!.fill();
    }

    raf = requestAnimationFrame(frame);

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
      }}
    />
  );
}
