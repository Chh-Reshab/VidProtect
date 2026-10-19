// ============================================
// LANDING PAGE — VidProtect AI
// Motion is driven by landing/motion.js (eased, DOM-only parallax) and the small widgets
// in landing/widgets.jsx. All motion CSS is scoped here under .lp-*, so nothing leaks
// into the dashboards.
// ============================================

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Lock, Eye, Zap, AlertTriangle, CheckCircle, X, ArrowRight,
} from 'lucide-react';
import { Logo, SectionLabel } from '../components/SharedComponents';
import { startParallax } from './landing/motion';
import CardDeck3D from './landing/CardDeck3D';
import { Reveal, Counter, SpotlightCard, Magnetic, Marquee, HeroShowcase } from './landing/widgets';

const THIS_YEAR = new Date().getFullYear();

// ── CURSOR PARTICLES ─────────────────────────
const CursorParticles = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf;
    const particles = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (e.clientY < rect.top || e.clientY > rect.bottom) return; // only while the pointer is over the hero
      for (let i = 0; i < 3 && particles.length < 160; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 0.5;
        particles.push({
          x: e.clientX - rect.left, y: e.clientY - rect.top,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          size: Math.random() * 2 + 1, life: 1, decay: Math.random() * 0.015 + 0.01,
        });
      }
    };
    window.addEventListener('mousemove', onMouseMove);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 32, 40, ${p.life})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />;
};

// ── CYCLING HEADLINE ─────────────────────────
const HERO_LINES = [
  { line1: 'YOUR VIDEOS.', highlight: 'LOCKED IN.' },
  { line1: 'STOP PIRACY.', highlight: 'DEAD COLD.' },
  { line1: 'ENCRYPT IT.', highlight: 'DELIVER IT.' },
  { line1: 'SECURE NOW.', highlight: 'PERIOD.' },
];

const CyclingText = ({ phrases, interval = 3000 }) => {
  const [index, setIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setIndex(i => (i + 1) % phrases.length);
        setAnimating(false);
      }, 350);
    }, interval);
    return () => clearInterval(t);
  }, [phrases.length, interval]);

  const current = phrases[index];
  const style = {
    transition: 'opacity 0.35s ease, transform 0.35s ease',
    opacity: animating ? 0 : 1,
    transform: animating ? 'translateY(-12px)' : 'translateY(0)',
    display: 'inline-block',
  };

  return (
    <div style={{ marginTop: '1.5rem', minHeight: '11rem', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center' }}>
      <h1 className="hero-headline" style={{ marginBottom: '0', textAlign: 'center' }}>
        <span style={style}>{current.line1}</span><br />
        <span style={{ ...style, transitionDelay: '0.05s' }}>
          <span className="red-highlight">{current.highlight}</span>
        </span>
      </h1>
    </div>
  );
};

// ── FLOATING SHAPES (three depth layers) ─────
const SHAPES = [
  { k: 'tri', pos: { top: '22%', left: '8%' }, s: 48, c: '#2c2c2c', w: 1, speed: 0.32, d: 9 },
  { k: 'sq', pos: { bottom: '34%', left: '15%' }, s: 40, c: 'rgba(255,32,40,0.35)', w: 1.5, speed: 0.1, d: 10 },
  { k: 'ci', pos: { top: '46%', left: '4%' }, s: 24, c: '#2c2c2c', w: 1, speed: 0.4, d: 12 },
  { k: 'plus', pos: { bottom: '40%', left: '28%' }, s: 16, c: '#565656', w: 2, speed: -0.08, d: 14 },
  { k: 'plus', pos: { top: '28%', right: '18%' }, s: 32, c: '#2c2c2c', w: 1.5, speed: 0.22, d: 13 },
  { k: 'ci', pos: { top: '60%', right: '9%' }, s: 64, c: '#2c2c2c', w: 1, speed: 0.36, d: 11 },
  { k: 'tri', pos: { top: '14%', right: '8%' }, s: 28, c: 'rgba(255,32,40,0.22)', w: 1.5, speed: -0.1, d: 15 },
  { k: 'sq', pos: { bottom: '44%', right: '22%' }, s: 20, c: '#2c2c2c', w: 1.5, speed: 0.14, d: 12 },
  { k: 'ci', pos: { top: '10%', left: '46%' }, s: 48, c: '#242424', w: 1, speed: 0.45, d: 16 },
];
const SHAPE_PATH = { tri: <path d="M12 2L22 20H2L12 2Z" />, sq: <rect x="3" y="3" width="18" height="18" />, ci: <circle cx="12" cy="12" r="10" />, plus: <path d="M12 5V19M5 12H19" /> };

const FloatingShapes = () => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }} aria-hidden="true">
    {SHAPES.map((sh, i) => (
      <div key={i} data-speed={sh.speed} style={{ position: 'absolute', ...sh.pos, willChange: 'transform' }}>
        <svg className="lp-float" style={{ animationDuration: `${sh.d}s`, animationDelay: `${-i * 1.3}s` }} width={sh.s} height={sh.s} viewBox="0 0 24 24" fill="none" stroke={sh.c} strokeWidth={sh.w} strokeLinejoin="round">
          {SHAPE_PATH[sh.k]}
        </svg>
      </div>
    ))}
  </div>
);

// ── NAV ──────────────────────────────────────
const NAV = [
  ['features', 'Features'],
  ['how-it-works', 'How it works'],
  ['comparison', 'Compare'],
  ['security', 'Roadmap'],
];

