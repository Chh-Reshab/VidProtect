// ============================================
// ERROR BOUNDARY — a crash in any page shows a message instead of a black screen
// ============================================

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('UI crashed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#101010' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.4rem', textTransform: 'uppercase', marginBottom: '0.75rem', color: '#F8F8F8' }}>Something went wrong</h1>
          <p style={{ color: '#A0A0A0', fontSize: '0.9rem', marginBottom: '1.5rem' }}>This page hit an error. Reloading usually fixes it.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
