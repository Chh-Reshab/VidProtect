// A profile picture, or the person's initials when there is none (or it cannot be loaded)
import { useState } from 'react';

const initialsOf = (name) => (name ? name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?');

export default function Avatar({ name, url, size = 28, accent = false, style }) {
  const [failed, setFailed] = useState(null); // the address that failed, so a new picture gets a fresh try
  const box = { width: size, height: size, flexShrink: 0, overflow: 'hidden', ...style };
  if (url && failed !== url) {
    return <img src={url} alt={name ? `${name}'s profile picture` : 'Profile picture'} width={size} height={size} onError={() => setFailed(url)} style={{ ...box, objectFit: 'cover', display: 'block' }} />;
  }
  return (
    <div aria-hidden="true" style={{
      ...box, background: accent ? '#FF2028' : '#292929', color: accent ? '#fff' : '#A0A0A0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, fontSize: Math.max(10, Math.round(size * 0.36)),
    }}>
      {initialsOf(name)}
    </div>
  );
}