const Navbar = ({ active }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24); // only changes state when the value flips
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <header className={`lp-nav${scrolled || menuOpen ? ' solid' : ''}`} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', height: '60px', gap: '2rem' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <Logo size="sm" />
          <span className="mono" style={{ fontSize: '0.7rem', color: '#eab308', border: '1px solid #eab308', padding: '1px 4px' }}>BETA</span>
        </Link>

        <nav style={{ display: 'flex', gap: '1.75rem', flex: 1 }} className="desktop-nav">
          {NAV.map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} className={`lp-nav-link${active === id ? ' active' : ''}`}>{label}</button>
          ))}
        </nav>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }} className="desktop-cta">
          <Link to="/creator/login" className="btn btn-ghost" style={{ fontSize: '0.7rem' }}>CREATOR LOGIN</Link>
          <Link to="/login" className="btn btn-ghost" style={{ fontSize: '0.7rem' }}>LOGIN</Link>
          <Link to="/login" className="btn btn-primary" style={{ fontSize: '0.7rem' }}>GET PROTECTED</Link>
        </div>

        <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu" style={{ display: 'none', background: 'none', border: 'none', color: '#F8F8F8', cursor: 'pointer', marginLeft: 'auto' }} className="mobile-nav-btn">
          {menuOpen ? <X size={22} /> : <span style={{ fontSize: '1.2rem' }}>☰</span>}
        </button>
      </div>

      {menuOpen && (
        <div style={{ background: '#171717', borderTop: '1px solid #292929', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {NAV.map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem', textAlign: 'left', padding: '0.4rem 0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {label}
            </button>
          ))}
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <Link to="/creator/login" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => setMenuOpen(false)}>CREATOR LOGIN</Link>
            <Link to="/login" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => setMenuOpen(false)}>LOGIN</Link>
            <Link to="/login" className="btn btn-primary" style={{ fontSize: '0.7rem' }} onClick={() => setMenuOpen(false)}>GET PROTECTED</Link>
          </div>
        </div>
      )}
    </header>
  );
};

// ── CONTENT ──────────────────────────────────
const WORKFLOW_STEPS = [
  { num: 1, label: 'Upload', desc: 'Creators upload videos with metadata including title, course association, and access rules. The platform validates inputs and tracks upload progress.' },
  { num: 2, label: 'Encrypt', desc: 'Every video is encrypted with AES-256-GCM, using its own random key, before it is written to storage. The key itself is encrypted by a master key kept outside the database, and every block is integrity-checked on playback.' },
  { num: 3, label: 'Store', desc: 'Encrypted video data and metadata are stored in a protected location. Metadata includes title, creator ID, course association, and protection status. No public URL to the original file is exposed.' },
  { num: 4, label: 'Verify', desc: 'When a learner requests access, the backend authenticates their identity via JWT, then verifies enrollment in the relevant course. Authentication establishes identity; authorization determines access rights.' },
  { num: 5, label: 'Stream', desc: 'Only after all authorization checks pass, the platform issues a short-lived streaming token tied to the specific learner and video session. The token expires automatically.' },
  { num: 6, label: 'Monitor', desc: 'Every access attempt — successful or denied — is logged with timestamp, user, video, result, and reason. Unusual patterns generate security alerts for creator review.' },
];

const FEATURES = [
  { icon: Lock, label: 'Encrypted Storage', desc: 'AES-256-GCM encryption is applied before content reaches storage, with a separate key for every video. Encrypted data stays protected even if storage is exposed.', tag: 'AES-256' },
  { icon: Shield, label: 'Authentication', desc: 'JWT-based identity verification confirms who is making each streaming request before access decisions are made.', tag: 'JWT AUTH' },
  { icon: Zap, label: 'Temporary Access', desc: 'Short-lived, user-specific streaming tokens replace permanent public URLs. Tokens expire automatically and cannot be reused indefinitely.', tag: 'AUTO-EXPIRY' },
  { icon: Eye, label: 'Continuous Monitoring', desc: 'Access attempts, denials, token events, and unusual patterns are logged and surfaced in the security alert center.', tag: 'REAL-TIME' },
];

const PROBLEMS = [
  { icon: AlertTriangle, tag: 'SHARING', label: 'Permanent Links Enable Sharing', desc: 'Normal video URLs can be forwarded to unauthorized viewers. VidProtect AI aims to replace them with expiring, user-specific stream tokens.' },
  { icon: X, tag: 'REVENUE', label: 'Content Piracy Causes Revenue Loss', desc: 'Premium educational content represents real investment. Unauthorized access can undermine creator revenue and devalue paid courses.' },
  { icon: Lock, tag: 'ACCESS', label: 'Enterprise Protection Is Inaccessible', desc: 'Sophisticated video security infrastructure is often out of reach for independent creators. VidProtect AI aims to make key controls available without requiring enterprise resources.' },
  { icon: Eye, tag: 'VISIBILITY', label: 'Suspicious Activity Goes Unnoticed', desc: 'Repeated denials, expired-token reuse, and unusual access frequency can indicate misuse. VidProtect AI logs events and surfaces patterns for review.' },
];

const ROADMAP = [
  { num: '01', label: 'Payment Integration', desc: 'Secure course purchase flows enabling direct content monetization within the platform.' },
  { num: '02', label: 'Advanced AI Detection', desc: 'Improved anomaly detection models for identifying unusual access patterns beyond rule-based alerts.' },
  { num: '03', label: 'AWS S3 Migration', desc: 'Scalable encrypted media storage using AWS S3 with server-side encryption and access controls.' },
  { num: '04', label: 'Video Watermarking', desc: 'Forensic identifiers embedded in delivered video to associate leaked content with a specific session or learner.' },
];

