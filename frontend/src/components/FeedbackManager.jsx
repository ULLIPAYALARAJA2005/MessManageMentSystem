import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { socket } from '../socket';
import FeedbackForm from './FeedbackForm';
import FeedbackTemplateEditor from './FeedbackTemplateEditor';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';

/* ─── Admin: Preview Form Modal ─── */
const PreviewFormModal = ({ cycle, onClose }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(6px)',
          zIndex: 1200, animation: 'vmFadeIn 0.2s ease'
        }}
      />

      {/* Modal panel */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(560px, 96vw)', maxHeight: '92vh',
        background: '#0f0f0f', borderRadius: 20,
        border: '1px solid #ff7b0033',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column',
        zIndex: 1201, animation: 'vmSlideUp 0.28s cubic-bezier(0.32,0.72,0,1)'
      }}>
        {/* Modal header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #1e1e1e',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexShrink: 0,
          background: 'linear-gradient(135deg, #1a0e00, #0f0f0f)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.1rem' }}>📄</span>
            <div>
              <p style={{ color: '#ff9f44', fontWeight: 700, fontSize: '0.8rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Form Preview</p>
              <p style={{ color: '#777', fontSize: '0.75rem', margin: 0 }}>Student view of ‘{cycle.title}’</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#1e1e1e', border: '1px solid #333',
              color: '#aaa', borderRadius: 8,
              padding: '7px 14px', cursor: 'pointer',
              fontWeight: 700, fontSize: '1rem', lineHeight: 1
            }}
          >✕</button>
        </div>

        {/* Scrollable form area */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          <FeedbackForm cycle={cycle} previewMode={true} />
        </div>
      </div>
    </>
  );
};

/* ─── Helpers ─── */
const statusColor = (s) => ({
  active: '#2ed573', closed: '#ff4757', draft: '#888'
}[s] || '#888');

const statusBg = (s) => ({
  active: 'rgba(46,213,115,0.12)', closed: 'rgba(255,71,87,0.12)', draft: 'rgba(136,136,136,0.12)'
}[s] || 'rgba(136,136,136,0.12)');

const improvementIcon = (pct) => pct < 30 ? '🔴' : pct < 60 ? '🟡' : '🟢';

const SCORE_MAP = { 0: 100, 1: 75, 2: 50, 3: 25, 4: 0 };

/* ─── Default questions placeholder (mirrors backend DEFAULT_QUESTIONS) ─── */
const DEFAULT_QUESTIONS_PLACEHOLDER = [
  { id: 'q1',   question: 'Timeliness of the service', options: [{ id:'q1a', label:'A. Maintained' }, { id:'q1b', label:'B. Not Maintained (Delay < 10 minutes)' }, { id:'q1c', label:'C. Not Maintained (Delay < 1 hour)' }, { id:'q1d', label:'D. Not Maintained (Delay > 1 hour)' }, { id:'q1e', label:'E. Not maintaining regularly' }] },
  { id: 'q2',   question: 'Neatness/Cleanliness of surroundings', options: [{ id:'q2a', label:'A. Maintained' }, { id:'q2b', label:'B. Not maintained at dining area' }, { id:'q2c', label:'C. Not maintained at dining tables' }, { id:'q2d', label:'D. Not maintained at both' }, { id:'q2e', label:'E. Not maintaining regularly' }] },
  { id: 'q3i',  question: 'Quality of food – Boiled Rice / Banana', options: [{ id:'q3ia', label:'A. Maintained quality' }, { id:'q3ib', label:'B. Banana quality poor' }, { id:'q3ic', label:'C. Rice quality poor' }, { id:'q3id', label:'D. Both poor' }, { id:'q3ie', label:'E. Not maintaining regularly' }] },
  { id: 'q3ii', question: 'Quality of food – Taste of Curries / Fries', options: [{ id:'q3iia', label:'A. Both tasty' }, { id:'q3iib', label:'B. Fries not tasty' }, { id:'q3iic', label:'C. Curries not tasty' }, { id:'q3iid', label:'D. Both not tasty' }, { id:'q3iie', label:'E. Not maintaining regularly' }] },
  { id: 'q3iii',question: 'Quality of food – Snacks / Tea / Coffee / Breakfast', options: [{ id:'q3iiia', label:'A. Tasty' }, { id:'q3iiib', label:'B. Snacks not tasty' }, { id:'q3iiic', label:'C. Tea/Coffee not tasty' }, { id:'q3iiid', label:'D. Breakfast not tasty' }, { id:'q3iiie', label:'E. Not maintaining regularly' }] },
  { id: 'q4',   question: 'Quantity of food', options: [{ id:'q4a', label:'A. Maintained for all meals' }, { id:'q4b', label:'B. Not maintained in breakfast' }, { id:'q4c', label:'C. Not maintained in lunch' }, { id:'q4d', label:'D. Not maintained in lunch & dinner' }, { id:'q4e', label:'E. Not maintained regularly' }] },
  { id: 'q5',   question: 'Courtesy of staff', options: [{ id:'q5a', label:'A. Maintained' }, { id:'q5b', label:'B. Not maintained' }, { id:'q5c', label:'C. Not maintained regularly' }] },
  { id: 'q6',   question: 'Uniform & Hygiene', options: [{ id:'q6a', label:'A. Worn properly' }, { id:'q6b', label:'B. No head mask' }, { id:'q6c', label:'C. No uniform' }, { id:'q6d', label:'D. No gloves' }, { id:'q6e', label:'E. Not following regularly' }] },
  { id: 'q7',   question: 'Cooking as per menu', options: [{ id:'q7a', label:'A. Yes' }, { id:'q7b', label:'B. Issue in snacks' }, { id:'q7c', label:'C. Issue in milk products' }, { id:'q7d', label:'D. Issue in curry/dal' }, { id:'q7e', label:'E. Not maintaining regularly' }] },
  { id: 'q8',   question: 'Cleanliness of wash area', options: [{ id:'q8a', label:'A. Maintained' }, { id:'q8b', label:'B. Not maintained at dining area' }, { id:'q8c', label:'C. Not maintained at dining tables' }, { id:'q8d', label:'D. Not maintained at both' }, { id:'q8e', label:'E. Not maintaining regularly' }] },
];


