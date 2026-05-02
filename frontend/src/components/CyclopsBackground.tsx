'use client';

import { useEffect, useRef } from 'react';

// ── Tune these constants ──────────────────────────────────────────────────────
const ACCENT      = { r: 255, g: 140, b: 42  };  // light orange  (secondary colour)
const BURNT       = { r: 180, g:  60, b:  0  };  // burnt orange  (tertiary colour)
const EYE_OPACITY = 0.90;
const TARGET_FPS  = 30;
const BLINK_CYCLE = 150;   // ticks per cycle  (5 s at 30 fps)
const BLINK_START = 118;   // tick inside cycle when blink begins
const BLINK_HALF  = 16;    // ticks to fully close (then same to reopen)
// ─────────────────────────────────────────────────────────────────────────────

/** Eight gaze targets the pupil cycles through between blinks */
const GAZE_TARGETS = [
  { x:  0.60, y:  0.00 },
  { x: -0.60, y:  0.00 },
  { x:  0.00, y: -0.45 },
  { x:  0.50, y:  0.35 },
  { x: -0.50, y: -0.35 },
  { x:  0.00, y:  0.00 },
  { x:  0.55, y: -0.28 },
  { x: -0.55, y:  0.28 },
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

    // ── Persistent gaze state ────────────────────────────────────────────────
    let gazeX = 0, gazeY = 0, targetGazeX = 0, targetGazeY = 0;
    let gazeInitialized = false;
    let lastCycleIndex  = -1;

    const a = (op: number) =>
      `rgba(${ACCENT.r},${ACCENT.g},${ACCENT.b},${Math.min(Math.max(op, 0), 1)})`;
    const b = (op: number) =>
      `rgba(${BURNT.r},${BURNT.g},${BURNT.b},${Math.min(Math.max(op, 0), 1)})`;

    function renderFrame(t: number) {
      try {
        const w = canvas.width;
        const h = canvas.height;
        if (w < 2 || h < 2) return;

        const cx = w * 0.5;
        const cy = h * 0.5;

        if (!gazeInitialized) {
          gazeX = cx; gazeY = cy;
          targetGazeX = cx; targetGazeY = cy;
          gazeInitialized = true;
        }

        // Eye geometry — fixed size, never squished
        const hw    = Math.min(w * 0.32, 420);
        const hh    = Math.max(hw * 0.38, 1);
        const irisR = Math.max(hh * 0.82, 2);
        const pupilR= Math.max(irisR * 0.36, 1);
        const drift = (irisR - pupilR) * 0.70;

        // ── Gaze cycle ───────────────────────────────────────────────────────
        const phase      = t % BLINK_CYCLE;
        const cycleIndex = Math.floor(t / BLINK_CYCLE);

        if (cycleIndex !== lastCycleIndex) {
          lastCycleIndex = cycleIndex;
          const tgt = GAZE_TARGETS[cycleIndex % GAZE_TARGETS.length];
          targetGazeX = cx + tgt.x * drift;
          targetGazeY = cy + tgt.y * drift;
        }

        gazeX += (targetGazeX - gazeX) * 0.10;
        gazeY += (targetGazeY - gazeY) * 0.10;
        const px = gazeX;
        const py = gazeY;

        // ── Blink progress ───────────────────────────────────────────────────
        // lidProgress: 0 = fully open, 1 = fully closed
        let lidProgress = 0;
        if (phase >= BLINK_START) {
          const bp = phase - BLINK_START;
          if (bp < BLINK_HALF) {
            // Closing: ease-in (slow start, fast finish)
            lidProgress = Math.pow(bp / BLINK_HALF, 0.7);
          } else {
            // Opening: ease-out (fast start, slow finish)
            lidProgress = Math.pow(1 - (bp - BLINK_HALF) / BLINK_HALF, 0.7);
          }
          lidProgress = Math.min(1, Math.max(0, lidProgress));
        }

        // ── Draw ─────────────────────────────────────────────────────────────
        ctx.clearRect(0, 0, w, h);

        // 1. Ambient warm halo
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, hw * 2.2 || 1);
        halo.addColorStop(0,   a(0.16));
        halo.addColorStop(0.4, a(0.06));
        halo.addColorStop(1,   a(0));
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.globalAlpha = EYE_OPACITY;

        // 2. Clip iris / pupil / sclera to the full lens (size never changes)
        ctx.save();
        ctx.beginPath();
        traceLens(ctx, cx, cy, hw, hh);
        ctx.clip();

        // Sclera
        const scleraG = ctx.createRadialGradient(cx, cy, 0, cx, cy, hw);
        scleraG.addColorStop(0,   'rgb(255, 248, 235)');
        scleraG.addColorStop(0.6, 'rgb(255, 235, 210)');
        scleraG.addColorStop(1,   'rgb(245, 215, 185)');
        ctx.fillStyle = scleraG;
        ctx.fillRect(0, 0, w, h);

        // Iris
        const ig = ctx.createRadialGradient(px, py, 0, px, py, irisR);
        ig.addColorStop(0,    'rgb(255, 210, 130)');
        ig.addColorStop(0.20, 'rgb(255, 155,  55)');
        ig.addColorStop(0.50, 'rgb(200,  78,   8)');
        ig.addColorStop(0.80, 'rgb(130,  38,   4)');
        ig.addColorStop(1,    'rgba(70,  18,   0, 0.15)');
        ctx.fillStyle = ig;
        ctx.beginPath();
        ctx.arc(px, py, irisR, 0, Math.PI * 2);
        ctx.fill();

        // Iris rings
        for (let i = 1; i <= 8; i++) {
          ctx.beginPath();
          ctx.arc(px, py, irisR * (i / 8), 0, Math.PI * 2);
          ctx.strokeStyle = b(i % 4 === 0 ? 0.28 : 0.10);
          ctx.lineWidth   = i % 4 === 0 ? 1.0 : 0.5;
          ctx.stroke();
        }

        // Iris fibres
        for (let i = 0; i < 36; i++) {
          const ang = (i / 36) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(ang) * irisR * 0.28, py + Math.sin(ang) * irisR * 0.28);
          ctx.lineTo(px + Math.cos(ang) * irisR * 0.96, py + Math.sin(ang) * irisR * 0.96);
          ctx.strokeStyle = b(0.07);
          ctx.lineWidth   = 0.4;
          ctx.stroke();
        }

        // Scan spokes
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(t * 0.004);
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

        // Pupil penumbra
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

        // Specular
        ctx.fillStyle = 'rgba(255,255,255,0.62)';
        ctx.beginPath();
        ctx.arc(px - pupilR * 0.30, py - pupilR * 0.30, pupilR * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(px + pupilR * 0.22, py + pupilR * 0.24, pupilR * 0.09, 0, Math.PI * 2);
        ctx.fill();

        // ── Eyelid panels (drawn INSIDE the lens clip) ───────────────────────
        // Sweep warm skin-coloured eyelid fills over the iris from top & bottom.
        // These are visually distinct against both the white page and orange iris,
        // making the blink clearly visible regardless of background colour.
        if (lidProgress > 0.01) {
          const lensTop = cy - hh * 1.20;   // topmost point of lens
          const lensBot = cy + hh * 0.80;   // bottommost point of lens
          const lensH   = lensBot - lensTop;

          // Upper lid sweeps DOWN — covers 60 % of lens height at full blink
          const upperLidBot = lensTop + lensH * 0.60 * lidProgress;
          if (upperLidBot > lensTop) {
            const ug = ctx.createLinearGradient(cx, lensTop, cx, upperLidBot);
            ug.addColorStop(0,    `rgba(80, 30, 5, ${0.55 * lidProgress})`);   // dark lash line
            ug.addColorStop(0.08, `rgba(195, 140, 95, ${0.92 * lidProgress})`);  // lid skin
            ug.addColorStop(0.85, `rgba(215, 165, 115, ${0.88 * lidProgress})`);
            ug.addColorStop(1,    `rgba(225, 180, 130, ${0.60 * lidProgress})`); // soft lower edge
            ctx.fillStyle = ug;
            ctx.fillRect(cx - hw - 2, lensTop, hw * 2 + 4, Math.max(upperLidBot - lensTop, 0));
          }

          // Lower lid sweeps UP — covers 45 % of lens height at full blink
          const lowerLidTop = lensBot - lensH * 0.45 * lidProgress;
          if (lowerLidTop < lensBot) {
            const lg = ctx.createLinearGradient(cx, lowerLidTop, cx, lensBot);
            lg.addColorStop(0,    `rgba(225, 185, 140, ${0.55 * lidProgress})`); // soft upper edge
            lg.addColorStop(0.7,  `rgba(210, 160, 110, ${0.88 * lidProgress})`); // lid skin
            lg.addColorStop(1,    `rgba(160, 100,  60, ${0.70 * lidProgress})`); // shadow at lash
            ctx.fillStyle = lg;
            ctx.fillRect(cx - hw - 2, Math.max(lowerLidTop, lensTop), hw * 2 + 4,
              Math.max(lensBot - Math.max(lowerLidTop, lensTop), 0));
          }
        }

        ctx.restore(); // end lens clip

        // Eyelid outline — always at full size so it frames the eye consistently
        ctx.beginPath();
        traceLens(ctx, cx, cy, hw, hh);
        ctx.strokeStyle = a(0.72);
        ctx.lineWidth   = 2.5;
        ctx.stroke();

        // Outer glow halo
        ctx.beginPath();
        traceLens(ctx, cx, cy, hw * 1.05, hh * 1.14);
        ctx.strokeStyle = a(0.20);
        ctx.lineWidth   = 11;
        ctx.stroke();

        // Iris pulse glow
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
        if (process.env.NODE_ENV !== 'production') console.warn('[CyclopsBackground]', err);
      }
    }

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      gazeInitialized = false;
      renderFrame(tick);
    }
    resize();
    window.addEventListener('resize', resize);
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
        filter: 'drop-shadow(0 0 50px rgba(255, 140, 42, 0.32))',
      }}
    />
  );
}
