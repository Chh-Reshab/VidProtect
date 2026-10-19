// ============================================
// COURSES & ENROLLMENTS — VidProtect AI
// ============================================

import { useState } from 'react';
import { BookOpen, Users, Video, Plus, Trash2, ChevronRight, UserPlus, X, Globe, EyeOff } from 'lucide-react';
import {
  getCourses, getStudentsForCourse, getAllStudents,
  enrollStudent, removeEnrollment, getVideos,
  createCourse, updateCourse, setThumbnail, removeThumbnail, getPayments,
} from '../services/dataService';
import { ThumbnailField, PriceBadge, formatPrice } from '../components/DashboardKit';
import { useApp } from '../context/AppContext';
import { ConfirmDialog, Modal, SearchInput } from '../components/SharedComponents';

export default function CoursesPage() {
  const { currentUser, showNotification, refreshStats } = useApp();
  const [courses, setCourses] = useState(() => getCourses(currentUser.id));
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [students, setStudents] = useState([]);
  const [allStudents] = useState(() => getAllStudents().filter(u => u.id !== currentUser.id));
  const [courseVideos, setCourseVideos] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [enrollSearch, setEnrollSearch] = useState('');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', description: '', visibility: 'public', price: '' });
  const [newThumb, setNewThumb] = useState(null);
  const [priceDraft, setPriceDraft] = useState('0');
  const [publishNow, setPublishNow] = useState(true);

  const myCourses = () => getCourses(currentUser.id);

  const openCourse = (course) => {
    setSelectedCourse(course);
    setPriceDraft(String(course.price || 0));
    setStudents(getStudentsForCourse(course.id));
    setCourseVideos(getVideos(currentUser.id).filter(v => v.courseId === course.id));
    setStudentSearch('');
  };

  const handleEnroll = async (studentId) => {
    const result = await enrollStudent(currentUser.id, studentId, selectedCourse.id);
    if (result.success) {
      setStudents(getStudentsForCourse(selectedCourse.id));
      setCourses(myCourses());
      refreshStats();
      showNotification('Student enrolled successfully.');
    } else {
      showNotification(result.error, 'error');
    }
    setShowEnrollModal(false);
  };

  const handleRemove = async (enrollmentId) => {
    const result = await removeEnrollment(currentUser.id, enrollmentId);
    if (!result.success) { showNotification(result.error, 'error'); setRemoveTarget(null); return; }
    setStudents(getStudentsForCourse(selectedCourse.id));
    setCourses(myCourses());
    refreshStats();
    showNotification('Enrollment removed.');
    setRemoveTarget(null);
  };

  const handleCreateCourse = async () => {
    const price = newCourse.price === '' ? 0 : Number(newCourse.price);
    const result = await createCourse(currentUser.id, { ...newCourse, price });
    if (!result.success) { showNotification(result.error, 'error'); return; }
    let thumbFailed = false;
    if (newThumb) thumbFailed = !(await setThumbnail('course', result.course.id, newThumb)).success;
    let published = false;
    if (publishNow) published = (await updateCourse(currentUser.id, result.course.id, { status: 'active' })).success;
    setCourses(myCourses());
    setShowNewCourse(false);
    setNewCourse({ title: '', description: '', visibility: 'public', price: '' });
    setNewThumb(null);
    if (thumbFailed) showNotification('Course created, but the thumbnail could not be uploaded. Add it from the course page.', 'error');
    else if (published) showNotification('Course created and published. Learners can find it now.');
    else showNotification('Course created as a draft. Publish it so learners can see it.');
  };

  const handlePatchCourse = async (patch, message) => {
    const result = await updateCourse(currentUser.id, selectedCourse.id, patch);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    setSelectedCourse(result.course);
    setCourses(myCourses());
    showNotification(message);
  };

  const refreshSelected = () => {
    const fresh = myCourses();
    setCourses(fresh);
    setSelectedCourse(fresh.find(c => c.id === selectedCourse.id) || null);
  };

  const changeThumb = async (file) => {
    const result = await setThumbnail('course', selectedCourse.id, file);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    refreshSelected();
    showNotification('Thumbnail updated.');
  };

  const clearThumb = async () => {
    const result = await removeThumbnail('course', selectedCourse.id);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    refreshSelected();
    showNotification('Thumbnail removed.');
  };

  const savePrice = async () => {
    const price = priceDraft === '' ? 0 : Number(priceDraft);
    const result = await updateCourse(currentUser.id, selectedCourse.id, { price });
    if (!result.success) { showNotification(result.error, 'error'); return; }
    setSelectedCourse(result.course);
    setPriceDraft(String(result.course.price || 0));
    setCourses(myCourses());
    showNotification(price > 0 ? `Price set to ${formatPrice(price)}. New learners pay this; current learners keep access.` : 'Course is now free.');
  };

  const courseSales = (courseId) => getPayments().filter(p => p.courseId === courseId && p.status === 'succeeded' && p.amount > 0);

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
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.6rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
          Courses
        </h1>
        <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowNewCourse(true)}>
          <Plus size={15} /> New course
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedCourse ? 'minmax(0, 340px) minmax(0, 1fr)' : '1fr', gap: '1.5rem' }} className="courses-grid">
        {/* Course List */}
        <div>
          {courses.length === 0 && (
            <div style={{ border: '1px dashed #292929', padding: '2rem', textAlign: 'center', color: '#8B8B8B', fontSize: '0.85rem' }}>
              <div style={{ marginBottom: '1rem' }}>You have no courses yet.</div>
              <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowNewCourse(true)}><Plus size={14} /> Create your first course</button>
            </div>
          )}
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
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 1rem', marginTop: '0.75rem' }}>
                <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Video size={10} /> {course.videoCount} videos
                </span>
                <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Users size={10} /> {course.enrolledCount} learners
                </span>
                <PriceBadge price={course.price} />
                <span className={`badge ${course.status === 'active' ? 'badge-green' : course.status === 'taken_down' ? 'badge-red' : 'badge-grey'}`} style={{ fontSize: '0.7rem' }}>
                  {course.status === 'active' ? 'PUBLISHED' : course.status.replace('_', ' ').toUpperCase()}
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
                  <div className="mono" style={{ fontSize: '0.7rem', color: '#FF2028', marginBottom: '0.25rem' }}>COURSE DETAIL</div>
                  <h2 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                    {selectedCourse.title}
                  </h2>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }} onClick={() => setSelectedCourse(null)}>
                  <X size={12} />
                </button>
              </div>
              <div style={{ padding: '1rem 1.25rem' }}>
                <p style={{ color: '#A0A0A0', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                  {selectedCourse.description}
                </p>
                <ThumbnailField
                  label="Course thumbnail"
                  url={selectedCourse.thumbUrl}
                  onSelect={changeThumb}
                  onRemove={clearThumb}
                  onError={(msg) => showNotification(msg, 'error')}
                />
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label" htmlFor="course-price">Price (₹) <span style={{ color: '#8B8B8B' }}>(0 = free)</span></label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      id="course-price"
                      type="number"
                      min="0"
                      step="1"
                      className="form-input"
                      style={{ width: 160 }}
                      value={priceDraft}
                      onChange={e => setPriceDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') savePrice(); }}
                    />
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.7rem' }}
                      onClick={savePrice}
                      disabled={String(selectedCourse.price || 0) === String(priceDraft === '' ? 0 : Number(priceDraft))}
                    >
                      Save price
                    </button>
                  </div>
                  {(() => {
                    const sales = courseSales(selectedCourse.id);
                    const total = sales.reduce((sum, p) => sum + p.amount, 0);
                    return sales.length > 0 && (
                      <div className="mono" style={{ fontSize: '0.7rem', color: '#22c55e', marginTop: '0.5rem' }}>
                        {sales.length} paid enrolment{sales.length !== 1 ? 's' : ''} · {formatPrice(total)} earned{sales.some(p => p.testMode) ? ' (test payments)' : ''}
                      </div>
                    );
                  })()}
                </div>
                <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', margin: '1rem 0' }}>
                  Created {formatDate(selectedCourse.createdAt)} · {selectedCourse.visibility === 'invite_only' ? 'INVITE ONLY' : 'OPEN ENROLLMENT'}
                </div>
                {selectedCourse.status === 'taken_down' ? (
                  <div className="mono" style={{ fontSize: '0.7rem', color: '#FF2028' }}>⊗ TAKEN DOWN BY A MODERATOR</div>
                ) : selectedCourse.status === 'active' ? (
                  <button className="btn btn-secondary" style={{ fontSize: '0.7rem' }} onClick={() => handlePatchCourse({ status: 'draft' }, 'Course unpublished.')}>
                    <EyeOff size={12} /> UNPUBLISH
                  </button>
                ) : (
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#eab308', marginBottom: '0.6rem' }}>Draft: learners cannot see this course until you publish it.</div>
                    <button className="btn btn-primary" style={{ fontSize: '0.7rem' }} onClick={() => handlePatchCourse({ status: 'active' }, 'Course published. Learners can now find it.')}>
                      <Globe size={12} /> PUBLISH COURSE
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Videos in course */}
            <div style={{ background: '#1D1D1D', border: '1px solid #292929', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929' }}>
                <div className="mono" style={{ fontSize: '0.7rem', color: '#A0A0A0' }}>VIDEOS IN THIS COURSE ({courseVideos.length})</div>
              </div>
              {courseVideos.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#8B8B8B', fontSize: '0.8rem' }}>No videos yet.</div>
              ) : (
                courseVideos.map(v => (
                  <div key={v.id} style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{v.title}</div>
                      <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>{v.duration} · {v.fileSize}</div>
                    </div>
                    <span className={`badge ${v.protectionStatus === 'protected' ? 'badge-green' : 'badge-grey'}`} style={{ fontSize: '0.7rem' }}>
                      {v.protectionStatus === 'protected' ? '⚿ PROTECTED' : 'UNPROTECTED'}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Enrolled Students */}
            <div style={{ background: '#1D1D1D', border: '1px solid #292929' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="mono" style={{ fontSize: '0.7rem', color: '#A0A0A0' }}>ENROLLED STUDENTS ({students.length})</div>
                <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '0.35rem 0.75rem' }} onClick={() => setShowEnrollModal(true)}>
                  <UserPlus size={12} /> ENROLL STUDENT
                </button>
              </div>

              <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #292929' }}>
                <SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Search students..." />
              </div>

              {filteredStudents.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#8B8B8B', fontSize: '0.85rem' }}>
                  {students.length === 0 ? 'No enrolled students. Click "Enroll Student" to add.' : 'No students match your search.'}
                </div>
              ) : (
                filteredStudents.map(student => (
                  <div key={student.id} style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 32, height: 32, background: '#292929', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', color: '#A0A0A0', flexShrink: 0 }}>
                      {student.name?.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{student.name}</div>
                      <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>{student.email}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`badge ${student.status === 'active' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.7rem' }}>
                        {student.status?.toUpperCase()}
                      </span>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem', color: '#FF2028', borderColor: '#FF2028' }}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #292929', padding: '4rem', color: '#8B8B8B' }}>
            <div style={{ textAlign: 'center' }}>
              <BookOpen size={32} color="#292929" style={{ marginBottom: '0.75rem' }} />
              <div className="mono" style={{ fontSize: '0.7rem' }}>Select a course to view details and manage enrollments</div>
            </div>
          </div>
        )}
      </div>

      {/* Enroll Student Modal */}
      <Modal isOpen={showEnrollModal} onClose={() => { setShowEnrollModal(false); setEnrollSearch(''); }} title="ENROLL STUDENT">
        <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginBottom: '1rem' }}>
          COURSE: {selectedCourse?.title}
        </div>
        <p style={{ fontSize: '0.8rem', color: '#A0A0A0', marginBottom: '1rem' }}>
          A student must be enrolled to be authorized to access this course's protected videos.
        </p>
        <SearchInput value={enrollSearch} onChange={setEnrollSearch} placeholder="Search students..." />
        <div style={{ marginTop: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
          {filteredEnroll.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#8B8B8B', fontSize: '0.85rem' }}>
              {unenrolledStudents.length === 0 ? 'All available students are already enrolled.' : 'No students match your search.'}
            </div>
          ) : (
            filteredEnroll.map(student => (
              <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid #292929' }}>
                <div style={{ width: 28, height: 28, background: '#292929', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono', fontSize: '0.7rem', color: '#A0A0A0', flexShrink: 0 }}>
                  {student.name.substring(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{student.name}</div>
                  <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>{student.email}</div>
                </div>
                <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '0.35rem 0.7rem' }} onClick={() => handleEnroll(student.id)}>
                  ENROLL
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* New Course Modal */}
      <Modal isOpen={showNewCourse} onClose={() => { setShowNewCourse(false); setNewThumb(null); }} title="NEW COURSE">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="nc-title">Title</label>
            <input id="nc-title" className="form-input" value={newCourse.title} onChange={e => setNewCourse({ ...newCourse, title: e.target.value })} placeholder="e.g. React Testing in Practice" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="nc-desc">Description</label>
            <textarea id="nc-desc" className="form-input" rows={3} value={newCourse.description} onChange={e => setNewCourse({ ...newCourse, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="nc-vis">Enrollment</label>
            <select id="nc-vis" className="form-input" value={newCourse.visibility} onChange={e => setNewCourse({ ...newCourse, visibility: e.target.value })}>
              <option value="public">Open — learners can enrol themselves</option>
              <option value="invite_only">Invite only — I enrol learners</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="nc-price">Price (₹) <span style={{ color: '#8B8B8B' }}>(leave 0 for a free course)</span></label>
            <input id="nc-price" type="number" min="0" step="1" className="form-input" placeholder="0" value={newCourse.price} onChange={e => setNewCourse({ ...newCourse, price: e.target.value })} />
          </div>
          <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.85rem', color: '#C8C8C8' }}>
            <input type="checkbox" checked={publishNow} onChange={e => setPublishNow(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              Publish now
              <span style={{ display: 'block', fontSize: '0.72rem', color: '#808080' }}>
                {publishNow ? 'Learners can find and join this course right away.' : 'Saved as a draft. Learners cannot see it until you publish it.'}
              </span>
            </span>
          </label>
          <ThumbnailField
            label="Thumbnail"
            file={newThumb}
            onSelect={setNewThumb}
            onRemove={() => setNewThumb(null)}
            onError={(msg) => showNotification(msg, 'error')}
          />
          <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={handleCreateCourse}>CREATE COURSE</button>
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
