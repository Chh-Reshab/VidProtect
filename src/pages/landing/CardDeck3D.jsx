// ============================================
// CARD DECK 3D — the scroll-pinned card sections on the landing page.
//
// The section is taller than the screen; its content stays pinned while scrolling moves
// the cards through a real 3D scene:
//   mode "coverflow": the active card sits in front, the others swing away on an arc
//   mode "rolodex"  : cards sit on a cylinder and rotate around a horizontal axis
// Every frame is written straight to the DOM from the eased scroll value (no React state,
// no CSS transitions on the moving parts). Scroll progress is mapped with a "dwell" curve
// so each card holds still in the middle and then moves quickly to the next one.
// ============================================

import { useEffect, useRef } from 'react';
import { createScroller, prefersReducedMotion } from './motion';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);
// Plateaus near whole numbers: raw 0..n-1 -> p, where each card dwells and then snaps on
const dwell = (raw) => {
  const base = Math.floor(raw);
  return base + smooth(smooth(raw - base));
};

// Big enough that a tilted neighbour's lower edge stays behind the card in front of it
const ROLODEX_RADIUS = 480;

export default function CardDeck3D({ cards, mode = 'coverflow', bg = '#101010', kicker, title, subtitle }) {
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  const worldRef = useRef(null);
  const cardEls = useRef([]);
  const railEls = useRef([]);
  const railFill = useRef(null);
  const dotEls = useRef([]);
  const counterEl = useRef(null);
  const floorEl = useRef(null);
  const ghostEl = useRef(null);
  const orbEls = useRef([]);
  const lastActive = useRef(-1);
  const n = cards.length;

  useEffect(() => {
    const reduce = prefersReducedMotion();
    const stage = stageRef.current;

    // Cursor depth: tilts the active card and its glare
    const onMove = (e) => {
      if (reduce) return;
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      stage.style.setProperty('--ry', (x * 14).toFixed(2));
      stage.style.setProperty('--rx', (-y * 10).toFixed(2));
      stage.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
      stage.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
    };
    const onLeave = () => { stage.style.setProperty('--ry', '0'); stage.style.setProperty('--rx', '0'); };
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);

    const scroller = createScroller((scroll) => {
      const track = trackRef.current;
      if (!track || !stage) return;
      const rect = track.getBoundingClientRect();
      const docTop = rect.top + window.scrollY;
      const span = Math.max(1, rect.height - window.innerHeight);
      const t = clamp01((scroll - docTop) / span);
      const raw = t * (n - 1);
      const p = reduce ? Math.round(raw) : dwell(raw);
      const active = Math.round(p);
      const cw = Math.min(460, stage.clientWidth * 0.82);
      stage.style.setProperty('--cw', `${cw}px`);

      cardEls.current.forEach((el, i) => {
        if (!el) return;
        const o = i - p;
        const a = Math.abs(o);
        let x = 0; let y = 0; let z = 0; let rx = 0; let ry = 0; let s = 1; let op = 1;

        if (mode === 'rolodex') {
          rx = -o * 42;                       // degrees around the horizontal axis
          z = ROLODEX_RADIUS;                 // out to the cylinder surface
          x = o * 26;
          s = 1 - Math.min(a, 2) * 0.05;
          op = a <= 0.9 ? 1 : Math.max(0, 1 - (a - 0.9) * 1.4);
        } else if (o < 0) {
          x = o * cw * 0.62;
          z = -a * 180;
          ry = Math.min(a, 2) * 40;
          s = 1 - Math.min(a, 2) * 0.08;
          op = clamp01((1.7 - a) / 0.7);
        } else {
          x = o * cw * 0.3;
          y = a * 5;
          z = -a * 150;
          ry = -Math.min(a, 3) * 24;
          s = 1 - Math.min(a, 3) * 0.07;
          op = clamp01((3.3 - a) / 1.2);
        }

        el.style.transform = mode === 'rolodex'
          ? `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotateX(${rx.toFixed(2)}deg) translateZ(${z}px) scale(${s.toFixed(4)})`
          : `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) scale(${s.toFixed(4)})`;
        el.style.opacity = op.toFixed(3);
        el.style.zIndex = String(Math.round(100 - a * 10));
        el.style.pointerEvents = a < 0.5 ? 'auto' : 'none';
        // dim the cards that are not in front; only flatten (filter) a card while it is dimmed,
        // so the front card keeps its layered depth
        const dim = clamp01(a * 0.6);
        el.style.filter = dim > 0.02 ? `brightness(${(1 - dim * 0.62).toFixed(3)})` : 'none';
        el.dataset.active = String(a < 0.5);
      });

      // whole scene drifts a little with scroll, adding to the depth
      if (worldRef.current) {
        const sway = (t - 0.5) * -9;
        worldRef.current.style.transform = mode === 'rolodex'
          ? `translateZ(${-ROLODEX_RADIUS}px) rotateY(${sway.toFixed(2)}deg)`
          : `rotateY(${sway.toFixed(2)}deg)`;
      }

      if (active !== lastActive.current) {
        lastActive.current = active;
        railEls.current.forEach((li, i) => { if (li) li.dataset.active = String(i === active); });
        dotEls.current.forEach((dot, i) => {
          if (!dot) return;
          dot.style.width = i === active ? '24px' : '8px';
          dot.style.background = i === active ? '#FF2028' : '#3a3a3a';
        });
        if (counterEl.current) counterEl.current.textContent = `${String(active + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
        if (ghostEl.current) ghostEl.current.textContent = String(active + 1).padStart(2, '0');
      }
      if (railFill.current) railFill.current.style.transform = `scaleY(${t.toFixed(4)})`;
      if (floorEl.current) floorEl.current.style.backgroundPosition = `0 ${(scroll * 0.4) % 64}px`; // grid streams toward you
      if (ghostEl.current) ghostEl.current.style.transform = `translateY(calc(-50% + ${((0.5 - t) * 140).toFixed(1)}px))`;
      orbEls.current.forEach((orb, k) => {
        if (!orb) return;
        const sp = [0.5, -0.8, 0.3][k];
        orb.style.transform = `translate3d(${((t - 0.5) * 120 * sp).toFixed(1)}px, ${(-(t - 0.5) * 360 * (k + 1) * 0.55).toFixed(1)}px, 0)`;
      });
    });

    return () => {
      scroller.stop();
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
    };
  }, [n, mode]);

  // Clicking a rail item scrolls to that card
  const jumpTo = (i) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const span = Math.max(1, rect.height - window.innerHeight);
    window.scrollTo({ top: rect.top + window.scrollY + (i / (n - 1)) * span, behavior: 'smooth' });
  };

  return (
    <div ref={trackRef} className="lp3d-track" style={{ height: `${n * 105}vh` }}>
      <div className="lp3d-pin" style={{ background: bg }}>
        {/* scene backdrop */}
        <div className="lp3d-floor" ref={floorEl} aria-hidden="true" />
        <div className="lp3d-ghost" ref={ghostEl} aria-hidden="true">01</div>
        <div className="lp3d-orb" ref={(el) => { orbEls.current[0] = el; }} style={{ top: '14%', left: '38%', width: 170, height: 170, background: 'radial-gradient(circle, rgba(255,32,40,0.22), transparent 70%)' }} aria-hidden="true" />
        <div className="lp3d-orb" ref={(el) => { orbEls.current[1] = el; }} style={{ bottom: '18%', right: '8%', width: 120, height: 120, border: '1px solid rgba(255,32,40,0.25)' }} aria-hidden="true" />
        <div className="lp3d-orb" ref={(el) => { orbEls.current[2] = el; }} style={{ top: '60%', left: '4%', width: 70, height: 70, border: '1px dashed #333' }} aria-hidden="true" />

        <div className="lp3d-layout">
          <div className="lp3d-copy">
            {kicker}
            <h2 className="section-headline lp3d-title-h">{title}</h2>
            {subtitle && <p className="lp3d-sub">{subtitle}</p>}
            <ol className="lp3d-rail">
              <div className="lp3d-rail-fill" ref={railFill} />
              {cards.map((c, i) => (
                <li key={c.label} ref={(el) => { railEls.current[i] = el; }} data-active={i === 0} onClick={() => jumpTo(i)}>
                  <span className="num mono">{String(i + 1).padStart(2, '0')}</span>
                  <span>{c.label}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="lp3d-stage" ref={stageRef}>
            <div className="lp3d-world" ref={worldRef}>
              {cards.map((c, i) => {
                const Icon = c.icon;
                return (
                  <div key={c.label} className="lp3d-card" ref={(el) => { cardEls.current[i] = el; }} data-active={i === 0}>
                    <div className="lp3d-face">
                      <div className="lp3d-glare" />
                      <span className="lp3d-num mono">{String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
                      <div className="lp3d-icon"><Icon size={30} color="#FF2028" strokeWidth={1.5} /></div>
                      {c.tag && <div className="lp3d-tag"><span className="badge badge-red" style={{ fontSize: '0.7rem' }}>{c.tag}</span></div>}
                      <div className="lp3d-title">{c.label}</div>
                      <p className="lp3d-text">{c.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lp3d-dots" aria-hidden="true">
              {cards.map((_, i) => (
                <div key={i} ref={(el) => { dotEls.current[i] = el; }} style={{ width: i === 0 ? 24 : 8, background: i === 0 ? '#FF2028' : '#3a3a3a' }} />
              ))}
            </div>
            <div className="lp3d-counter mono" ref={counterEl} aria-live="polite">01 / {String(n).padStart(2, '0')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
