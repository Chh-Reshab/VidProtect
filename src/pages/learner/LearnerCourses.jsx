// ============================================
// LEARNER COURSES — "My Courses" and "Browse Courses"
// ============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Lock, Video } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getEnrolledCourses, getCatalog, selfEnroll, getUserById } from '../../services/dataService';
import { SearchInput, SelectFilter, DemoBanner } from '../../components/SharedComponents';
import { PageHeader, ProgressBar, CourseCard } from '../../components/DashboardKit';

const PROGRESS_FILTERS = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

export default function LearnerCourses({ mode }) {
  const { currentUser, showNotification } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [mine, setMine] = useState(() => getEnrolledCourses(currentUser.id));
  const enrolledIds = new Set(mine.map(c => c.id));

  const matches = (c) => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase());

  let list;
  if (mode === 'mine') {
    list = mine.filter(matches).filter(c => {
      if (filter === 'completed') return c.totalVideos > 0 && c.percent === 100;
      if (filter === 'in_progress') return !(c.totalVideos > 0 && c.percent === 100);
      return true;
    });
  } else {
    // creators don't see their own courses in the catalog
    list = getCatalog().filter(c => c.creatorId !== currentUser.id).filter(matches);
  }

  const handleEnroll = async (e, course) => {
    e.stopPropagation();
    const result = await selfEnroll(currentUser.id, course.id);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    setMine(getEnrolledCourses(currentUser.id));
    showNotification(`Enrolled in ${course.title}.`);
  };

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <PageHeader
        label={mode === 'mine' ? 'MY COURSES' : 'COURSE CATALOG'}
        title={mode === 'mine' ? 'MY COURSES' : 'BROWSE COURSES'}
        subtitle={mode === 'mine' ? 'Courses you are enrolled in.' : 'Published courses from creators on VidProtect AI.'}
      />
      <DemoBanner />

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search courses..." />
        {mode === 'mine' && <SelectFilter value={filter} onChange={setFilter} options={PROGRESS_FILTERS} placeholder="All courses" />}
      </div>

      {list.length === 0 ? (
        <div style={{ border: '1px dashed #292929', padding: '3rem', textAlign: 'center', color: '#565656' }}>
          <BookOpen size={28} color="#292929" style={{ marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '0.85rem' }}>
            {mode === 'mine' ? 'No courses to show. Browse the catalog to enrol.' : 'No courses match your search.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {list.map(c => {
            const enrolled = enrolledIds.has(c.id);
            const creator = getUserById(c.creatorId);
            return (
              <CourseCard
                key={c.id}
                course={c}
                onClick={() => navigate(`/learn/course/${c.id}`)}
                footer={
                  <div>
                    <div className="mono" style={{ fontSize: '0.58rem', color: '#565656', marginBottom: '0.6rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Video size={10} /> {c.videoCount ?? c.totalVideos} videos</span>
                      {creator && <span>BY {creator.name.toUpperCase()}</span>}
                    </div>
                    {mode === 'mine' ? (
                      c.enrollmentStatus !== 'active' ? (
                        <span className="badge badge-red" style={{ fontSize: '0.55rem' }}>ENROLLMENT {c.enrollmentStatus.toUpperCase()}</span>
                      ) : (
                        <>
                          <ProgressBar percent={c.percent} />
                          <div className="mono" style={{ fontSize: '0.58rem', color: '#565656', marginTop: '0.4rem' }}>
                            {c.completedVideos}/{c.totalVideos} videos · {c.percent}%
                          </div>
                        </>
                      )
                    ) : enrolled ? (
                      <span className="badge badge-green" style={{ fontSize: '0.55rem' }}>ENROLLED</span>
                    ) : c.visibility === 'invite_only' ? (
                      <span className="badge badge-grey" style={{ fontSize: '0.55rem' }}><Lock size={9} style={{ marginRight: 4 }} />INVITE ONLY</span>
                    ) : (
                      <button className="btn btn-primary" style={{ fontSize: '0.65rem', padding: '0.4rem 0.8rem' }} onClick={(e) => handleEnroll(e, c)}>
                        ENROLL
                      </button>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
