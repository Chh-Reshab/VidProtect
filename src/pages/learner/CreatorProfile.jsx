// ============================================
// CREATOR PROFILE — what a learner sees before enrolling: who the creator is, their experience,
// achievements and published courses. Reached from a course, the catalog or checkout.
// ============================================

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, BadgeCheck, Award, ExternalLink, Pencil, Users, Video } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getCreatorProfile } from '../../services/dataService';
import Avatar from '../../components/Avatar';
import { StatTile } from '../../components/LearningWidgets';
import { CourseCover, Panel, PriceBadge } from '../../components/DashboardKit';

const safeHref = (url) => (/^https?:\/\//i.test(url || '') ? url : null);
const year = (iso) => (iso ? String(iso).slice(0, 4) : '');

export default function CreatorProfile() {
  const { creatorId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useApp();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let alive = true;
    getCreatorProfile(creatorId).then(r => { if (alive) setState(r.success ? { data: r } : { error: r.error }); });
    return () => { alive = false; };
  }, [creatorId]);

  const back = (
    <button className="btn btn-ghost" style={{ fontSize: '0.7rem', marginBottom: '1.25rem' }} onClick={() => navigate(-1)}>
      <ChevronLeft size={14} /> BACK
    </button>
  );

  if (state.loading) return <div style={{ padding: '2rem' }}>{back}<div className="spinner" /></div>;
  if (state.error) return <div style={{ padding: '2rem' }}>{back}<p style={{ color: '#A0A0A0' }}>{state.error}</p></div>;

  const { creator, courses } = state.data;
  const isMe = currentUser?.id === creator.id;
  const links = creator.links.filter(l => safeHref(l.url));

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease', maxWidth: 1000 }}>
      {back}

      {isMe && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '0.75rem 1rem', marginBottom: '1rem', background: '#101010', border: '1px solid #292929', borderLeft: '3px solid #eab308' }}>
          <span style={{ fontSize: '0.8rem', color: '#A0A0A0' }}>This is how learners see your profile.</span>
          <Link to="/studio/profile" className="btn btn-secondary" style={{ fontSize: '0.7rem' }}><Pencil size={12} /> EDIT PROFILE</Link>
        </div>
      )}

      {/* Header */}
      <Panel style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Avatar name={creator.name} url={creator.avatarUrl} size={104} style={{ border: '1px solid #292929' }} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="mono" style={{ fontSize: '0.7rem', color: '#FF2028', marginBottom: '0.3rem' }}>CREATOR</div>
            <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.7rem', textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{creator.name}</h1>
            {creator.headline && <p style={{ color: '#F8F8F8', fontSize: '0.95rem', marginTop: '0.4rem' }}>{creator.headline}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.75rem' }}>
              <span className="badge badge-green" style={{ fontSize: '0.7rem' }}><BadgeCheck size={11} style={{ marginRight: 4 }} /> VERIFIED CREATOR</span>
              {creator.joinedAt && <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>MEMBER SINCE {year(creator.joinedAt)}</span>}
            </div>
            {links.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
                {links.map(l => (
                  <a key={l.url} href={safeHref(l.url)} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-ghost" style={{ fontSize: '0.7rem' }}>
                    {l.label.toUpperCase()} <ExternalLink size={11} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* Numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatTile label="COURSES" value={creator.stats.courses} sub="published" />
        <StatTile label="LEARNERS" value={creator.stats.learners} sub="enrolled" />
        <StatTile label="VIDEOS" value={creator.stats.videos} sub="in total" />
        <StatTile label="HOURS" value={creator.stats.hours} sub="of content" />
      </div>

      {creator.bio && (
        <Panel title="ABOUT" style={{ marginBottom: '1.5rem' }}>
          <p style={{ padding: '1.25rem', color: '#A0A0A0', fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{creator.bio}</p>
        </Panel>
      )}

      {creator.experience && (
        <Panel title="EXPERIENCE" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.25rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {creator.experience.years != null && (
              <div>
                <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginBottom: '0.2rem' }}>YEARS TEACHING</div>
                <div style={{ fontSize: '1.2rem', color: '#F8F8F8' }}>{creator.experience.years}</div>
              </div>
            )}
            {creator.experience.topics && (
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginBottom: '0.3rem' }}>TEACHES</div>
                <div style={{ fontSize: '0.9rem', color: '#F8F8F8' }}>{creator.experience.topics}</div>
              </div>
            )}
          </div>
        </Panel>
      )}

      <Panel title="ACHIEVEMENTS" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {creator.badges.map(b => (
            <div key={b.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#101010', border: '1px solid #292929', padding: '0.85rem' }}>
              <Award size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{b.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#8B8B8B' }}>{b.detail}</div>
              </div>
            </div>
          ))}
          {creator.achievements.map(a => (
            <div key={a} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: '#101010', border: '1px solid #292929', padding: '0.85rem' }}>
              <Award size={18} color="#eab308" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{a}</div>
                <div style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>Shared by the creator</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <h2 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.1rem', textTransform: 'uppercase', margin: '0.5rem 0 0.9rem' }}>Courses by {creator.name}</h2>
      {courses.length === 0 ? (
        <div style={{ color: '#A0A0A0', fontSize: '0.9rem' }}>No published courses yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {courses.map(c => (
            <Link key={c.id} to={`/learn/course/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', background: '#1D1D1D', border: '1px solid #292929', display: 'flex', flexDirection: 'column' }}>
              <CourseCover course={c} height={130} />
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <div style={{ fontSize: '0.95rem', color: '#F8F8F8' }}>{c.title}</div>
                {c.description && <div style={{ fontSize: '0.8rem', color: '#A0A0A0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.description}</div>}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginTop: 'auto' }}>
                  <PriceBadge price={c.price} />
                  <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Video size={11} /> {c.videoCount}</span>
                  <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={11} /> {c.enrolledCount}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
