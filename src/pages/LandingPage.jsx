// ============================================
// LANDING PAGE — VidProtect AI
// ============================================

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Lock, Eye, Zap, AlertTriangle, CheckCircle, X,
  ArrowRight
} from 'lucide-react';
import { Logo, SectionLabel } from '../components/SharedComponents';

// ── SCROLL REVEAL HOOK ─────────────────────
const useScrollReveal = (threshold = 0.15) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, visible];
};

// ── PARALLAX HOOK ────────────────────────────
const useParallax = (speed = 0.5) => {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let animationFrameId;
    const handleScroll = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        setOffset(window.scrollY * speed);
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, [speed]);
  return offset;
};

// ── STAGGERED CARD REVEAL HOOK ──────────────────
// Fires individual callbacks per-card so they animate in sequence
const useStaggerReveal = (count, threshold = 0.2) => {
  const containerRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Stagger each card by 120ms
          for (let i = 0; i < count; i++) {
            setTimeout(() => setVisibleCount(prev => Math.max(prev, i + 1)), i * 140);
          }
          observer.disconnect();
        }
      },
      { threshold }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [count, threshold]);
  return [containerRef, visibleCount];
};

// ── CURSOR PARTICLES ANIMATION ───────────────
const CursorParticles = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    let mouse = { x: null, y: null };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    class Particle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 0.5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = Math.random() * 2 + 1;
        this.life = 1;
        this.decay = Math.random() * 0.015 + 0.01;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
      }
      draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 32, 40, ${this.life})`;
        ctx.fill();
      }
    }

    const onMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      // Add a few particles on mouse move
      for (let i = 0; i < 3; i++) {
        particles.push(new Particle(mouse.x, mouse.y));
      }
    };
    window.addEventListener('mousemove', onMouseMove);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, index) => {
        p.update();
        p.draw(ctx);
        if (p.life <= 0) particles.splice(index, 1);
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} />;
};

// ── CYCLING TEXT PHRASES ──────────────────
const HERO_LINES = [
  { line1: 'YOUR VIDEOS.', highlight: 'LOCKED IN.' },
  { line1: 'STOP PIRACY.', highlight: 'DEAD COLD.' },
  { line1: 'ENCRYPT IT.', highlight: 'DELIVER IT.' },
  { line1: 'SECURE NOW.', highlight: 'PERIOD.' },
];

// ── ANIMATED CYCLING TEXT ─────────────────
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

// ── FLOATING SHAPES ──────────────────────────
const FloatingShapes = () => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
    {/* Left Side Shapes */}
    <svg style={{ position: 'absolute', top: '25%', left: '8%', animation: 'float1 8s ease-in-out infinite' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#292929" strokeWidth="1" strokeLinejoin="round">
      <path d="M12 2L22 20H2L12 2Z" />
    </svg>
    <svg style={{ position: 'absolute', bottom: '20%', left: '15%', animation: 'float3 9s ease-in-out infinite' }} width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FF2028" strokeOpacity="0.3" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" />
    </svg>
    <svg style={{ position: 'absolute', top: '50%', left: '4%', animation: 'float2 11s ease-in-out infinite' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#292929" strokeWidth="1">
      <circle cx="12" cy="12" r="10" />
    </svg>
    <svg style={{ position: 'absolute', bottom: '10%', left: '25%', animation: 'float1 14s ease-in-out infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#565656" strokeWidth="2">
      <path d="M12 5V19M5 12H19" />
    </svg>

    {/* Right Side Shapes */}
    <svg style={{ position: 'absolute', top: '30%', right: '18%', animation: 'float1 12s ease-in-out infinite' }} width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#292929" strokeWidth="1.5">
      <path d="M12 5V19M5 12H19" />
    </svg>
    <svg style={{ position: 'absolute', top: '65%', right: '10%', animation: 'float2 10s ease-in-out infinite' }} width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#292929" strokeWidth="1">
      <circle cx="12" cy="12" r="10" />
    </svg>
    <svg style={{ position: 'absolute', top: '15%', right: '8%', animation: 'float3 15s ease-in-out infinite' }} width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF2028" strokeOpacity="0.15" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M12 2L22 20H2L12 2Z" />
    </svg>
    <svg style={{ position: 'absolute', bottom: '25%', right: '22%', animation: 'float2 13s ease-in-out infinite' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#292929" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" />
    </svg>

    {/* Center background (very faint/distant) */}
    <svg style={{ position: 'absolute', top: '10%', left: '45%', animation: 'float3 16s ease-in-out infinite' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#292929" strokeOpacity="0.5" strokeWidth="1">
      <circle cx="12" cy="12" r="10" />
    </svg>
  </div>
);

// ── NAV ──────────────────────────────────────
const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(16,16,16,0.97)',
      borderBottom: '1px solid #292929',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', height: '60px', gap: '2rem' }}>
        <Logo size="sm" />

        <nav style={{ display: 'flex', gap: '1.5rem', flex: 1 }} className="desktop-nav">
          {['features', 'how-it-works', 'security', 'comparison'].map(id => (
            <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'color 0.15s' }}
              onMouseEnter={e => e.target.style.color = '#F8F8F8'}
              onMouseLeave={e => e.target.style.color = '#A0A0A0'}>
              {id.replace('-', ' ')}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }} className="desktop-cta">
          <Link to="/login" className="btn btn-ghost" style={{ fontSize: '0.7rem' }}>LOGIN</Link>
          <Link to="/login" className="btn btn-primary" style={{ fontSize: '0.7rem' }}>GET PROTECTED</Link>
        </div>

        <button onClick={() => setMenuOpen(!menuOpen)} style={{ display: 'none', background: 'none', border: 'none', color: '#F8F8F8', cursor: 'pointer' }} className="mobile-nav-btn">
          {menuOpen ? <X size={22} /> : <span style={{ fontSize: '1.2rem' }}>☰</span>}
        </button>
      </div>

      {menuOpen && (
        <div style={{ background: '#171717', borderTop: '1px solid #292929', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {['features', 'how-it-works', 'security', 'comparison'].map(id => (
            <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.75rem', textAlign: 'left', padding: '0.4rem 0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {id.replace('-', ' ')}
            </button>
          ))}
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <Link to="/login" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => setMenuOpen(false)}>LOGIN</Link>
            <Link to="/login" className="btn btn-primary" style={{ fontSize: '0.7rem' }} onClick={() => setMenuOpen(false)}>GET PROTECTED</Link>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .desktop-cta { display: none !important; }
          .mobile-nav-btn { display: flex !important; }
        }
      `}</style>
    </header>
  );
};

