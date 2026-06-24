'use client';
// Web Trace — Auth screens (production TSX). Ported from
// design-system/ui_kits/auth/index.html. NOTE: this is the LATER-PHASE design —
// real authentication is not wired yet; the submit button routes to /dashboard.
// Replace the onSubmit handler when you add real accounts.

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Chrome, Apple } from 'lucide-react';
import { Button } from '@ds/components/core/Button';
import { StatusPill } from '@ds/components/core/StatusPill';

export function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const isUp = mode === 'signup';
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: wire real auth here. For now (later-phase stub) → straight to the desk.
    router.push('/dashboard');
  }

  return (
    <div className="auth">
      <aside className="brandside">
        <div className="wt-grid-bg grid" />
        <div className="blk lk">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.svg" width={36} height={36} alt="" />
          <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
            <span className="w">Web</span><span className="t wt-gradient-text">&nbsp;Trace</span>
          </span>
        </div>
        <div className="blk">
          <StatusPill tone="up" pulse>Market data · live</StatusPill>
          <h1 className="pitch" style={{ marginTop: 20 }}><span className="wt-gradient-text">Trace</span> the market&rsquo;s edge</h1>
          <p className="pitchsub">Real options intelligence on a reliable, instrument-grade desk. Credible setups, live execution levels, an honest backtested edge.</p>
        </div>
        <div className="blk quote">&ldquo;Signals that earn their place.&rdquo;</div>
      </aside>

      <main className="formside">
        <form className="card" onSubmit={onSubmit}>
          <div className="seg">
            <Link href="/login" className={!isUp ? 'on' : ''}>Sign in</Link>
            <Link href="/signup" className={isUp ? 'on' : ''}>Create account</Link>
          </div>

          <h2 className="formh">{isUp ? 'Open your desk' : 'Welcome back'}</h2>
          <p className="formsub">{isUp ? 'Start tracing real setups in minutes.' : 'Sign in to your trading desk.'}</p>

          {isUp && (
            <label className="fld"><span className="lbl">Full name</span>
              <input className="inp" type="text" placeholder="Will Kizer" /></label>
          )}
          <label className="fld"><span className="lbl">Email</span>
            <input className="inp" type="email" placeholder="you@desk.com" /></label>
          <label className="fld"><span className="lbl">Password</span>
            <input className="inp" type="password" placeholder="••••••••••" /></label>

          {!isUp && (
            <div className="row-between">
              <label className="check"><input type="checkbox" defaultChecked /> Keep me signed in</label>
              <a className="link" href="#">Forgot password?</a>
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" fullWidth rightIcon={<ArrowRight size={17} />}>
            {isUp ? 'Create account' : 'Sign in'}
          </Button>

          <div className="divider">or continue with</div>
          <div className="oauth">
            <Button type="button" variant="secondary" fullWidth leftIcon={<Chrome size={16} />}>Google</Button>
            <Button type="button" variant="secondary" fullWidth leftIcon={<Apple size={16} />}>Apple</Button>
          </div>

          <p className="legal">
            {isUp
              ? 'By creating an account you agree to the Terms & Privacy Policy. For educational use — not financial advice.'
              : 'Protected by industry-standard encryption. For educational use — not financial advice.'}
          </p>
        </form>
      </main>

      <style jsx>{`
        .auth { display: grid; grid-template-columns: 1.05fr 1fr; min-height: 100vh; }
        .brandside { position: relative; overflow: hidden; border-right: 1px solid var(--border-subtle);
          background:
            radial-gradient(700px 380px at 20% 12%, rgba(138,160,230,0.20), transparent 62%),
            radial-gradient(620px 380px at 88% 88%, rgba(180,180,204,0.14), transparent 60%),
            var(--surface-sunken);
          padding: 48px; display: flex; flex-direction: column; justify-content: space-between; }
        .grid { position: absolute; inset: 0; opacity: 0.5; }
        .blk { position: relative; z-index: 1; }
        .lk { display: flex; align-items: center; gap: 11px; }
        .lk .w { font-family: var(--font-display); font-weight: 700; font-size: 20px; color: var(--text-primary); }
        .lk .t { font-family: var(--font-brand); font-size: 20px; }
        .pitch { font-family: var(--font-display); font-weight: 700; font-size: 40px; line-height: 1.04; letter-spacing: -0.03em; max-width: 14ch; margin: 0; }
        .pitchsub { margin-top: 16px; color: var(--text-secondary); font-size: 15px; line-height: 1.6; max-width: 40ch; }
        .quote { color: var(--text-muted); font-size: 13px; font-family: var(--font-mono); }
        .formside { display: flex; align-items: center; justify-content: center; padding: 48px; }
        .card { width: 100%; max-width: 372px; }
        .seg { display: flex; gap: 4px; padding: 4px; border-radius: var(--radius-md); background: var(--surface-sunken); border: 1px solid var(--border-default); margin-bottom: 28px; }
        .seg :global(a) { flex: 1; padding: 9px; border-radius: var(--radius-sm); text-align: center; font-family: var(--font-sans); font-size: 13px; font-weight: 600; color: var(--text-muted); }
        .seg :global(a.on) { background: var(--accent-muted-2); color: var(--text-primary); }
        .formh { font-family: var(--font-display); font-weight: 700; font-size: 24px; letter-spacing: -0.02em; margin: 0 0 6px; }
        .formsub { font-size: 13.5px; color: var(--text-muted); margin: 0 0 26px; }
        .fld { display: block; margin-bottom: 16px; }
        .fld .lbl { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 7px; }
        .inp { width: 100%; box-sizing: border-box; background: var(--surface-card); border: 1px solid var(--border-strong); border-radius: var(--radius-md); padding: 11px 13px; color: var(--text-primary); font-family: var(--font-sans); font-size: 14px; outline: none; transition: border-color 120ms, box-shadow 120ms; }
        .inp::placeholder { color: var(--text-faint); }
        .inp:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-muted); }
        .row-between { display: flex; align-items: center; justify-content: space-between; margin: 4px 0 22px; }
        .check { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-muted); }
        .check input { accent-color: var(--accent); width: 15px; height: 15px; }
        .link { font-size: 12.5px; color: var(--accent-text); }
        .divider { display: flex; align-items: center; gap: 12px; margin: 22px 0; color: var(--text-faint); font-size: 11px; }
        .divider::before, .divider::after { content: ''; height: 1px; flex: 1; background: var(--border-subtle); }
        .oauth { display: flex; gap: 10px; }
        .legal { margin-top: 22px; font-size: 11px; color: var(--text-faint); line-height: 1.5; text-align: center; }
        @media (max-width: 880px) { .auth { grid-template-columns: 1fr; } .brandside { display: none; } }
      `}</style>
    </div>
  );
}
