// ============================================
// LEGAL PAGES — Terms of Service, Privacy Policy, Refund Policy (same text the server sends as plain HTML)
// ============================================

import { Link } from 'react-router-dom';
import { Logo } from '../components/SharedComponents';
import { legalLinks } from '../../shared/legal.js';

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || ''; // optional: set VITE_CONTACT_EMAIL when building to show a contact address

export default function LegalPage({ title, updated, sections, contactLine }) {
  return (
    <div style={{ minHeight: '100vh', background: '#101010', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}><Link to="/" style={{ textDecoration: 'none' }}><Logo size="sm" /></Link></div>
        <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '2rem' }}>
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.6rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{title}</h1>
          <p className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginBottom: '1.5rem' }}>VIDPROTECT AI · LAST UPDATED {updated.toUpperCase()}</p>
          {sections.map(([heading, text]) => (
            <section key={heading} style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '0.4rem' }}>{heading}</h2>
              <p style={{ color: '#A0A0A0', fontSize: '0.9rem', lineHeight: 1.6 }}>{text}</p>
            </section>
          ))}
          {CONTACT_EMAIL && (
            <section>
              <h2 style={{ fontSize: '1rem', marginBottom: '0.4rem' }}>Contact</h2>
              <p style={{ color: '#A0A0A0', fontSize: '0.9rem' }}>{contactLine} <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#FF2028' }}>{CONTACT_EMAIL}</a></p>
            </section>
          )}
          <nav style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            {legalLinks.map(([label, to]) => <Link key={to} to={to} style={{ color: '#FF2028' }}>{label}</Link>)}
          </nav>
        </div>
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Link to="/" style={{ color: '#8B8B8B', fontSize: '0.8rem', textDecoration: 'none' }}>← Back to VidProtect AI</Link>
        </div>
      </div>
    </div>
  );
}