const STATS = [
  { to: 256, suffix: '-bit', label: 'AES-GCM ENCRYPTION' },
  { to: 5, suffix: ' min', label: 'PLAYBACK SESSIONS' },
  { to: 100, suffix: '%', label: 'ACCESS ATTEMPTS LOGGED' },
  { to: 0, suffix: '', label: 'PERMANENT PUBLIC LINKS' },
];

const MARQUEE = ['AES-256-GCM ENCRYPTION', 'JWT AUTHENTICATION', 'TEMPORARY STREAM TOKENS', 'ENROLLMENT VERIFICATION', 'ACCESS LOGGING', 'ANOMALY ALERTS', 'KEY PER VIDEO', 'INTEGRITY-CHECKED PLAYBACK'];

const WorkflowStep = ({ num, label, desc, isActive, onClick }) => (
  <button
    onClick={onClick}
    className="lp-step"
    style={{
      background: isActive ? 'rgba(255,32,40,0.1)' : 'transparent',
      border: `1px solid ${isActive ? '#FF2028' : '#292929'}`,
      padding: '1rem', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.25s ease',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span className="mono" style={{ fontSize: '0.7rem', color: isActive ? '#FF2028' : '#565656', minWidth: '2ch' }}>{String(num).padStart(2, '0')}</span>
      <span style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '0.85rem', textTransform: 'uppercase', color: isActive ? '#F8F8F8' : '#A0A0A0' }}>{label}</span>
    </div>
    {isActive && (
      <div style={{ marginTop: '0.75rem', marginLeft: '2.25rem', fontSize: '0.8rem', color: '#A0A0A0', lineHeight: 1.6, animation: 'fadeIn 0.3s ease' }}>{desc}</div>
    )}
  </button>
);

const Ghost = ({ children, top, speed }) => (
  <div className="lp-ghost" data-speed={speed} style={{ top }} aria-hidden="true">{children}</div>
);