// ── HERO INTERFACE ILLUSTRATION ───────────────
const HeroIllustration = () => (
  <div style={{
    background: '#171717',
    border: '1px solid #EEEEEE',
    padding: '1.5rem',
    position: 'relative',
    maxWidth: '480px',
    width: '100%',
    boxShadow: '8px 8px 0px #292929',
  }}>
    {/* Title bar */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #292929' }}>
      <div style={{ width: 10, height: 10, background: '#FF2028', borderRadius: '50%' }} />
      <div style={{ width: 10, height: 10, background: '#292929', borderRadius: '50%' }} />
      <div style={{ width: 10, height: 10, background: '#292929', borderRadius: '50%' }} />
      <span className="mono" style={{ marginLeft: '0.5rem', fontSize: '0.6rem', color: '#565656' }}>SECURE_STREAM_PLAYER.exe</span>
    </div>

    {/* Video viewport */}
    <div style={{
      background: '#101010',
      border: '1px solid #292929',
      height: '160px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      marginBottom: '1rem',
      backgroundImage: 'radial-gradient(circle, #1a1a1a 1px, transparent 1px)',
      backgroundSize: '20px 20px',
    }}>
      <Shield size={40} color="#FF2028" strokeWidth={1.5} />
      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span className="badge badge-red" style={{ fontSize: '0.55rem' }}>⚿ PROTECTED</span>
        <span className="badge badge-green" style={{ fontSize: '0.55rem' }}>✓ ENCRYPTED</span>
      </div>
      {/* Watermark overlay */}
      <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', opacity: 0.3 }}>
        <span className="mono" style={{ fontSize: '0.5rem', color: '#FF2028', transform: 'rotate(-15deg)', display: 'block' }}>SARAH CHEN · sess-a1b2</span>
      </div>
    </div>

    {/* Status rows */}
    {[
      { label: 'SESSION VERIFIED', value: '✓ ACTIVE', color: '#22c55e' },
      { label: 'ACCESS MONITORED', value: '● LOGGING', color: '#eab308' },
      { label: 'TOKEN EXPIRY', value: '28:42', color: '#F8F8F8' },
    ].map(row => (
      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #1D1D1D' }}>
        <span className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>{row.label}</span>
        <span className="mono" style={{ fontSize: '0.65rem', color: row.color }}>{row.value}</span>
      </div>
    ))}

    {/* Token ID */}
    <div style={{ marginTop: '0.75rem', background: '#101010', padding: '0.5rem', border: '1px solid #1D1D1D' }}>
      <span className="mono" style={{ fontSize: '0.55rem', color: '#565656', wordBreak: 'break-all' }}>
        VP-TOK-X9K2M7N4P1Q8R3S6... [EXAMPLE]
      </span>
    </div>

    {/* Red accent corner */}
    <div style={{ position: 'absolute', top: 0, right: 0, width: '3px', height: '100%', background: '#FF2028' }} />
  </div>
);

// ── WORKFLOW STEP ─────────────────────────────
const WorkflowStep = ({ num, label, desc, isActive, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: isActive ? 'rgba(255,32,40,0.1)' : 'transparent',
      border: `1px solid ${isActive ? '#FF2028' : '#292929'}`,
      padding: '1rem',
      cursor: 'pointer',
      textAlign: 'left',
      width: '100%',
      transition: 'all 0.15s',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span className="mono" style={{ fontSize: '0.65rem', color: isActive ? '#FF2028' : '#565656', minWidth: '2ch' }}>
        {String(num).padStart(2, '0')}
      </span>
      <span style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '0.85rem', textTransform: 'uppercase', color: isActive ? '#F8F8F8' : '#A0A0A0' }}>
        {label}
      </span>
    </div>
    {isActive && (
      <div style={{ marginTop: '0.75rem', marginLeft: '2.25rem', fontSize: '0.8rem', color: '#A0A0A0', lineHeight: 1.6, animation: 'fadeIn 0.3s ease' }}>
        {desc}
      </div>
    )}
  </button>
);