/* ═══════════════════════════════════════════
   View Responses Modal
═══════════════════════════════════════════ */
const ViewResponsesModal = ({ cycle, onClose }) => {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    api.get(`/feedback/responses/${cycle._id}`)
      .then(r => setResponses(r.data))
      .catch(() => toast.error('Failed to load responses'))
      .finally(() => setLoading(false));
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [cycle._id]);

  const badgeColor = { diamond: '#00d4ff', gold: '#f39c12', silver: '#bdc3c7', none: '#555' };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)', zIndex: 1100,
          animation: 'vmFadeIn 0.2s ease'
        }}
      />

      {/* Modal panel */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(720px, 96vw)', maxHeight: '88vh',
        background: '#141414', borderRadius: 20,
        border: '1px solid #2a2a2a',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column',
        zIndex: 1101,
        animation: 'vmSlideUp 0.28s cubic-bezier(0.32,0.72,0,1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '22px 28px', borderBottom: '1px solid #222',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>📋 {cycle.title}</h3>
            <p style={{ color: '#666', fontSize: '0.82rem', marginTop: 5 }}>
              {responses.length} response{responses.length !== 1 ? 's' : ''} submitted &nbsp;·&nbsp;
              Deadline:&nbsp;
              <span style={{ color: '#ff9f44' }}>
                {new Date(cycle.deadline).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#222', border: '1px solid #333', color: '#999',
              borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem'
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px 28px', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
              <p style={{ fontSize: '1.8rem' }}>⏳</p>
              <p style={{ marginTop: 10 }}>Loading responses...</p>
            </div>
          ) : responses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#555' }}>
              <p style={{ fontSize: '2rem' }}>📭</p>
              <p style={{ marginTop: 10 }}>No responses yet for this cycle.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {responses.map((resp, i) => {
                const isOpen = expandedId === resp._id;
                const answerCount = Object.keys(resp.answers || {}).length;
                const bc = badgeColor[resp.badge] || badgeColor.none;

                return (
                  <div
                    key={resp._id}
                    style={{
                      background: '#1c1c1c', borderRadius: 12,
                      border: `1px solid ${isOpen ? '#ff7b0044' : '#252525'}`,
                      overflow: 'hidden', transition: 'border-color 0.2s'
                    }}
                  >
                    {/* Row header */}
                    <div
                      onClick={() => setExpandedId(isOpen ? null : resp._id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 18px', cursor: 'pointer'
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg, #ff7b00, #ff4757)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.85rem', fontWeight: 800, color: '#fff'
                      }}>
                        {(resp.studentName || 'S')[0].toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.92rem' }}>
                            {resp.studentName || 'Unknown Student'}
                          </span>
                          {resp.badge && resp.badge !== 'none' && (
                            <span style={{
                              fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                              padding: '2px 8px', borderRadius: 20,
                              background: `${bc}18`, color: bc, border: `1px solid ${bc}44`
                            }}>
                              {resp.badge} · {resp.weight}x
                            </span>
                          )}
                        </div>
                        <p style={{ color: '#555', fontSize: '0.75rem', marginTop: 3 }}>
                          {answerCount} answers &nbsp;·&nbsp;
                          {resp.submittedAt ? new Date(resp.submittedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          {resp.comments ? ' · 💬 Has comment' : ''}
                        </p>
                      </div>

                      <span style={{
                        color: '#444', fontSize: '0.75rem',
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s', flexShrink: 0
                      }}>▼</span>
                    </div>

                    {/* Expanded answers */}
                    {isOpen && (
                      <div style={{ padding: '0 18px 18px', borderTop: '1px solid #222' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                          {(cycle.questions || []).map(q => {
                            const selectedId = resp.answers?.[q.id];
                            const selectedOpt = q.options?.find(o => o.id === selectedId);
                            const isGood = selectedOpt && q.options?.indexOf(selectedOpt) === 0;

                            return (
                              <div key={q.id} style={{
                                background: '#111', borderRadius: 10, padding: '11px 14px',
                                borderLeft: `3px solid ${isGood ? '#2ed57355' : selectedOpt ? '#ff7b0055' : '#333'}`
                              }}>
                                <p style={{ color: '#888', fontSize: '0.72rem', marginBottom: 5 }}>{q.question}</p>
                                <p style={{
                                  color: selectedOpt ? (isGood ? '#2ed573' : '#ff9f44') : '#444',
                                  fontWeight: 600, fontSize: '0.85rem', margin: 0
                                }}>
                                  {selectedOpt ? selectedOpt.label : '— Not answered'}
                                </p>
                              </div>
                            );
                          })}

                          {resp.comments && (
                            <div style={{
                              background: '#111', borderRadius: 10, padding: '11px 14px',
                              borderLeft: '3px solid #1e90ff55'
                            }}>
                              <p style={{ color: '#888', fontSize: '0.72rem', marginBottom: 5 }}>Additional Comments</p>
                              <p style={{ color: '#aad4ff', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>"{resp.comments}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes vmFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes vmSlideUp { from { opacity:0; transform:translate(-50%,-46%) } to { opacity:1; transform:translate(-50%,-50%) } }
      `}</style>
    </>
  );
};

/* ═══════════════════════════════════════════
   Sub-tab 1 – Scheduler / Cycle Management
═══════════════════════════════════════════ */
const SchedulerTab = ({ cycles, config, onRefresh, globalTemplate }) => {
  const [viewCycle, setViewCycle] = useState(null);
  const [previewCycle, setPreviewCycle] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [customQuestions, setCustomQuestions] = useState(null); // null = use backend default
  const [form, setForm] = useState({
    title: '',
    deadline: '',
    scheduleDays: 7
  });
  const [configForm, setConfigForm] = useState({
    scheduleDays: config?.scheduleDays || 7,
    deadlineDays: config?.deadlineDays || 3,
    enabled: config?.enabled || false
  });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setConfigForm({
      scheduleDays: config?.scheduleDays || 7,
      deadlineDays: config?.deadlineDays || 3,
      enabled: config?.enabled || false
    });
  }, [config]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.deadline) return toast.error('Set a deadline');
    setLoading(true);
    try {
      const payload = { ...form };
      if (customQuestions) payload.questions = customQuestions;
      await api.post('/feedback/create', payload);
      toast.success('Feedback cycle created & sent to students! 📢');
      setForm({ title: '', deadline: '', scheduleDays: 7 });
      setCustomQuestions(null);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await api.put('/feedback/config', configForm);
      toast.success('Schedule config saved!');
    } catch (err) {
      toast.error('Failed to save config');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this feedback cycle and all its responses?')) return;
    try {
      await api.delete(`/feedback/${id}`);
      toast.success('Deleted');
      onRefresh();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleEdit = (cycle) => {
    setEditingId(cycle._id);
    setEditForm({ title: cycle.title, deadline: cycle.deadline, status: cycle.status });
  };

  const handleSaveEdit = async (id) => {
    try {
      await api.put(`/feedback/${id}`, editForm);
      toast.success('Updated');
      setEditingId(null);
      onRefresh();
    } catch (err) {
      toast.error('Update failed');
    }
  };

  return (
    <div>
      {/* Modals */}
      {viewCycle && <ViewResponsesModal cycle={viewCycle} onClose={() => setViewCycle(null)} />}
      {previewCycle && <PreviewFormModal cycle={previewCycle} onClose={() => setPreviewCycle(null)} />}

      {/* Template editor — shown when admin wants to customize before creating */}
      {showEditor && (
        <FeedbackTemplateEditor
          initialQuestions={customQuestions || (globalTemplate?.length ? globalTemplate : DEFAULT_QUESTIONS_PLACEHOLDER)}
          onSave={(qs) => setCustomQuestions(qs)}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* Config panel */}
      <div style={{
        background: '#111', borderRadius: 14, padding: '22px 24px', marginBottom: 24,
        border: '1px solid #ff7b0022'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h4 style={{ color: '#ff7b00', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚙️ Auto-Schedule Config
          </h4>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#1a1a1a', padding: '6px 12px', borderRadius: 20, border: '1px solid #333', transition: '0.2s' }}>
            <span style={{ fontSize: '0.7rem', color: configForm.enabled ? '#ff7b00' : '#666', fontWeight: 800, letterSpacing: '0.5px' }}>
              {configForm.enabled ? '🟢 AUTO-TRIGGER ON' : '⚪ AUTO-TRIGGER OFF'}
            </span>
            <input 
              type="checkbox" 
              checked={configForm.enabled} 
              onChange={e => setConfigForm(p => ({ ...p, enabled: e.target.checked }))}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#ff7b00' }}
            />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, alignItems: 'flex-end' }}>
          <div>
            <label style={{ color: '#888', fontSize: '0.78rem', display: 'block', marginBottom: 6 }}>FREQUENCY (DAYS)</label>
            <input
              type="number" min="1" value={configForm.scheduleDays}
              onChange={e => setConfigForm(p => ({ ...p, scheduleDays: +e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 8 }}
            />
          </div>
          <div>
            <label style={{ color: '#888', fontSize: '0.78rem', display: 'block', marginBottom: 6 }}>AUTO DEADLINE (DAYS AFTER START)</label>
            <input
              type="number" min="1" value={configForm.deadlineDays}
              onChange={e => setConfigForm(p => ({ ...p, deadlineDays: +e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 8 }}
            />
          </div>
          <button
            onClick={handleSaveConfig}
            style={{ padding: '10px 20px', background: '#ff7b00', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
        <p style={{ color: '#555', fontSize: '0.78rem', marginTop: 10 }}>
          Auto-trigger: If {configForm.scheduleDays} days have passed since last cycle, a new one is created automatically when students load the feedback page.
        </p>
      </div>

      {/* Create form */}
      <div style={{
        background: 'var(--surface-color)', borderRadius: 14,
        padding: '24px', marginBottom: 28, border: '1px solid #333'
      }}>
        <h3 style={{ marginBottom: 20 }}>📤 Create New Feedback Cycle</h3>
        <form onSubmit={handleCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ color: '#888', fontSize: '0.78rem', display: 'block', marginBottom: 6 }}>TITLE</label>
              <input
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder={`Weekly Feedback – ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                style={{ width: '100%', padding: '11px 12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 8 }}
              />
            </div>
            <div>
              <label style={{ color: '#888', fontSize: '0.78rem', display: 'block', marginBottom: 6 }}>DEADLINE DATE & TIME</label>
              <input
                type="datetime-local" value={form.deadline} required
                onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                style={{ width: '100%', padding: '11px 12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 8 }}
              />
            </div>
          </div>

          {/* Questions customisation strip */}
          <div style={{
            background: '#111', border: '1px solid #2a2a2a', borderRadius: 10,
            padding: '12px 16px', marginBottom: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap'
          }}>
            <div>
              <p style={{ color: '#ccc', fontWeight: 600, fontSize: '0.88rem', margin: 0 }}>
                📋 Questions Template
              </p>
              <p style={{ color: customQuestions ? '#ff9f44' : '#555', fontSize: '0.75rem', marginTop: 3 }}>
                {customQuestions
                  ? `${customQuestions.filter(q => !q.hidden).length} visible · ${customQuestions.filter(q => q.hidden).length} hidden · ${customQuestions.length} total (Custom)`
                  : `Global Template will be used (${(globalTemplate?.length ? globalTemplate : DEFAULT_QUESTIONS_PLACEHOLDER).filter(q => !q.hidden).length} visible questions)`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {customQuestions && (
                <button
                  type="button"
                  onClick={() => setCustomQuestions(null)}
                  style={{
                    padding: '8px 14px', background: '#2b1010', color: '#ff4757',
                    border: '1px solid #ff475733', borderRadius: 8, cursor: 'pointer',
                    fontWeight: 600, fontSize: '0.8rem'
                  }}
                >
                  ✕ Reset to Default
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowEditor(true)}
                style={{
                  padding: '8px 18px',
                  background: customQuestions ? 'linear-gradient(135deg, #261800, #1a1000)' : '#1a1a1a',
                  color: customQuestions ? '#ff9f44' : '#888',
                  border: `1px solid ${customQuestions ? '#ff7b0055' : '#333'}`,
                  borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem'
                }}
              >
                ✏️ {customQuestions ? 'Edit Questions' : 'Customize Questions'}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              padding: '13px 32px', background: '#ff7b00', color: '#fff',
              border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer',
              fontSize: '1rem', opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? '⏳ Creating...' : '🚀 Create & Send to Students'}
          </button>
        </form>
      </div>

      {/* Cycles list */}
      <h3 style={{ marginBottom: 16 }}>📋 All Feedback Cycles</h3>
      {cycles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', background: 'var(--surface-color)', borderRadius: 14, color: '#555' }}>
          <p style={{ fontSize: '2rem' }}>📭</p>
          <p style={{ marginTop: 10 }}>No feedback cycles yet. Create one above!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {cycles.map(cycle => {
            const isEditing = editingId === cycle._id;
            const statusC = statusColor(cycle.status);
            const statusB = statusBg(cycle.status);

            return (
              <div key={cycle._id} style={{
                background: 'var(--surface-color)', borderRadius: 14,
                padding: '20px 24px', border: '1px solid #2a2a2a',
                borderLeft: `4px solid ${statusC}`
              }}>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <input
                      value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                      style={{ padding: '9px 12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 8 }}
                      placeholder="Title"
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                      <input
                        type="datetime-local" value={editForm.deadline?.slice(0, 16)}
                        onChange={e => setEditForm(p => ({ ...p, deadline: e.target.value }))}
                        style={{ padding: '9px 12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 8 }}
                      />
                      <select
                        value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                        style={{ padding: '9px 12px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 8 }}
                      >
                        <option value="active">Active</option>
                        <option value="closed">Closed</option>
                        <option value="draft">Draft</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => handleSaveEdit(cycle._id)} style={{ padding: '9px 20px', background: '#2ed573', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditingId(null)} style={{ padding: '9px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Info row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ background: statusB, color: statusC, padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }}>
                            {cycle.status.toUpperCase()}
                          </span>
                          {cycle.isAuto && (
                            <span style={{ background: '#1e90ff18', color: '#1e90ff', padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem' }}>⚡ AUTO</span>
                          )}
                          <h4 style={{ color: '#fff', margin: 0, fontSize: '1rem' }}>{cycle.title}</h4>
                        </div>
                        <p style={{ color: '#555', fontSize: '0.8rem', lineHeight: 1.7 }}>
                          📅 Created:&nbsp;{new Date(cycle.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          &nbsp;·&nbsp;
                          ⏰ Deadline:&nbsp;
                          <span style={{ color: cycle.status === 'closed' ? '#ff4757' : '#ff9f44' }}>
                            {new Date(cycle.deadline).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </p>
                      </div>

                      {/* Response count pill */}
                      <div style={{
                        background: '#111', borderRadius: 10, padding: '10px 18px', textAlign: 'center',
                        border: '1px solid #2a2a2a', minWidth: 80, flexShrink: 0
                      }}>
                        <p style={{ color: statusC, fontWeight: 800, fontSize: '1.4rem', margin: 0 }}>{cycle.responseCount || 0}</p>
                        <p style={{ color: '#555', fontSize: '0.7rem', marginTop: 2 }}>responses</p>
                      </div>
                    </div>

                    {/* Action buttons bar */}
                    <div className="mobile-responsive-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {/* Preview Form */}
                      <button
                        onClick={() => setPreviewCycle(cycle)}
                        style={{
                          flex: '1 1 auto',
                          padding: '11px 18px',
                          background: 'linear-gradient(135deg, #1a1000, #261600)',
                          color: '#ff9f44', border: '1px solid #ff7b0044',
                          borderRadius: 10, cursor: 'pointer', fontWeight: 700,
                          fontSize: '0.88rem', display: 'flex', alignItems: 'center',
                          gap: 7, transition: 'all 0.18s ease', whiteSpace: 'nowrap'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#261800'}
                        onMouseOut={e => e.currentTarget.style.background = 'linear-gradient(135deg, #1a1000, #261600)'}
                      >
                        📄 Preview Form
                      </button>

                      {/* View Responses */}
                      <button
                        onClick={() => setViewCycle(cycle)}
                        style={{
                          padding: '11px 18px',
                          background: 'linear-gradient(135deg, #1e3a5f, #1a2a40)',
                          color: '#60aaff', border: '1px solid #1e90ff44',
                          borderRadius: 10, cursor: 'pointer', fontWeight: 700,
                          fontSize: '0.88rem', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: 8, transition: 'all 0.18s ease'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#1e3a7a'}
                        onMouseOut={e => e.currentTarget.style.background = 'linear-gradient(135deg, #1e3a5f, #1a2a40)'}
                      >
                        👁 View Responses ({cycle.responseCount || 0})
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleEdit(cycle)}
                        style={{
                          padding: '11px 20px',
                          background: '#1c2b1c', color: '#2ed573',
                          border: '1px solid #2ed57344', borderRadius: 10,
                          cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                          display: 'flex', alignItems: 'center', gap: 6,
                          transition: 'all 0.18s ease'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#253525'}
                        onMouseOut={e => e.currentTarget.style.background = '#1c2b1c'}
                      >
                        ✏️ Edit
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(cycle._id)}
                        style={{
                          padding: '11px 20px',
                          background: '#2b1515', color: '#ff4757',
                          border: '1px solid #ff475744', borderRadius: 10,
                          cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                          display: 'flex', alignItems: 'center', gap: 6,
                          transition: 'all 0.18s ease'
                        }}
                        onMouseOver={e => e.currentTarget.style.background = '#3a1a1a'}
                        onMouseOut={e => e.currentTarget.style.background = '#2b1515'}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   Sub-tab 2 – Analytics
═══════════════════════════════════════════ */
const AnalyticsTab = ({ cycles }) => {
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = useCallback(async (id) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/feedback/analytics/${id}`);
      setAnalytics(data);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCycleId && cycles.length > 0) {
      const firstActive = cycles.find(c => c.status === 'active') || cycles[0];
      setSelectedCycleId(firstActive._id);
      fetchAnalytics(firstActive._id);
    }
  }, [cycles]);

  const handleCycleChange = (id) => {
    setSelectedCycleId(id);
    fetchAnalytics(id);
  };

  if (cycles.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#555' }}>
        <p style={{ fontSize: '2rem' }}>📊</p>
        <p style={{ marginTop: 10 }}>Create a feedback cycle first to see analytics.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Cycle selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ color: '#888', fontSize: '0.78rem', display: 'block', marginBottom: 8 }}>SELECT CYCLE</label>
        <select
          value={selectedCycleId}
          onChange={e => handleCycleChange(e.target.value)}
          style={{ padding: '11px 14px', background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 10, fontSize: '0.95rem', minWidth: 280 }}
        >
          {cycles.map(c => (
            <option key={c._id} value={c._id}>{c.title} — {c.status.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading analytics…</div>}

      {analytics && !loading && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Total Students', value: analytics.totalStudents, color: '#1e90ff', icon: '👨‍🎓' },
              { label: 'Responses', value: analytics.responseCount, color: '#2ed573', icon: '💬' },
              { label: 'Response Rate', value: `${analytics.totalStudents > 0 ? Math.round(analytics.responseCount / analytics.totalStudents * 100) : 0}%`, color: '#ff7b00', icon: '📈' },
              { label: 'Issues Found', value: analytics.worstCategories?.length || 0, color: '#ff4757', icon: '⚠️' },
            ].map(card => (
              <div key={card.label} style={{ background: 'var(--surface-color)', padding: '18px 20px', borderRadius: 12, borderLeft: `4px solid ${card.color}` }}>
                <div style={{ fontSize: '1.4rem' }}>{card.icon}</div>
                <p style={{ color: '#888', fontSize: '0.78rem', marginTop: 8 }}>{card.label}</p>
                <h2 style={{ color: card.color, marginTop: 4 }}>{card.value}</h2>
              </div>
            ))}
          </div>

          {/* Response rate bar */}
          <div style={{ background: 'var(--surface-color)', padding: '20px 24px', borderRadius: 14, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <h4>Response Progress</h4>
              <span style={{ color: '#ff7b00', fontWeight: 700 }}>
                {analytics.responseCount} / {analytics.totalStudents} students
              </span>
            </div>
            <div style={{ background: '#2a2a2a', borderRadius: 8, height: 12, overflow: 'hidden' }}>
              <div style={{
                width: `${analytics.totalStudents > 0 ? Math.min(100, analytics.responseCount / analytics.totalStudents * 100) : 0}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #ff7b00, #ff9f44)',
                borderRadius: 8, transition: 'width 0.6s ease'
              }} />
            </div>
          </div>

          {/* Improvement Alerts */}
          {analytics.worstCategories?.length > 0 && (
            <div style={{ background: '#1a0d00', border: '1px solid #ff7b0033', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
              <h4 style={{ color: '#ff7b00', marginBottom: 14 }}>🔥 Improvement Needed</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {analytics.worstCategories.map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#111', padding: '12px 16px', borderRadius: 10
                  }}>
                    <span style={{ color: '#ddd', fontSize: '0.9rem' }}>
                      {improvementIcon(w.maintainedPct)} {w.question}
                    </span>
                    <span style={{
                      color: w.maintainedPct < 30 ? '#ff4757' : w.maintainedPct < 60 ? '#f39c12' : '#888',
                      fontWeight: 700, fontSize: '0.9rem'
                    }}>
                      {w.maintainedPct}% maintained
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-question charts */}
          {Object.values(analytics.questionStats || {}).map((qs, i) => {
            const chartData = qs.options.map(opt => ({
              name: opt.label.split('. ')[0],
              fullLabel: opt.label,
              responses: opt.count,
              weighted: opt.weightedCount
            }));

            return (
              <div key={i} style={{ background: 'var(--surface-color)', padding: '20px 24px', borderRadius: 14, marginBottom: 16 }}>
                <h4 style={{ marginBottom: 4, fontSize: '0.9rem' }}>{qs.question}</h4>
                <p style={{ color: '#555', fontSize: '0.75rem', marginBottom: 16 }}>
                  {qs.options.reduce((a, o) => a + o.count, 0)} responses — hover for details
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                    <XAxis dataKey="name" stroke="#666" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#666" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }}
                      formatter={(value, name, props) => [value, name === 'responses' ? 'Responses' : 'Weighted']}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.fullLabel || label}
                    />
                    <Bar dataKey="responses" fill="#ff7b00" radius={[4, 4, 0, 0]} name="Responses" />
                    <Bar dataKey="weighted" fill="#1e90ff" radius={[4, 4, 0, 0]} name="Weighted" fillOpacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}

          {/* Comments */}
          {analytics.comments?.length > 0 && (
            <div style={{ background: 'var(--surface-color)', padding: '20px 24px', borderRadius: 14 }}>
              <h4 style={{ marginBottom: 14 }}>💬 Student Comments ({analytics.comments.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {analytics.comments.map((c, i) => (
                  <div key={i} style={{ background: '#111', padding: '14px 16px', borderRadius: 10, borderLeft: '3px solid #ff7b00' }}>
                    <p style={{ color: '#ddd', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>"{c.comment}"</p>
                    <p style={{ color: '#555', fontSize: '0.74rem', marginTop: 8 }}>
                      — {c.studentName} · {c.submittedAt ? new Date(c.submittedAt).toLocaleDateString('en-IN') : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   Sub-tab 3 – History & Comparison
═══════════════════════════════════════════ */
const HistoryTab = () => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get('/feedback/history').then(r => setHistory(r.data)).catch(() => {});
  }, []);

  const chartData = history.map(h => ({
    name: h.title?.split('–')[1]?.trim() || h.title || '',
    avgScore: h.avgScore,
    responses: h.responseCount
  }));

  return (
    <div>
      {history.length < 2 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'var(--surface-color)', borderRadius: 14, color: '#555' }}>
          <p style={{ fontSize: '2rem' }}>📉</p>
          <p style={{ marginTop: 10 }}>At least 2 cycles needed for comparison charts.</p>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--surface-color)', padding: '22px 24px', borderRadius: 14, marginBottom: 24 }}>
            <h4 style={{ marginBottom: 18 }}>📈 Weekly Average Score Trend</h4>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                <XAxis dataKey="name" stroke="#666" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} stroke="#666" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="avgScore" stroke="#ff7b00" strokeWidth={2.5} dot={{ r: 4 }} name="Avg Score (%)" />
                <Line type="monotone" dataKey="responses" stroke="#1e90ff" strokeWidth={2} dot={{ r: 3 }} name="Responses" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: 'var(--surface-color)', padding: '22px 24px', borderRadius: 14 }}>
            <h4 style={{ marginBottom: 14 }}>📋 Cycle History</h4>
            <div className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#1a1a1a', color: '#888' }}>
                  {['Week / Cycle', 'Date', 'Responses', 'Avg Score', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1e1e1e' }}>
                    <td style={{ padding: '12px 14px', color: '#ddd', fontWeight: 500 }}>{h.title}</td>
                    <td style={{ padding: '12px 14px', color: '#888' }}>{h.date ? new Date(h.date).toLocaleDateString('en-IN') : '—'}</td>
                    <td style={{ padding: '12px 14px', color: '#1e90ff', fontWeight: 700 }}>{h.responseCount}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        color: h.avgScore >= 70 ? '#2ed573' : h.avgScore >= 40 ? '#f39c12' : '#ff4757',
                        fontWeight: 700
                      }}>
                        {h.avgScore}%
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        background: h.responseCount > 0 ? '#2ed57322' : '#ff475722',
                        color: h.responseCount > 0 ? '#2ed573' : '#ff4757',
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem'
                      }}>
                        {h.responseCount > 0 ? '✓ Has Responses' : '○ No Responses'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   Sub-tab 4 – Global Template (Permanent Edit)
═══════════════════════════════════════════ */
const GlobalTemplateTab = ({ template, isDefault, onRefresh }) => {
  const [showEditor, setShowEditor] = useState(false);

  const handleSaveTemplate = async (newQs) => {
    try {
      await api.put('/feedback/template', { questions: newQs });
      toast.success('Global Template updated permanently!');
      onRefresh();
    } catch {
      toast.error('Failed to save global template');
    }
  };

  const visibleCount = template.filter(q => !q.hidden).length;

  return (
    <div>
      {showEditor && (
        <FeedbackTemplateEditor
          initialQuestions={template}
          onSave={handleSaveTemplate}
          onClose={() => setShowEditor(false)}
        />
      )}

      <div style={{
        background: 'var(--surface-color)', padding: '24px', borderRadius: 14,
        border: '1px solid #333', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
      }}>
        <div>
          <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.4rem' }}>🛠️</span> Global Feedback Template
          </h3>
          <p style={{ color: '#888', fontSize: '0.88rem', marginTop: 8, lineHeight: 1.5, maxWidth: 600 }}>
            This template is the default for all future feedback cycles (including auto-scheduled ones).
            Any edits made here are permanent.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <span style={{ background: isDefault ? '#333' : '#ff7b0033', color: isDefault ? '#aaa' : '#ff9f44', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 }}>
              {isDefault ? 'Using System Default' : 'Customized Template'}
            </span>
            <span style={{ background: '#1e1e1e', color: '#ccc', padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem' }}>
              {visibleCount} visible questions ({template.length} total)
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowEditor(true)}
          style={{
            padding: '12px 24px', background: 'linear-gradient(135deg, #ff7b00, #ff9f44)',
            color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem',
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,123,0,0.3)', transition: 'transform 0.2s'
          }}
        >
          ✏️ Edit Global Template
        </button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {template.map((q, i) => (
          <div key={q.id} style={{
            background: q.hidden ? '#111' : '#1a1a1a', padding: '16px 20px',
            border: `1px solid ${q.hidden ? '#222' : '#333'}`, borderRadius: 12,
            opacity: q.hidden ? 0.6 : 1
          }}>
            <p style={{ color: '#666', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: 4 }}>
              Question {i + 1} {q.hidden && '· (HIDDEN)'}
            </p>
            <h4 style={{ color: '#ddd', fontSize: '0.95rem', margin: 0 }}>{q.question}</h4>
            <p style={{ color: '#666', fontSize: '0.75rem', marginTop: 6, margin: 0 }}>
              {q.options.filter(o => !o.hidden).length} active options
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   Main FeedbackManager
═══════════════════════════════════════════ */
const FeedbackManager = () => {
  const [subTab, setSubTab] = useState('scheduler');
  const [cycles, setCycles] = useState([]);
  const [config, setConfig] = useState(null);
  const [template, setTemplate] = useState([]);
  const [isDefaultTemplate, setIsDefaultTemplate] = useState(true);
  const [liveCount, setLiveCount] = useState(0);

  const fetchAll = useCallback(async () => {
    try {
      api.get('/feedback/all').then(res => setCycles(res.data)).catch(err => console.error("Error fetching feedback cycles", err));
      api.get('/feedback/config').then(res => setConfig(res.data)).catch(err => console.error("Error fetching feedback config", err));
      api.get('/feedback/template').then(res => {
        setTemplate(res.data.questions || []);
        setIsDefaultTemplate(res.data.isDefault);
      }).catch(err => console.error("Error fetching feedback template", err));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchAll();

    socket.on('feedbackResponseReceived', (data) => {
      setLiveCount(p => p + 1);
      toast(`📝 ${data.studentName || 'A student'} submitted feedback!`, { icon: '📋' });
      fetchAll();
    });
    socket.on('feedbackCycleCreated', () => fetchAll());
    socket.on('feedbackCycleUpdated', () => fetchAll());
    socket.on('feedbackCycleDeleted', () => fetchAll());

    return () => {
      socket.off('feedbackResponseReceived');
      socket.off('feedbackCycleCreated');
      socket.off('feedbackCycleUpdated');
      socket.off('feedbackCycleDeleted');
    };
  }, []);

  const SUB_TABS = [
    { id: 'scheduler', label: '📅 Scheduler & Cycles' },
    { id: 'template', label: '🛠️ Global Template' },
    { id: 'analytics', label: '📊 Analytics' },
    { id: 'history', label: '📉 History' },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a1a, #222)',
        padding: '20px 24px', borderRadius: 14, marginBottom: 24,
        borderLeft: '4px solid #ff7b00',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>📋 Weekly Feedback System</h3>
          <p style={{ color: '#888', marginTop: 4, fontSize: '0.85rem' }}>
            Manage feedback cycles, view analytics, and track improvement trends.
          </p>
        </div>
        {liveCount > 0 && (
          <div style={{
            background: '#2ed57322', border: '1px solid #2ed57355',
            padding: '10px 20px', borderRadius: 10, textAlign: 'center'
          }}>
            <p style={{ color: '#2ed573', fontWeight: 700, fontSize: '1.2rem', margin: 0 }}>+{liveCount}</p>
            <p style={{ color: '#2ed57399', fontSize: '0.72rem', margin: 0 }}>New responses</p>
          </div>
        )}
      </div>

      {/* Sub-tab nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
              background: subTab === t.id ? '#ff7b00' : '#1a1a1a',
              color: subTab === t.id ? '#fff' : '#888',
              transition: 'all 0.2s ease'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'scheduler' && <SchedulerTab cycles={cycles} config={config} onRefresh={fetchAll} globalTemplate={template} />}
      {subTab === 'template' && <GlobalTemplateTab template={template} isDefault={isDefaultTemplate} onRefresh={fetchAll} />}
      {subTab === 'analytics' && <AnalyticsTab cycles={cycles} />}
      {subTab === 'history' && <HistoryTab />}
    </div>
  );
};

export default FeedbackManager;
