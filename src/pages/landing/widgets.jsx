// ============================================
// LANDING PAGE WIDGETS — reveal, counter, spotlight card, hero showcase, marquee
// Styles for these live in LandingPage.jsx (.lp-* classes) so the effects stay scoped to it.
// ============================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Shield, Lock, CheckCircle, Eye } from 'lucide-react';
import { prefersReducedMotion } from './motion';

// Fades, lifts and un-blurs its children once when they scroll into view
export const Reveal = ({ children, delay = 0, y = 32, blur = 6, as: Tag = 'div', style, className = '', threshold = 0.12 }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) { el.classList.add('in'); return undefined; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('in'); io.disconnect(); }
    }, { threshold, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return (
    <Tag ref={ref} className={`lp-reveal ${className}`} style={{ '--delay': `${delay}ms`, '--y': `${y}px`, '--blur': `${blur}px`, ...style }}>
      {children}
    </Tag>
  );
};

// Counts up to `to` the first time it is seen
export const Counter = ({ to, suffix = '', duration = 1600 }) => {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !('IntersectionObserver' in window)) return undefined;
    el.textContent = `0${suffix}`;
    let timer;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      timer = setInterval(() => {
        const t = Math.min(1, (performance.now() - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        el.textContent = `${Math.round(to * eased)}${suffix}`;
        if (t >= 1) clearInterval(timer);
      }, 16);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); clearInterval(timer); };
  }, [to, suffix, duration]);
  return <span ref={ref}>{to}{suffix}</span>;
};

// A card with a cursor-following glow and an optional gentle 3D tilt
export const SpotlightCard = ({ children, style, className = '', tilt = 0 }) => {
  const ref = useRef(null);
  const move = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    if (tilt) {
      el.style.setProperty('--rx', `${((0.5 - y) * tilt).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${((x - 0.5) * tilt).toFixed(2)}deg`);
    }
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  return <div ref={ref} className={`lp-spot ${className}`} style={style} onMouseMove={move} onMouseLeave={leave}>{children}</div>;
};

// Pulls its child slightly toward the cursor
export const Magnetic = ({ children, strength = 0.28 }) => {
  const ref = useRef(null);
  const move = (e) => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate3d(${(dx * strength).toFixed(1)}px, ${(dy * strength).toFixed(1)}px, 0)`;
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ''; };
  return <span ref={ref} className="lp-magnetic" onMouseMove={move} onMouseLeave={leave}>{children}</span>;
};

export const Marquee = ({ items }) => (
  <div className="lp-marquee" aria-hidden="true">
    <div className="lp-marquee-track">
      {[...items, ...items].map((item, i) => (
        <span key={i} className="lp-marquee-item">
          <span style={{ color: '#FF2028' }}>◆</span> {item}
        </span>
      ))}
    </div>
  </div>
);

const Chip = ({ speed, style, children, delay = 0 }) => (
  <div data-speed={speed} className="lp-chip-wrap" style={style}>
    <div className="lp-chip" style={{ animationDelay: `${delay}s` }}>{children}</div>
  </div>
);

// The product mockup under the headline. It starts tilted back and settles flat as it
// scrolls into view (data-flatten), tilts toward the cursor, and its chips float at
// different depths.
export const HeroShowcase = () => {
  const [secs, setSecs] = useState(299);
  const mouseRef = useRef(null);
  useEffect(() => {
    const t = setInterval(() => setSecs(s => (s <= 0 ? 299 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const move = (e) => {
    const el = mouseRef.current;
    if (!el || prefersReducedMotion()) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${(x * 9).toFixed(2)}deg) rotateX(${(-y * 7).toFixed(2)}deg)`;
  };
  const leave = () => { if (mouseRef.current) mouseRef.current.style.transform = ''; };
  const clock = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <div className="lp-showcase" onMouseMove={move} onMouseLeave={leave}>
      <div data-flatten className="lp-showcase-flat">
        <div ref={mouseRef} className="lp-showcase-mouse">
          <div className="lp-window">
            <div className="lp-window-bar">
              <span style={{ background: '#FF2028' }} /><span /><span />
              <em className="mono">SECURE_STREAM_PLAYER</em>
              <b className="mono"><i /> LIVE</b>
            </div>
            <div className="lp-viewport">
              <div className="lp-scan" />
              <Shield size={46} color="#FF2028" strokeWidth={1.4} style={{ position: 'relative', zIndex: 2 }} />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', position: 'relative', zIndex: 2 }}>
                <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>⚿ PROTECTED</span>
                <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>✓ ENCRYPTED</span>
              </div>
              <span className="lp-wm mono">SARAH CHEN · SS-A1B2C3D4</span>
            </div>
            <div className="lp-bar"><div /></div>
            <div className="lp-rows">
              {[
                ['SESSION VERIFIED', '✓ ACTIVE', '#22c55e'],
                ['ENROLLMENT CHECK', '✓ PASSED', '#22c55e'],
                ['TOKEN EXPIRES IN', clock, '#F8F8F8'],
              ].map(([k, v, c]) => (
                <div key={k}><span className="mono">{k}</span><span className="mono" style={{ color: c }}>{v}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Chip speed="-0.1" style={{ top: '6%', left: '-3%' }}><Lock size={13} color="#FF2028" /> <span className="mono">AES-256-GCM</span></Chip>
      <Chip speed="0.12" delay={1.2} style={{ top: '18%', right: '-3%' }}><CheckCircle size={13} color="#22c55e" /> <span className="mono">JWT VERIFIED</span></Chip>
      <Chip speed="-0.16" delay={2.1} style={{ bottom: '16%', right: '-2%' }}><span className="lp-dot" /> <span className="mono">TOKEN {clock}</span></Chip>
      <Chip speed="0.07" delay={0.6} style={{ bottom: '8%', left: '-2%' }}><Eye size={13} color="#eab308" /> <span className="mono">3 EVENTS LOGGED</span></Chip>
    </div>
  );
};