const WORKFLOW_STEPS = [
  { num: 1, label: 'Upload', desc: 'Creators upload videos with metadata including title, course association, and access rules. The platform validates inputs and tracks upload progress.' },
  { num: 2, label: 'Encrypt', desc: 'Every video is encrypted with AES-256-GCM, using its own random key, before it is written to storage. The key itself is encrypted by a master key kept outside the database, and every block is integrity-checked on playback.' },
  { num: 3, label: 'Store', desc: 'Encrypted video data and metadata are stored in a protected location. Metadata includes title, creator ID, course association, and protection status. No public URL to the original file is exposed.' },
  { num: 4, label: 'Verify', desc: 'When a learner requests access, the backend authenticates their identity via JWT, then verifies enrollment in the relevant course. Authentication establishes identity; authorization determines access rights.' },
  { num: 5, label: 'Stream', desc: 'Only after all authorization checks pass, the platform issues a short-lived streaming token tied to the specific learner and video session. The token expires automatically.' },
  { num: 6, label: 'Monitor', desc: 'Every access attempt — successful or denied — is logged with timestamp, user, video, result, and reason. Unusual patterns generate security alerts for creator review.' },
];

const FEATURES = [
  { icon: Lock, label: 'Encrypted Storage', desc: 'AES-256 encryption applied before content reaches storage. Encrypted data should remain protected even if storage is exposed.', tag: 'AES-256' },
  { icon: Shield, label: 'Authentication', desc: 'JWT-based identity verification confirms who is making each streaming request before access decisions are made.', tag: 'JWT AUTH' },
  { icon: Zap, label: 'Temporary Access', desc: 'Short-lived, user-specific streaming tokens replace permanent public URLs. Tokens expire automatically and cannot be reused indefinitely.', tag: 'AUTO-EXPIRY' },
  { icon: Eye, label: 'Continuous Monitoring', desc: 'Access attempts, denials, token events, and unusual patterns are logged and surfaced in the security alert center.', tag: 'REAL-TIME' },
];

