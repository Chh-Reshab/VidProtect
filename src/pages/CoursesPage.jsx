// ============================================
// COURSES & ENROLLMENTS — VidProtect AI
// ============================================

import { useState, useEffect } from 'react';
import { BookOpen, Users, Video, Plus, Trash2, Search, ChevronRight, UserPlus, X } from 'lucide-react';
import {
  getCourses, getStudentsForCourse, getAllStudents,
  enrollStudent, removeEnrollment, getVideos,
} from '../services/mockServices';
import { useApp } from '../context/AppContext';
import { SectionLabel, StatusBadge, EmptyState, ConfirmDialog, Modal, SearchInput, DemoBanner } from '../components/SharedComponents';

export default function CoursesPage() {
  const { showNotification, refreshStats } = useApp();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [courseVideos, setCourseVideos] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [enrollSearch, setEnrollSearch] = useState('');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  useEffect(() => {
    setCourses(getCourses());
    setAllStudents(getAllStudents());
  }, []);

  const openCourse = (course) => {
    setSelectedCourse(course);
    setStudents(getStudentsForCourse(course.id));
    setCourseVideos(getVideos().filter(v => v.courseId === course.id));
    setStudentSearch('');
  };

  const handleEnroll = (studentId) => {
    const result = enrollStudent(studentId, selectedCourse.id);
    if (result.success) {
      setStudents(getStudentsForCourse(selectedCourse.id));
      setCourses(getCourses());
      refreshStats();
      showNotification('Student enrolled successfully.');
    } else {
      showNotification(result.error, 'error');
    }
    setShowEnrollModal(false);
  };

  const handleRemove = (enrollmentId) => {
    removeEnrollment(enrollmentId, selectedCourse.id);
    setStudents(getStudentsForCourse(selectedCourse.id));
    setCourses(getCourses());
    refreshStats();
    showNotification('Enrollment removed.');
    setRemoveTarget(null);
  };

  const filteredStudents = students.filter(s =>
    !studentSearch || s.name?.toLowerCase().includes(studentSearch.toLowerCase()) || s.email?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const unenrolledStudents = allStudents.filter(s => !students.find(e => e.id === s.id));
  const filteredEnroll = unenrolledStudents.filter(s =>
    !enrollSearch || s.name.toLowerCase().includes(enrollSearch.toLowerCase()) || s.email.toLowerCase().includes(enrollSearch.toLowerCase())
  );

  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <SectionLabel>COURSE MANAGEMENT</SectionLabel>
        <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginTop: '0.75rem', lineHeight: 1 }}>
          COURSES & ENROLLMENTS
        </h1>
        <p style={{ color: '#A0A0A0', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Manage your courses and control student enrollment.
        </p>
      </div>

      <DemoBanner />

      <div style={{ display: 'grid', gridTemplateColumns: selectedCourse ? '320px 1fr' : '1fr', gap: '1.5rem' }} className="courses-grid">
        {/* Course List */}
        <div>
          {courses.map(course => (
            <div
              key={course.id}
              onClick={() => openCourse(course)}
              style={{
                background: selectedCourse?.id === course.id ? 'rgba(255,32,40,0.08)' : '#1D1D1D',
                border: `1px solid ${selectedCourse?.id === course.id ? '#FF2028' : '#292929'}`,
                borderLeft: `3px solid ${selectedCourse?.id === course.id ? '#FF2028' : 'transparent'}`,
                padding: '1.25rem',
                cursor: 'pointer',
                marginBottom: '1px',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '-0.01em', flex: 1, lineHeight: 1.2 }}>
                  {course.title}
                </h3>
                <ChevronRight size={14} color={selectedCourse?.id === course.id ? '#FF2028' : '#565656'} style={{ flexShrink: 0 }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                <span className="mono" style={{ fontSize: '0.6rem', color: '#565656', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Video size={10} /> {course.videoCount} videos
                </span>
                <span className="mono" style={{ fontSize: '0.6rem', color: '#565656', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Users size={10} /> {course.enrolledCount} learners
                </span>
                <span className={`badge ${course.status === 'active' ? 'badge-green' : 'badge-grey'}`} style={{ fontSize: '0.55rem' }}>
                  {course.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Course Detail */}
        {selectedCourse && (
          <div style={{ animation: 'slideIn 0.25s ease' }}>
            <div style={{ background: '#1D1D1D', border: '1px solid #292929', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1.25rem', borderBottom: '1px solid #292929', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="mono" style={{ fontSize: '0.6rem', color: '#FF2028', marginBottom: '0.25rem' }}>COURSE DETAIL</div>
                  <h2 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                    {selectedCourse.title}
                  </h2>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: '0.6rem', padding: '0.3rem 0.6rem' }} onClick={() => setSelectedCourse(null)}>
                  <X size={12} />
                </button>
              </div>
              <div style={{ padding: '1rem 1.25rem' }}>
                <p style={{ color: '#A0A0A0', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                  {selectedCourse.description}
                </p>
                <div className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>
                  Created {formatDate(selectedCourse.createdAt)}
                </div>
              </div>
            </div>

            {/* Videos in course */}
            <div style={{ background: '#1D1D1D', border: '1px solid #292929', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929' }}>
                <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0' }}>VIDEOS IN THIS COURSE ({courseVideos.length})</div>
              </div>
              {courseVideos.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#565656', fontSize: '0.8rem' }}>No videos yet.</div>
              ) : (
                courseVideos.map(v => (
                  <div key={v.id} style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{v.title}</div>
                      <div className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>{v.duration} · {v.fileSize}</div>
                    </div>
                    <span className={`badge ${v.protectionStatus === 'protected' ? 'badge-green' : 'badge-grey'}`} style={{ fontSize: '0.55rem' }}>
                      {v.protectionStatus === 'protected' ? '⚿ PROTECTED' : 'UNPROTECTED'}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Enrolled Students */}
            <div style={{ background: '#1D1D1D', border: '1px solid #292929' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0' }}>ENROLLED STUDENTS ({students.length})</div>
                <button className="btn btn-primary" style={{ fontSize: '0.6rem', padding: '0.35rem 0.75rem' }} onClick={() => setShowEnrollModal(true)}>
                  <UserPlus size={12} /> ENROLL STUDENT
                </button>
              </div>

              <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #292929' }}>
                <SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Search students..." />
              </div>

              {filteredStudents.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#565656', fontSize: '0.85rem' }}>
                  {students.length === 0 ? 'No enrolled students. Click "Enroll Student" to add.' : 'No students match your search.'}
                </div>
              ) : (
                filteredStudents.map(student => (
                  <div key={student.id} style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 32, height: 32, background: '#292929', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono', fontSize: '0.65rem', color: '#A0A0A0', flexShrink: 0 }}>
                      {student.name?.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{student.name}</div>
                      <div className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>{student.email}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`badge ${student.status === 'active' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.55rem' }}>
                        {student.status?.toUpperCase()}
                      </span>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: '0.55rem', padding: '0.25rem 0.4rem', color: '#FF2028', borderColor: '#FF2028' }}
                        onClick={() => setRemoveTarget(student)}
                        aria-label={`Remove ${student.name}`}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!selectedCourse && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #292929', padding: '4rem', color: '#565656' }}>
            <div style={{ textAlign: 'center' }}>
              <BookOpen size={32} color="#292929" style={{ marginBottom: '0.75rem' }} />
              <div className="mono" style={{ fontSize: '0.65rem' }}>Select a course to view details and manage enrollments</div>
            </div>
          </div>
        )}
      </div>

      {/* Enroll Student Modal */}
      <Modal isOpen={showEnrollModal} onClose={() => { setShowEnrollModal(false); setEnrollSearch(''); }} title="ENROLL STUDENT">
        <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '1rem' }}>
          COURSE: {selectedCourse?.title}
        </div>
        <p style={{ fontSize: '0.8rem', color: '#A0A0A0', marginBottom: '1rem' }}>
          A student must be enrolled to be authorized to access this course's protected videos.
        </p>
        <SearchInput value={enrollSearch} onChange={setEnrollSearch} placeholder="Search students..." />
        <div style={{ marginTop: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
          {filteredEnroll.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#565656', fontSize: '0.85rem' }}>
              {unenrolledStudents.length === 0 ? 'All available students are already enrolled.' : 'No students match your search.'}
            </div>
          ) : (
            filteredEnroll.map(student => (
              <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid #292929' }}>
                <div style={{ width: 28, height: 28, background: '#292929', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono', fontSize: '0.6rem', color: '#A0A0A0', flexShrink: 0 }}>
                  {student.name.substring(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{student.name}</div>
                  <div className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>{student.email}</div>
                </div>
                <button className="btn btn-primary" style={{ fontSize: '0.6rem', padding: '0.35rem 0.7rem' }} onClick={() => handleEnroll(student.id)}>
                  ENROLL
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Remove Confirmation */}
      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => handleRemove(removeTarget?.enrollmentId)}
        title="REMOVE ENROLLMENT"
        message={`Remove ${removeTarget?.name} from ${selectedCourse?.title}? They will lose access to all protected videos in this course.`}
        confirmLabel="REMOVE"
        danger
      />

      <style>{`
        @media (max-width: 900px) {
          .courses-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
