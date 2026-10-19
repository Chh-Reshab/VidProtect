import { useEffect, useState } from 'react';
import { Logo } from './SharedComponents';
import { useApp } from '../context/AppContext';

// Branded splash shown only until the app knows whether a session exists (a real signal, not a timer)
export const InitialLoader = ({ children }) => {
  const { ready } = useApp();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => setGone(true), 650); // after the slide-away animation
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <>
      {!gone && (
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
          transform: ready ? 'translateY(-100%)' : 'translateY(0)',
          opacity: ready ? 0 : 1,
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
                width: ready ? '100%' : '75%',
                background: '#FF2028',
                transition: 'width 1.2s ease-out',
                boxShadow: '0 0 10px #FF2028',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '0.75rem', fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem' }}>
              <span style={{ color: '#8B8B8B', letterSpacing: '0.1em' }}>INITIALIZING SYSTEM</span>
              <span style={{ color: '#FF2028', fontWeight: 600 }}>{ready ? '100%' : '...'}</span>
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
        // 'none' (not an identity transform) once settled: any transform on this wrapper would
        // make every position:fixed element inside the app scroll with the page
        transform: ready ? 'none' : 'scale(0.96) translateY(20px)',
        opacity: ready ? 1 : 0,
      }}>
        {children}
      </div>
    </>
  );
};