// ── MAIN LANDING PAGE ─────────────────────────
export default function LandingPage() {
  const rootRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const [activeSection, setActiveSection] = useState('');

  // Parallax engine, smooth anchor scrolling (only while this page is open), section highlight
  useEffect(() => {
    document.documentElement.classList.add('lp-smooth');
    const stopParallax = startParallax(rootRef.current);

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActiveSection(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    NAV.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });

    return () => {
      document.documentElement.classList.remove('lp-smooth');
      stopParallax();
      io.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className="lp-root" style={{ background: '#101010', minHeight: '100vh' }}>
      <div className="lp-progress" aria-hidden="true"><div data-page-progress /></div>
      <Navbar active={activeSection} />

      {/* ── HERO ── */}
      <section id="top" style={{ paddingTop: '100px', position: 'relative', overflow: 'hidden' }}>
        <div data-speed="0.22" style={{ position: 'absolute', inset: '-25% 0', backgroundImage: 'radial-gradient(circle, #292929 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.8, pointerEvents: 'none' }} />
        <div data-speed="0.3" style={{ position: 'absolute', top: '8%', right: '4%', width: 560, height: 560, pointerEvents: 'none' }}>
          <div className="lp-blob" style={{ background: 'radial-gradient(circle, rgba(255,32,40,0.13) 0%, transparent 68%)' }} />
        </div>
        <div data-speed="-0.06" style={{ position: 'absolute', top: '46%', left: '-8%', width: 520, height: 520, pointerEvents: 'none' }}>
          <div className="lp-blob" style={{ background: 'radial-gradient(circle, rgba(255,32,40,0.07) 0%, transparent 70%)', animationDelay: '-3s' }} />
        </div>
        <FloatingShapes />
        <CursorParticles />

        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '3rem 1.5rem 5rem', width: '100%', position: 'relative', zIndex: 2 }}>
          <div data-fade-out data-speed="0.1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Reveal delay={0} y={24}><SectionLabel>VIDPROTECT AI / CONTENT SECURITY SYSTEM</SectionLabel></Reveal>
            <Reveal delay={140} y={34} blur={10}><CyclingText phrases={HERO_LINES} interval={3200} /></Reveal>
            <Reveal delay={300} y={24}>
              <p style={{ marginTop: '2rem', color: '#A0A0A0', maxWidth: '600px', lineHeight: 1.7, fontSize: '1rem', marginLeft: 'auto', marginRight: 'auto' }}>
                Protect your premium video content with encrypted storage, verified learners, temporary streaming access, and intelligent security monitoring. Built for creators who take content security seriously.
              </p>
            </Reveal>
            <Reveal delay={450} y={20}>
              <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Magnetic>
                  <Link to="/login" className="btn btn-primary">PROTECT YOUR VIDEOS <ArrowRight size={14} /></Link>
                </Magnetic>
                <Magnetic>
                  <button className="btn btn-secondary" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>EXPLORE SECURITY</button>
                </Magnetic>
              </div>
            </Reveal>
            <Reveal delay={600} y={10} blur={0}>
              <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>AES-256 ENCRYPTION</span>
                <span style={{ color: '#292929' }}>·</span>
                <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>JWT AUTH</span>
                <span style={{ color: '#292929' }}>·</span>
                <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>TEMPORARY ACCESS</span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={700} y={60} blur={0}><HeroShowcase /></Reveal>
        </div>
      </section>

      {/* ── TICKER + NUMBERS ── */}
      <Marquee items={MARQUEE} />
      <section style={{ background: '#101010', borderBottom: '1px solid #292929' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', background: '#292929' }}>
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 90} y={26} style={{ background: '#131313', padding: '2.25rem 1.5rem', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: 'clamp(2.1rem, 5vw, 3.2rem)', lineHeight: 1, color: '#F8F8F8' }}>
                <Counter to={s.to} suffix={s.suffix} />
              </div>
              <div className="mono" style={{ fontSize: '0.7rem', color: '#808080', marginTop: '0.7rem', letterSpacing: '0.1em' }}>{s.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PROBLEMS (3D coverflow) ── */}
      <div style={{ background: '#101010', borderTop: '1px solid #292929' }}>
        <CardDeck3D
          cards={PROBLEMS}
          mode="coverflow"
          bg="#101010"
          kicker={<SectionLabel>THE PROBLEM</SectionLabel>}
          title={<>YOUR CONTENT DESERVES<br /><span className="red-highlight">BETTER PROTECTION.</span></>}
          subtitle="Scroll to reveal the four real problems VidProtect AI addresses."
        />
      </div>

      {/* ── FEATURES (3D rolodex) ── */}
      <div id="features" style={{ background: '#171717', borderTop: '1px solid #292929', borderBottom: '1px solid #292929' }}>
        <CardDeck3D
          cards={FEATURES}
          mode="rolodex"
          bg="#171717"
          kicker={<SectionLabel>SECURITY ARCHITECTURE</SectionLabel>}
          title={<>FOUR LAYERS.<br /><span className="red-highlight">ONE PROTECTED EXPERIENCE.</span></>}
          subtitle="Scroll to explore each security layer."
        />
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '3rem 1.5rem 6rem' }}>
          <Reveal>
            <div style={{ padding: '1.5rem', border: '1px solid #FF2028', background: 'rgba(255,32,40,0.04)' }}>
              <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginBottom: '0.5rem' }}>CORE SECURITY FORMULA</div>
              <div className="mono" style={{ fontSize: '0.75rem', color: '#F8F8F8', lineHeight: 1.8, letterSpacing: '0.05em' }}>
                AES-256 ENCRYPTION + JWT AUTHENTICATION + ENROLLMENT VERIFICATION
                <br />+ TEMPORARY STREAM TOKENS + ACCESS LOGGING + ANOMALY MONITORING
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── WORKFLOW ── */}
      <section id="how-it-works" style={{ background: '#101010', padding: '6rem 1.5rem', borderBottom: '1px solid #292929', position: 'relative', overflow: 'hidden' }}>
        <Ghost top="6%" speed="0.18">UPLOAD</Ghost>
        <div style={{ maxWidth: '1280px', margin: '0 auto', position: 'relative' }}>
          <Reveal>
            <SectionLabel>SECURITY WORKFLOW</SectionLabel>
            <h2 className="section-headline" style={{ marginTop: '1rem', marginBottom: '3rem' }}>
              FROM UPLOAD
              <br /><span className="red-highlight">TO SECURE STREAM.</span>
            </h2>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'flex-start' }} className="workflow-grid">
            <div style={{ position: 'relative', paddingLeft: '1.75rem' }}>
              <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 2, background: '#292929' }}>
                <div data-progress style={{ height: '100%', background: 'linear-gradient(#FF2028, #ff6a5c)', transformOrigin: 'top', transform: 'scaleY(0)', boxShadow: '0 0 14px rgba(255,32,40,0.6)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {WORKFLOW_STEPS.map((step, i) => (
                  <Reveal key={step.num} delay={i * 70} y={24}>
                    <WorkflowStep {...step} isActive={activeStep === i} onClick={() => setActiveStep(i === activeStep ? -1 : i)} />
                  </Reveal>
                ))}
              </div>
            </div>

            <Reveal delay={120} y={30} style={{ position: 'sticky', top: '80px' }}>
              <div style={{ background: '#171717', border: '1px solid #292929', padding: '2rem' }}>
                <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginBottom: '1rem' }}>WORKFLOW VISUALIZATION</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  {WORKFLOW_STEPS.map((s, i) => (
                    <button key={s.num} onClick={() => setActiveStep(i)} style={{
                      background: activeStep === i ? '#FF2028' : '#292929', border: 'none', color: '#F8F8F8', padding: '0.4rem 0.75rem',
                      fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', cursor: 'pointer', transition: 'background 0.2s', letterSpacing: '0.05em',
                    }}>
                      {String(s.num).padStart(2, '0')} {s.label.toUpperCase()}
                    </button>
                  ))}
                </div>
                {activeStep >= 0 && (
                  <div key={activeStep} style={{ animation: 'fadeIn 0.35s ease' }}>
                    <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '1rem' }}>{WORKFLOW_STEPS[activeStep]?.label}</div>
                    <p style={{ color: '#A0A0A0', fontSize: '0.9rem', lineHeight: 1.7 }}>{WORKFLOW_STEPS[activeStep]?.desc}</p>
                  </div>
                )}
                {activeStep < 0 && <p style={{ color: '#8B8B8B', fontSize: '0.85rem' }}>Select a workflow step to learn more.</p>}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <section id="comparison" style={{ background: '#171717', padding: '6rem 1.5rem', borderBottom: '1px solid #292929', position: 'relative', overflow: 'hidden' }}>
        <Ghost top="4%" speed="-0.12">VERSUS</Ghost>
        <div style={{ maxWidth: '1280px', margin: '0 auto', position: 'relative' }}>
          <Reveal>
            <SectionLabel>SECURITY COMPARISON</SectionLabel>
            <h2 className="section-headline" style={{ marginTop: '1rem', marginBottom: '3rem' }}>
              TRADITIONAL VS.
              <br /><span className="red-highlight">VIDPROTECT AI.</span>
            </h2>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1px', background: '#292929' }}>
            <div style={{ background: '#1D1D1D', padding: '2rem' }}>
              <Reveal><div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginBottom: '1.5rem' }}>TRADITIONAL VIDEO HOSTING</div></Reveal>
              {[
                'Potentially permanent, shareable video links',
                'Basic or limited access controls',
                'Increased risk of unauthorized sharing',
                'Limited visibility into access activity',
                'No enrollment-based authorization',
                'No automatic token expiry',
              ].map((item, i) => (
                <Reveal key={item} delay={i * 70} y={14} blur={3}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid #292929' }}>
                    <X size={14} color="#FF2028" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ color: '#A0A0A0', fontSize: '0.85rem' }}>{item}</span>
                  </div>
                </Reveal>
              ))}
            </div>

            <div style={{ background: '#1D1D1D', padding: '2rem', borderLeft: '3px solid #FF2028', boxShadow: 'inset 0 0 80px rgba(255,32,40,0.04)' }}>
              <Reveal><div className="mono" style={{ fontSize: '0.7rem', color: '#FF2028', marginBottom: '1.5rem' }}>VIDPROTECT AI</div></Reveal>
              {[
                'AES-256-GCM encrypted video storage, key per video',
                'User-specific temporary stream tokens',
                'Course enrollment verification before access',
                'Auditable access activity log',
                'Identity verification via JWT authentication',
                'Suspicious-event monitoring and alerts',
              ].map((item, i) => (
                <Reveal key={item} delay={120 + i * 70} y={14} blur={3}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid #292929' }}>
                    <CheckCircle size={14} color="#22c55e" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ color: '#F8F8F8', fontSize: '0.85rem' }}>{item}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={200}>
            <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', border: '1px solid #292929', background: '#101010' }}>
              <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>
                Note: Traditional platforms may include various security features. VidProtect AI does not guarantee complete piracy prevention, and it is currently in beta testing.
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── ROADMAP ── */}
      <section id="security" style={{ background: '#101010', padding: '6rem 1.5rem', borderBottom: '1px solid #292929', position: 'relative', overflow: 'hidden' }}>
        <Ghost top="2%" speed="0.16">NEXT</Ghost>
        <div style={{ maxWidth: '1280px', margin: '0 auto', position: 'relative' }}>
          <Reveal>
            <SectionLabel>FUTURE ROADMAP</SectionLabel>
            <h2 className="section-headline" style={{ marginTop: '1rem', marginBottom: '3rem' }}>
              WHAT'S
              <br /><span className="red-highlight">COMING NEXT.</span>
            </h2>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {ROADMAP.map((item, i) => (
              <Reveal key={item.num} delay={i * 110} y={44}>
                <SpotlightCard tilt={7} style={{ border: '1px solid #292929', padding: '1.5rem', background: '#1D1D1D', height: '100%' }}>
                  <div className="mono" style={{ fontSize: '1.5rem', color: '#333', marginBottom: '0.75rem' }}>{item.num}</div>
                  <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{item.label}</div>
                  <p style={{ color: '#808080', fontSize: '0.8rem', lineHeight: 1.6 }}>{item.desc}</p>
                  <div style={{ marginTop: '1rem' }}><span className="badge badge-grey" style={{ fontSize: '0.7rem' }}>PLANNED</span></div>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ background: '#171717', padding: '9rem 1.5rem', borderBottom: '1px solid #292929', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div data-speed="0.16" style={{ position: 'absolute', inset: '-10% 0', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }} aria-hidden="true">
          {[900, 640, 380].map((size, i) => (
            <div key={size} className="lp-ring" style={{ width: size, height: size, animationDuration: `${50 - i * 12}s`, animationDirection: i % 2 ? 'reverse' : 'normal', borderColor: i === 2 ? 'rgba(255,32,40,0.28)' : '#262626' }} />
          ))}
          <div className="lp-blob" style={{ position: 'absolute', width: 700, height: 700, background: 'radial-gradient(circle, rgba(255,32,40,0.12) 0%, transparent 65%)' }} />
        </div>
        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
          <Reveal y={40} blur={10}>
            <h2 className="section-headline" style={{ marginBottom: '1rem' }}>
              YOUR CONTENT.<br />
              <span className="red-highlight">YOUR RULES.</span>
            </h2>
            <p style={{ color: '#A0A0A0', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.7 }}>Build a safer learning experience with VidProtect AI.</p>
            <Magnetic strength={0.35}>
              <Link to="/login" className="btn btn-primary lp-cta" style={{ fontSize: '0.85rem', padding: '1rem 2rem' }}>
                ENTER VIDPROTECT <ArrowRight size={16} />
              </Link>
            </Magnetic>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#101010', padding: '3rem 1.5rem', borderTop: '1px solid #292929' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <Logo size="sm" />
              <p style={{ color: '#8B8B8B', fontSize: '0.8rem', marginTop: '1rem', lineHeight: 1.6 }}>Secure the Content. Protect the Creator. Empower Learning.</p>
            </div>
            <div>
              <div className="mono" style={{ fontSize: '0.7rem', color: '#A0A0A0', marginBottom: '1rem' }}>PRODUCT</div>
              {NAV.map(([id, label]) => (
                <div key={id} style={{ marginBottom: '0.5rem' }}>
                  <button onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })} className="lp-foot-link">{label}</button>
                </div>
              ))}
            </div>
            <div>
              <div className="mono" style={{ fontSize: '0.7rem', color: '#A0A0A0', marginBottom: '1rem' }}>PLATFORM</div>
              {[['Login', '/login'], ['Create an account', '/login'], ['Creator login', '/creator/login'], ['Privacy policy', '/privacy']].map(([label, to]) => (
                <div key={label} style={{ marginBottom: '0.5rem' }}><Link to={to} className="lp-foot-link">{label}</Link></div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid #292929', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>
              © {THIS_YEAR} VIDPROTECT AI. A SecureSphere — Cybersecurity & AI Product.
            </span>
            <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>BETA — Now in beta testing.</span>
          </div>
        </div>
      </footer>

      <style>{`
        /* ── page-level ── */
        html.lp-smooth { scroll-behavior: smooth; }
        .lp-root { overflow-x: clip; }
        .lp-root section[id], .lp-root div[id] { scroll-margin-top: 64px; }
        @media (max-width: 900px) { .workflow-grid { grid-template-columns: 1fr !important; } }

        /* ── scroll progress + nav ── */
        .lp-progress { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 130; pointer-events: none; }
        .lp-progress > div { height: 100%; background: linear-gradient(90deg, #FF2028, #ff6a5c); transform-origin: left; transform: scaleX(0); box-shadow: 0 0 12px rgba(255,32,40,0.7); }
        .lp-nav { background: transparent; border-bottom: 1px solid transparent; transition: background 0.35s ease, border-color 0.35s ease, backdrop-filter 0.35s ease; }
        .lp-nav.solid { background: rgba(16,16,16,0.88); border-bottom-color: #292929; backdrop-filter: blur(12px); }
        .lp-nav-link { position: relative; background: none; border: none; color: #A0A0A0; cursor: pointer; font-family: IBM Plex Mono, monospace; font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.3rem 0; transition: color 0.2s; }
        .lp-nav-link::after { content: ''; position: absolute; left: 0; right: 0; bottom: -2px; height: 2px; background: #FF2028; transform: scaleX(0); transform-origin: left; transition: transform 0.35s cubic-bezier(.2,.7,.2,1); }
        .lp-nav-link:hover, .lp-nav-link.active { color: #F8F8F8; }
        .lp-nav-link:hover::after, .lp-nav-link.active::after { transform: scaleX(1); }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .desktop-cta { display: none !important; }
          .mobile-nav-btn { display: flex !important; }
        }
        .lp-foot-link { background: none; border: none; padding: 0; color: #565656; font-size: 0.85rem; cursor: pointer; text-decoration: none; transition: color 0.2s, transform 0.2s; display: inline-block; }
        .lp-foot-link:hover { color: #F8F8F8; transform: translateX(4px); }

        /* ── reveal ── */
        .lp-reveal { opacity: 0; transform: translate3d(0, var(--y, 32px), 0); filter: blur(var(--blur, 6px));
          transition: opacity 0.9s cubic-bezier(.2,.7,.2,1) var(--delay, 0ms), transform 0.9s cubic-bezier(.2,.7,.2,1) var(--delay, 0ms), filter 0.9s cubic-bezier(.2,.7,.2,1) var(--delay, 0ms); }
        .lp-reveal.in { opacity: 1; transform: none; filter: none; }

        /* ── hero ── */
        .lp-blob { width: 100%; height: 100%; border-radius: 50%; animation: lpBlob 9s ease-in-out infinite; }
        .lp-float { animation: lpFloat 10s ease-in-out infinite; display: block; }
        .lp-magnetic { display: inline-block; transition: transform 0.25s cubic-bezier(.2,.7,.2,1); }
        .lp-showcase { position: relative; max-width: 760px; margin: 4.5rem auto 0; perspective: 1500px; }
        .lp-showcase-flat { transform-origin: 50% 100%; will-change: transform, opacity; }
        .lp-showcase-mouse { transition: transform 0.3s ease-out; transform-style: preserve-3d; }
        .lp-window { position: relative; background: #171717; border: 1px solid #3a3a3a; padding: 1.25rem; box-shadow: 0 50px 100px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,32,40,0.12), 14px 14px 0 #222; }
        .lp-window::after { content: ''; position: absolute; top: 0; right: 0; width: 3px; height: 100%; background: #FF2028; }
        .lp-window-bar { display: flex; align-items: center; gap: 0.4rem; padding-bottom: 0.75rem; margin-bottom: 1rem; border-bottom: 1px solid #292929; }
        .lp-window-bar > span { width: 10px; height: 10px; border-radius: 50%; background: #292929; }
        .lp-window-bar em { margin-left: 0.5rem; font-style: normal; font-size: 0.6rem; color: #565656; }
        .lp-window-bar b { margin-left: auto; display: flex; align-items: center; gap: 0.35rem; font-size: 0.6rem; color: #FF2028; font-weight: 400; }
        .lp-window-bar b i { width: 7px; height: 7px; border-radius: 50%; background: #FF2028; animation: lpPulse 1.4s ease-in-out infinite; }
        .lp-viewport { position: relative; height: 220px; margin-bottom: 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; background: #0c0c0c; border: 1px solid #292929; background-image: radial-gradient(circle, #1d1d1d 1px, transparent 1px); background-size: 20px 20px; }
        .lp-scan { position: absolute; left: 0; right: 0; height: 80px; background: linear-gradient(180deg, transparent, rgba(255,32,40,0.14), transparent); animation: lpScan 4.5s linear infinite; }
        .lp-wm { position: absolute; font-size: 0.55rem; color: rgba(255,32,40,0.55); animation: lpWm 14s ease-in-out infinite; }
        .lp-bar { height: 4px; background: #292929; margin-bottom: 0.9rem; }
        .lp-bar div { height: 100%; background: #FF2028; animation: lpBar 14s linear infinite; }
        .lp-rows > div { display: flex; justify-content: space-between; padding: 0.45rem 0; border-bottom: 1px solid #1D1D1D; }
        .lp-rows span:first-child { font-size: 0.6rem; color: #565656; }
        .lp-rows span:last-child { font-size: 0.68rem; }
        .lp-chip-wrap { position: absolute; z-index: 3; }
        .lp-chip { display: flex; align-items: center; gap: 0.45rem; padding: 0.5rem 0.8rem; background: rgba(23,23,23,0.92); border: 1px solid #3a3a3a; box-shadow: 0 14px 30px rgba(0,0,0,0.5); font-size: 0.62rem; color: #F8F8F8; white-space: nowrap; animation: lpFloat 6s ease-in-out infinite; backdrop-filter: blur(6px); }
        .lp-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; animation: lpPulse 1.4s ease-in-out infinite; }
        @media (max-width: 720px) { .lp-chip-wrap { display: none; } .lp-viewport { height: 170px; } }

        /* ── ticker ── */
        .lp-marquee { overflow: hidden; background: #131313; border-top: 1px solid #292929; border-bottom: 1px solid #292929; padding: 0.95rem 0; -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
        .lp-marquee-track { display: flex; width: max-content; animation: lpMarquee 36s linear infinite; }
        .lp-marquee:hover .lp-marquee-track { animation-play-state: paused; }
        .lp-marquee-item { font-family: IBM Plex Mono, monospace; font-size: 0.7rem; letter-spacing: 0.12em; color: #808080; padding: 0 2rem; white-space: nowrap; }

        /* ── spotlight cards ── */
        .lp-spot { position: relative; overflow: hidden; transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)); transition: transform 0.3s ease-out, border-color 0.3s, box-shadow 0.3s; will-change: transform; }
        .lp-spot::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 0.3s; background: radial-gradient(280px circle at var(--mx, 50%) var(--my, 50%), rgba(255,32,40,0.16), transparent 70%); }
        .lp-spot:hover { border-color: #FF2028 !important; box-shadow: 0 24px 50px rgba(0,0,0,0.5); }
        .lp-spot:hover::before { opacity: 1; }
        .lp-step:hover { border-color: #FF2028 !important; }
        .lp-ghost { position: absolute; left: 0; right: 0; text-align: center; font-family: Archivo Black, sans-serif; font-size: clamp(5.5rem, 21vw, 17rem); line-height: 0.85; color: transparent; -webkit-text-stroke: 1px #232323; letter-spacing: -0.02em; pointer-events: none; user-select: none; white-space: nowrap; will-change: transform; }

        /* ── 3D card decks ── */
        .lp3d-pin { position: sticky; top: 0; height: 100vh; overflow: hidden; }
        .lp3d-floor { position: absolute; left: -25%; right: -25%; bottom: -8%; height: 58%; opacity: 0.75; pointer-events: none;
          transform: perspective(520px) rotateX(64deg); transform-origin: 50% 100%;
          background-image: linear-gradient(rgba(255,32,40,0.24) 1px, transparent 1px), linear-gradient(90deg, rgba(255,32,40,0.16) 1px, transparent 1px);
          background-size: 64px 64px;
          -webkit-mask-image: radial-gradient(ellipse at 50% 100%, #000 12%, transparent 68%); mask-image: radial-gradient(ellipse at 50% 100%, #000 12%, transparent 68%); }
        .lp3d-ghost { position: absolute; right: 2%; top: 50%; font-family: Archivo Black, sans-serif; font-size: clamp(9rem, 32vw, 28rem); line-height: 1; color: transparent; -webkit-text-stroke: 1px rgba(255,255,255,0.07); pointer-events: none; user-select: none; will-change: transform; }
        .lp3d-orb { position: absolute; border-radius: 50%; pointer-events: none; will-change: transform; }
        .lp3d-layout { position: relative; height: 100%; max-width: 1280px; margin: 0 auto; padding: 84px 1.5rem 2.5rem; display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: 2rem; align-items: center; }
        .lp3d-title-h { margin-top: 1rem; margin-bottom: 0.75rem; font-size: clamp(2rem, 4.1vw, 3.3rem) !important; }
        .lp3d-sub { color: #A0A0A0; font-size: 0.95rem; max-width: 420px; }
        .lp3d-rail { list-style: none; margin: 2rem 0 0; padding: 0 0 0 1.4rem; position: relative; max-width: 420px; }
        .lp3d-rail::before { content: ''; position: absolute; left: 0; top: 6px; bottom: 6px; width: 2px; background: #292929; }
        .lp3d-rail-fill { position: absolute; left: 0; top: 6px; bottom: 6px; width: 2px; background: linear-gradient(#FF2028, #ff6a5c); transform-origin: top; transform: scaleY(0); box-shadow: 0 0 12px rgba(255,32,40,0.6); }
        .lp3d-rail li { display: flex; gap: 0.8rem; align-items: baseline; padding: 0.5rem 0; cursor: pointer; color: #565656; font-size: 0.85rem; transition: color 0.3s, transform 0.4s cubic-bezier(.2,.7,.2,1); }
        .lp3d-rail li:hover { color: #A0A0A0; }
        .lp3d-rail li[data-active="true"] { color: #F8F8F8; transform: translateX(8px); }
        .lp3d-rail li .num { color: #444; transition: color 0.3s; }
        .lp3d-rail li[data-active="true"] .num { color: #FF2028; }
        .lp3d-stage { position: relative; height: min(66vh, 540px); perspective: 1500px; perspective-origin: 50% 42%; --rx: 0; --ry: 0; --gx: 50%; --gy: 30%; }
        .lp3d-world { position: absolute; inset: 0; transform-style: preserve-3d; }
        .lp3d-card { position: absolute; left: 50%; top: 50%; width: var(--cw, 420px); transform-style: preserve-3d; backface-visibility: hidden; will-change: transform, opacity; }
        .lp3d-face { position: relative; transform-style: preserve-3d; padding: 2.3rem 2rem 2.1rem; background: linear-gradient(160deg, #202020, #141414); border: 1px solid #2c2c2c; box-shadow: 0 30px 70px rgba(0,0,0,0.55); transition: transform 0.25s ease-out, border-color 0.4s, box-shadow 0.4s; }
        .lp3d-card[data-active="true"] .lp3d-face { border-color: #FF2028; box-shadow: 0 44px 100px rgba(255,32,40,0.24), 0 0 0 1px rgba(255,32,40,0.22); transform: rotateX(calc(var(--rx) * 1deg)) rotateY(calc(var(--ry) * 1deg)); }
        .lp3d-glare { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 0.3s; background: radial-gradient(380px circle at var(--gx) var(--gy), rgba(255,255,255,0.09), transparent 60%); }
        .lp3d-card[data-active="true"] .lp3d-glare { opacity: 1; }
        .lp3d-num { position: absolute; top: 0.9rem; right: 1.2rem; font-size: 0.68rem; color: #565656; transform: translateZ(28px); }
        .lp3d-icon { display: inline-flex; padding: 0.8rem; margin-bottom: 1.2rem; border: 1px solid rgba(255,32,40,0.5); background: rgba(255,32,40,0.08); transform: translateZ(74px); box-shadow: 0 16px 32px rgba(255,32,40,0.22); }
        .lp3d-tag { transform: translateZ(56px); display: block; margin-bottom: 0.9rem; }
        .lp3d-title { font-family: Archivo Black, sans-serif; font-size: 1.12rem; text-transform: uppercase; letter-spacing: -0.01em; color: #F8F8F8; margin-bottom: 0.7rem; transform: translateZ(46px); }
        .lp3d-text { color: #A0A0A0; font-size: 0.9rem; line-height: 1.7; transform: translateZ(20px); }
        .lp3d-dots { z-index: 200; position: absolute; bottom: -2.1rem; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; }
        .lp3d-dots div { height: 8px; border-radius: 4px; transition: width 0.3s ease, background 0.3s ease; }
        .lp3d-counter { z-index: 200; position: absolute; top: 0; right: 0; font-size: 0.7rem; color: #565656; }
        @media (max-width: 900px) {
          .lp3d-layout { grid-template-columns: 1fr; grid-template-rows: auto 1fr; gap: 0.5rem; padding-top: 76px; align-items: start; }
          .lp3d-rail, .lp3d-sub, .lp3d-ghost { display: none; }
          .lp3d-title-h { font-size: clamp(1.5rem, 6.5vw, 2.2rem) !important; margin-top: 0.5rem; }
          .lp3d-stage { height: 56vh; }
          .lp3d-face { padding: 1.6rem 1.3rem; }
        }

        /* ── final CTA ── */
        .lp-ring { position: absolute; border-radius: 50%; border: 1px dashed #262626; animation: lpSpin 50s linear infinite; }
        .lp-cta { box-shadow: 0 0 0 rgba(255,32,40,0.5); animation: lpGlow 2.6s ease-in-out infinite; }

        /* ── keyframes ── */
        @keyframes lpBlob { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.14); opacity: 0.7; } }
        @keyframes lpFloat { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-14px) rotate(4deg); } }
        @keyframes lpPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.8); } }
        @keyframes lpScan { from { top: -90px; } to { top: 100%; } }
        @keyframes lpBar { from { width: 0; } to { width: 100%; } }
        @keyframes lpWm { 0%, 100% { top: 10%; left: 8%; } 33% { top: 72%; left: 55%; } 66% { top: 28%; left: 62%; } }
        @keyframes lpMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes lpSpin { to { transform: rotate(360deg); } }
        @keyframes lpGlow { 0%, 100% { box-shadow: 0 0 0 rgba(255,32,40,0); } 50% { box-shadow: 0 0 36px rgba(255,32,40,0.45); } }

        @media (prefers-reduced-motion: reduce) {
          .lp-reveal { opacity: 1; transform: none; filter: none; transition: none; }
          .lp-root *, .lp-root *::before { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
