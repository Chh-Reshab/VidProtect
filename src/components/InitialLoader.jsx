import { useState, useEffect } from 'react';
import { Logo } from './SharedComponents';

export const InitialLoader = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [fade, setFade] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + Math.random() * 15;
      });
    }, 150);

    // After 2.2 seconds, start fade out
    const timeout1 = setTimeout(() => {
      setFade(true);
    }, 2200);

    // After 2.8 seconds, unmount loader
    const timeout2 = setTimeout(() => {
      setLoading(false);
    }, 2800);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, []);

  return (
    <>
      {loading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#101010',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.6s cubic-bezier(0.7, 0, 0.3, 1), opacity 0.6s ease',
          transform: fade ? 'translateY(-100%)' : 'translateY(0)',
          opacity: fade ? 0 : 1,
        }}>
          {/* Cyberpunk grid background */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'linear-gradient(rgba(255, 32, 40, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 32, 40, 0.05) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            backgroundPosition: 'center center',
            opacity: 0.5,
            pointerEvents: 'none',
          }} />

          <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '320px' }}>
            <Logo size="lg" />
            
            <div style={{ width: '100%', height: '2px', background: '#292929', marginTop: '3rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute',
                top: 0, left: 0, bottom: 0,
                width: `${Math.min(progress, 100)}%`,
                background: '#FF2028',
                transition: 'width 0.2s ease-out',
                boxShadow: '0 0 10px #FF2028',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '0.75rem', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.65rem' }}>
              <span style={{ color: '#565656', letterSpacing: '0.1em' }}>INITIALIZING SYSTEM</span>
              <span style={{ color: '#FF2028', fontWeight: 600 }}>{Math.min(Math.round(progress), 100)}%</span>
            </div>
          </div>
        </div>
      )}
      
      {/* 
        We wrap children in a div that scales and fades in 
        as the loader moves up, creating a beautiful reveal effect 
      */}
      <div style={{
        minHeight: '100vh',
        transition: 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.8s ease',
        transform: loading && !fade ? 'scale(0.96) translateY(20px)' : 'scale(1) translateY(0)',
        opacity: loading && !fade ? 0 : 1,
      }}>
        {children}
      </div>
    </>
  );
};
