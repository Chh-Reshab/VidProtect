// ============================================
// PRIVACY POLICY — public page at /privacy
// ============================================

import { Link } from 'react-router-dom';
import { Logo } from '../components/SharedComponents';

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || ''; // optional: set VITE_CONTACT_EMAIL when building to show a contact address

const sections = [
  ['What we collect', 'When you create an account we store your name, email address and a hashed version of your password (we never store the password itself). While you use the service we store your course enrolments, watch progress and activity, payment records made in test mode, and security logs such as sign-in and playback events.'],
  ['How we use it', 'We use this information to run your account, show your learning progress, let creators see who watched their videos, protect videos from misuse, and detect suspicious activity. Your email address is used only to send you an account verification link and essential service messages.'],
  ['Videos', 'Uploaded videos are encrypted before they are stored and are decrypted only while an authorised, signed-in learner is watching.'],
  ['Email', 'Verification emails are sent from our Gmail account using the Gmail API with permission to send mail only. We do not read, list or delete anyone\'s mail.'],
  ['Sharing', 'We do not sell your personal information. We share it only with the services needed to run VidProtect AI (hosting, database and file storage providers) and when the law requires it.'],
  ['Keeping and deleting your data', 'We keep your account data while your account is active. You can ask us to delete your account and the data linked to it at any time.'],
  ['Changes', 'We may update this policy and will change the date below when we do.'],
];

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#101010', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}><Link to="/" style={{ textDecoration: 'none' }}><Logo size="sm" /></Link></div>
        <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '2rem' }}>
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.6rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Privacy Policy</h1>
          <p className="mono" style={{ fontSize: '0.65rem', color: '#565656', marginBottom: '1.5rem' }}>VIDPROTECT AI · LAST UPDATED OCTOBER 2026</p>
          {sections.map(([title, body]) => (
            <section key={title} style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '0.4rem' }}>{title}</h2>
              <p style={{ color: '#A0A0A0', fontSize: '0.9rem', lineHeight: 1.6 }}>{body}</p>
            </section>
          ))}
          {CONTACT_EMAIL && (
            <section>
              <h2 style={{ fontSize: '1rem', marginBottom: '0.4rem' }}>Contact</h2>
              <p style={{ color: '#A0A0A0', fontSize: '0.9rem' }}>Questions or deletion requests: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#FF2028' }}>{CONTACT_EMAIL}</a></p>
            </section>
          )}
        </div>
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Link to="/" style={{ color: '#565656', fontSize: '0.8rem', textDecoration: 'none' }}>← Back to VidProtect AI</Link>
        </div>
      </div>
    </div>
  );
}