const PROBLEMS = [
  { icon: AlertTriangle, label: 'Permanent Links Enable Sharing', desc: 'Normal video URLs can be forwarded to unauthorized viewers. VidProtect AI aims to replace them with expiring, user-specific stream tokens.' },
  { icon: X, label: 'Content Piracy Causes Revenue Loss', desc: 'Premium educational content represents real investment. Unauthorized access can undermine creator revenue and devalue paid courses.' },
  { icon: Lock, label: 'Enterprise Protection Is Inaccessible', desc: 'Sophisticated video security infrastructure is often out of reach for independent creators. VidProtect AI aims to make key controls available without requiring enterprise resources.' },
  { icon: Eye, label: 'Suspicious Activity Goes Unnoticed', desc: 'Repeated denials, expired-token reuse, and unusual access frequency can indicate misuse. VidProtect AI logs events and surfaces patterns for review.' },
];

// ── 3D SCROLL CARD DECK ─────────────────────────
// Uses continuous scroll progress (not discrete indices) for perfectly smooth animation
const ScrollCardDeck = ({ cards, renderCard, bg = '#101010', headerContent }) => {
  const sectionRef = useRef(null);
  // scrollProg: continuous 0 → (cards.length-1) based on scroll position
  const [scrollProg, setScrollProg] = useState(0);

  useEffect(() => {
    let raf;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = sectionRef.current;
        if (!el) return;
        const { top, height } = el.getBoundingClientRect();
        const scrollable = height - window.innerHeight;
        const p = Math.max(0, Math.min(1, -top / scrollable));
        // Map 0→1 to 0→(cards.length-1) so each card gets equal scroll budget
        setScrollProg(p * (cards.length - 1));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [cards.length]);

  const activeIndex = Math.round(scrollProg);

  return (
    <div ref={sectionRef} style={{ height: `${cards.length * 100}vh`, position: 'relative' }}>
      <div style={{
        position: 'sticky', top: 0, height: '100vh',
        display: 'flex', flexDirection: 'column',
        perspective: '1400px', overflow: 'hidden', background: bg,
      }}>
        {headerContent && (
          <div style={{ position: 'relative', zIndex: 20 }}>
            {headerContent}
          </div>
        )}

        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          {/* Progress dots — use rounded index for display */}
          <div style={{ position: 'absolute', bottom: '2.5rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 10 }}>
            {cards.map((_, i) => (
              <div key={i} style={{
                width: i === activeIndex ? 24 : 8, height: 8,
                background: i === activeIndex ? '#FF2028' : '#3a3a3a',
                borderRadius: 4,
                transition: 'all 0.3s ease',
              }} />
            ))}
          </div>

          {/* Card counter */}
          <div style={{ position: 'absolute', top: '1rem', right: '2rem', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', color: '#565656', zIndex: 10 }}>
            {String(activeIndex + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}
          </div>

          {cards.map((card, i) => {
            // Continuous offset — fractional so animation is frame-accurate
            const offset = i - scrollProg;
            const isActive = Math.abs(offset) < 0.5;

            // Clamp depth for performance
            const clampedOffset = Math.max(-2, Math.min(4, offset));

            // Cards ahead (offset>0): stacked behind, pushed right+back with Y rotation
            // Active card (offset≈0): front and center
            // Past cards (offset<0): swept far left, faded out
            const translateX = clampedOffset < 0
              ? clampedOffset * 600          // exit left, proportional to progress
              : clampedOffset * 85;          // stack right, proportional
            const translateZ = clampedOffset <= 0
              ? Math.max(-400, clampedOffset * 300)   // past cards go behind
              : -clampedOffset * 110;                  // future cards stack back
            const rotateY = clampedOffset > 0 ? -clampedOffset * 10 : 0;
            const scale = Math.max(0.68, 1 - Math.abs(clampedOffset) * 0.09);
            const opacity = clampedOffset < -0.4
              ? Math.max(0, 1 + clampedOffset * 4)  // quick fade as it leaves left
              : clampedOffset > 0
                ? Math.max(0, 1 - clampedOffset * 0.3) // gentle fade as depth increases
                : 1;

            return (
              <div key={i} style={{
                position: 'absolute',
                width: 'min(520px, 90vw)',
                opacity,
                // NO CSS transition — position is computed directly per scroll frame = perfectly smooth
                transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                zIndex: Math.round(cards.length * 10 - Math.abs(offset) * 10),
                transformStyle: 'preserve-3d',
                willChange: 'transform, opacity',
                pointerEvents: isActive ? 'all' : 'none',
              }}>
                {renderCard(card, i, isActive)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const renderProblemCard = ({ icon: Icon, label, desc }, _i, isActive) => (
  <div style={{
    background: '#171717',
    border: `1px solid ${isActive ? '#FF2028' : '#292929'}`,
    padding: '2.5rem 2rem',
    boxShadow: isActive ? '0 24px 60px rgba(255,32,40,0.18)' : '0 8px 24px rgba(0,0,0,0.4)',
    transition: 'border-color 0.4s, box-shadow 0.4s',
  }}>
    <Icon size={32} color="#FF2028" strokeWidth={1.5} style={{ marginBottom: '1.25rem' }} />
    <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '-0.01em', color: '#F8F8F8' }}>{label}</div>
    <p style={{ color: '#A0A0A0', fontSize: '0.9rem', lineHeight: 1.7 }}>{desc}</p>
  </div>
);

const renderFeatureCard = ({ icon: Icon, label, desc, tag }, _i, isActive) => (
  <div style={{
    background: '#1D1D1D',
    border: `1px solid ${isActive ? '#FF2028' : '#292929'}`,
    padding: '2.5rem 2rem',
    boxShadow: isActive ? '0 24px 60px rgba(255,32,40,0.18)' : '0 8px 24px rgba(0,0,0,0.4)',
    transition: 'border-color 0.4s, box-shadow 0.4s',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
      <Icon size={32} color="#FF2028" strokeWidth={1.5} />
      <span className="badge badge-red" style={{ fontSize: '0.6rem' }}>{tag}</span>
    </div>
    <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '-0.01em', color: '#F8F8F8' }}>{label}</div>
    <p style={{ color: '#A0A0A0', fontSize: '0.9rem', lineHeight: 1.7 }}>{desc}</p>
  </div>
);

// ── MAIN LANDING PAGE ─────────────────────────
export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [heroVisible, setHeroVisible] = useState(false);
  const [problemsRef, problemsVisible] = useScrollReveal();
  const [featuresRef, featuresVisible] = useScrollReveal();
  const [workflowRef, workflowVisible] = useScrollReveal();
  const [comparisonRef, comparisonVisible] = useScrollReveal();
  const [ctaRef, ctaVisible] = useScrollReveal(0.3);
  
  // Parallax offset for hero (moves slower than scroll)
  const heroParallax = useParallax(0.35);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ background: '#101010', minHeight: '100vh' }}>
      <Navbar />

      {/* ── HERO ── */}
      <section style={{
        paddingTop: '100px',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        backgroundImage: 'radial-gradient(circle, #292929 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Animated red glow blob */}
        <div style={{
          position: 'absolute', top: '20%', right: '10%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(255,32,40,0.07) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'blobPulse 6s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <FloatingShapes />
        <CursorParticles />
        <div style={{
          maxWidth: '1280px', margin: '0 auto', padding: '4rem 1.5rem', width: '100%',
          position: 'relative', zIndex: 2,
          transform: `translateY(${heroParallax}px)`,
          transition: 'transform 0.1s cubic-bezier(0.1, 0.5, 0.1, 1)' // smooth catching up
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            {/* Center: Copy */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.6s ease, transform 0.6s ease', transitionDelay: '0ms' }}>
                <SectionLabel>VIDPROTECT AI / CONTENT SECURITY SYSTEM</SectionLabel>
              </div>

              <div style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(32px)', transition: 'opacity 0.7s ease, transform 0.7s ease', transitionDelay: '150ms' }}>
                <CyclingText phrases={HERO_LINES} interval={3200} />
              </div>

              <div style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.7s ease, transform 0.7s ease', transitionDelay: '300ms' }}>
                <p style={{ marginTop: '2rem', color: '#A0A0A0', maxWidth: '600px', lineHeight: 1.7, fontSize: '1rem', marginLeft: 'auto', marginRight: 'auto' }}>
                  Protect your premium video content with encrypted storage, verified learners, temporary streaming access, and intelligent security monitoring. Built for creators who take content security seriously.
                </p>
              </div>

              <div style={{ opacity: heroVisible ? 1 : 0, transform: heroVisible ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity 0.7s ease, transform 0.7s ease', transitionDelay: '450ms' }}>
                <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Link to="/login" className="btn btn-primary">
                    PROTECT YOUR VIDEOS <ArrowRight size={14} />
                  </Link>
                  <button className="btn btn-secondary" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
                    EXPLORE SECURITY
                  </button>
                </div>
              </div>

              <div style={{ opacity: heroVisible ? 1 : 0, transition: 'opacity 0.7s ease', transitionDelay: '600ms' }}>
                <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className="mono" style={{ fontSize: '0.65rem', color: '#565656' }}>AES-256 ENCRYPTION</span>
                  <span style={{ color: '#292929' }}>·</span>
                  <span className="mono" style={{ fontSize: '0.65rem', color: '#565656' }}>JWT AUTH</span>
                  <span style={{ color: '#292929' }}>·</span>
                  <span className="mono" style={{ fontSize: '0.65rem', color: '#565656' }}>TEMPORARY ACCESS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEMS (scroll-driven 3D card deck) ── */}
      <div style={{ background: '#101010', borderTop: '1px solid #292929' }}>
        <div ref={problemsRef}>
          <ScrollCardDeck 
            cards={PROBLEMS} 
            renderCard={renderProblemCard} 
            bg="#101010" 
            headerContent={
              <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '6rem 1.5rem 0' }}>
                <div style={{ opacity: problemsVisible ? 1 : 0, transform: problemsVisible ? 'translateY(0)' : 'translateY(30px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
                  <h2 className="section-headline" style={{ marginBottom: '0.5rem' }}>
                    YOUR CONTENT DESERVES
                    <br /><span className="red-highlight">BETTER PROTECTION.</span>
                  </h2>
                  <p style={{ color: '#A0A0A0', marginBottom: '0', fontSize: '0.95rem' }}>Scroll to reveal the four real problems VidProtect AI addresses.</p>
                </div>
              </div>
            }
          />
        </div>
      </div>

      {/* ── FEATURES (scroll-driven 3D card deck) ── */}
      <div id="features" style={{ background: '#171717', borderTop: '1px solid #292929', borderBottom: '1px solid #292929' }}>
        <div ref={featuresRef}>
          <ScrollCardDeck 
            cards={FEATURES} 
            renderCard={renderFeatureCard} 
            bg="#171717" 
            headerContent={
              <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '6rem 1.5rem 0' }}>
                <div style={{ opacity: featuresVisible ? 1 : 0, transform: featuresVisible ? 'translateY(0)' : 'translateY(30px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
                  <SectionLabel>SECURITY ARCHITECTURE</SectionLabel>
                  <h2 className="section-headline" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                    FOUR LAYERS.
                    <br /><span className="red-highlight">ONE PROTECTED EXPERIENCE.</span>
                  </h2>
                  <p style={{ color: '#A0A0A0', marginBottom: '0', fontSize: '0.95rem' }}>Scroll to explore each security layer.</p>
                </div>
              </div>
            }
          />
        </div>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '3rem 1.5rem 6rem' }}>
          <div style={{ padding: '1.5rem', border: '1px solid #FF2028', background: 'rgba(255,32,40,0.04)' }}>
            <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '0.5rem' }}>CORE SECURITY FORMULA</div>
            <div className="mono" style={{ fontSize: '0.75rem', color: '#F8F8F8', lineHeight: 1.8, letterSpacing: '0.05em' }}>
              AES-256 ENCRYPTION + JWT AUTHENTICATION + ENROLLMENT VERIFICATION
              <br />+ TEMPORARY STREAM TOKENS + ACCESS LOGGING + ANOMALY MONITORING
            </div>
          </div>
        </div>
      </div>

      {/* ── WORKFLOW ── */}
      <section id="how-it-works" ref={workflowRef} style={{ background: '#101010', padding: '6rem 1.5rem', borderBottom: '1px solid #292929' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ opacity: workflowVisible ? 1 : 0, transform: workflowVisible ? 'translateY(0)' : 'translateY(30px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
            <SectionLabel>SECURITY WORKFLOW</SectionLabel>
            <h2 className="section-headline" style={{ marginTop: '1rem', marginBottom: '3rem' }}>
              FROM UPLOAD
              <br /><span className="red-highlight">TO SECURE STREAM.</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'flex-start' }} className="workflow-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {WORKFLOW_STEPS.map((step, i) => (
                <WorkflowStep
                  key={step.num}
                  {...step}
                  isActive={activeStep === i}
                  onClick={() => setActiveStep(i === activeStep ? -1 : i)}
                />
              ))}
            </div>

            <div style={{ background: '#171717', border: '1px solid #292929', padding: '2rem', position: 'sticky', top: '80px' }}>
              <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '1rem' }}>WORKFLOW VISUALIZATION</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {WORKFLOW_STEPS.map((s, i) => (
                  <button key={s.num} onClick={() => setActiveStep(i)} style={{
                    background: activeStep === i ? '#FF2028' : '#292929',
                    border: 'none', color: '#F8F8F8', padding: '0.4rem 0.75rem',
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.65rem',
                    cursor: 'pointer', transition: 'background 0.15s', letterSpacing: '0.05em',
                  }}>
                    {String(s.num).padStart(2, '0')} {s.label.toUpperCase()}
                  </button>
                ))}
              </div>
              {activeStep >= 0 && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '1rem' }}>
                    {WORKFLOW_STEPS[activeStep]?.label}
                  </div>
                  <p style={{ color: '#A0A0A0', fontSize: '0.9rem', lineHeight: 1.7 }}>
                    {WORKFLOW_STEPS[activeStep]?.desc}
                  </p>
                </div>
              )}
              {activeStep < 0 && (
                <p style={{ color: '#565656', fontSize: '0.85rem' }}>Select a workflow step to learn more.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <section id="comparison" ref={comparisonRef} style={{ background: '#171717', padding: '6rem 1.5rem', borderBottom: '1px solid #292929' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ opacity: comparisonVisible ? 1 : 0, transform: comparisonVisible ? 'translateY(0)' : 'translateY(30px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
            <SectionLabel>SECURITY COMPARISON</SectionLabel>
            <h2 className="section-headline" style={{ marginTop: '1rem', marginBottom: '3rem' }}>
              TRADITIONAL VS.
              <br /><span className="red-highlight">VIDPROTECT AI.</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#292929' }}>
            {/* Traditional */}
            <div style={{ background: '#1D1D1D', padding: '2rem' }}>
              <div className="mono" style={{ fontSize: '0.7rem', color: '#565656', marginBottom: '1.5rem' }}>TRADITIONAL VIDEO HOSTING</div>
              {[
                'Potentially permanent, shareable video links',
                'Basic or limited access controls',
                'Increased risk of unauthorized sharing',
                'Limited visibility into access activity',
                'No enrollment-based authorization',
                'No automatic token expiry',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid #292929' }}>
                  <X size={14} color="#FF2028" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ color: '#A0A0A0', fontSize: '0.85rem' }}>{item}</span>
                </div>
              ))}
            </div>

            {/* VidProtect */}
            <div style={{ background: '#1D1D1D', padding: '2rem', borderLeft: '3px solid #FF2028' }}>
              <div className="mono" style={{ fontSize: '0.7rem', color: '#FF2028', marginBottom: '1.5rem' }}>VIDPROTECT AI</div>
              {[
                'AES-256-GCM encrypted video storage, key per video',
                'User-specific temporary stream tokens',
                'Course enrollment verification before access',
                'Auditable access activity log',
                'Identity verification via JWT authentication',
                'Suspicious-event monitoring and alerts',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid #292929' }}>
                  <CheckCircle size={14} color="#22c55e" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ color: '#F8F8F8', fontSize: '0.85rem' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', border: '1px solid #292929', background: '#101010' }}>
            <span className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>
              Note: Traditional platforms may include various security features. VidProtect AI does not guarantee complete piracy prevention, and it is currently in beta testing.
            </span>
          </div>
        </div>
      </section>

      {/* ── ROADMAP ── */}
      <section id="security" style={{ background: '#101010', padding: '6rem 1.5rem', borderBottom: '1px solid #292929' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <SectionLabel>FUTURE ROADMAP</SectionLabel>
          <h2 className="section-headline" style={{ marginTop: '1rem', marginBottom: '3rem' }}>
            WHAT'S
            <br /><span className="red-highlight">COMING NEXT.</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {[
              { num: '01', label: 'Payment Integration', desc: 'Secure course purchase flows enabling direct content monetization within the platform.' },
              { num: '02', label: 'Advanced AI Detection', desc: 'Improved anomaly detection models for identifying unusual access patterns beyond rule-based alerts.' },
              { num: '03', label: 'AWS S3 Migration', desc: 'Scalable encrypted media storage using AWS S3 with server-side encryption and access controls.' },
              { num: '04', label: 'Video Watermarking', desc: 'Forensic identifiers embedded in delivered video to associate leaked content with a specific session or learner.' },
            ].map(item => (
              <div key={item.num} style={{ border: '1px solid #292929', padding: '1.5rem', background: '#1D1D1D' }}>
                <div className="mono" style={{ fontSize: '1.5rem', color: '#292929', marginBottom: '0.75rem' }}>{item.num}</div>
                <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{item.label}</div>
                <p style={{ color: '#565656', fontSize: '0.8rem', lineHeight: 1.6 }}>{item.desc}</p>
                <div style={{ marginTop: '1rem' }}>
                  <span className="badge badge-grey" style={{ fontSize: '0.55rem' }}>PLANNED</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section ref={ctaRef} style={{ background: '#171717', padding: '8rem 1.5rem', borderBottom: '1px solid #292929', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ opacity: ctaVisible ? 1 : 0, transform: ctaVisible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.97)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>
            <h2 className="section-headline" style={{ marginBottom: '1rem' }}>
              YOUR CONTENT.<br />
              <span className="red-highlight">YOUR RULES.</span>
            </h2>
            <p style={{ color: '#A0A0A0', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.7 }}>
              Build a safer learning experience with VidProtect AI.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '1rem 2rem' }}>
              ENTER VIDPROTECT <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#101010', padding: '3rem 1.5rem', borderTop: '1px solid #292929' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            <div>
              <Logo size="sm" />
              <p style={{ color: '#565656', fontSize: '0.8rem', marginTop: '1rem', lineHeight: 1.6 }}>
                Secure the Content. Protect the Creator. Empower Learning.
              </p>
            </div>
            <div>
              <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0', marginBottom: '1rem' }}>PRODUCT</div>
              {['Features', 'How It Works', 'Security', 'Roadmap'].map(link => (
                <div key={link} style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#565656', fontSize: '0.85rem', cursor: 'pointer' }}>{link}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0', marginBottom: '1rem' }}>PLATFORM</div>
              {['Login', 'Dashboard', 'Video Library', 'Access Logs'].map(link => (
                <div key={link} style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#565656', fontSize: '0.85rem', cursor: 'pointer' }}>{link}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid #292929', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <span className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>
              © 2024 VIDPROTECT AI. A SecureSphere — Cybersecurity & AI Product.
            </span>
            <span className="mono" style={{ fontSize: '0.6rem', color: '#292929' }}>
              BETA — Now in beta testing.
            </span>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .workflow-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        @keyframes blobPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
