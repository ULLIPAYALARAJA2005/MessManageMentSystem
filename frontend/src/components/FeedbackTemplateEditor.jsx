import React, { useState } from 'react';
import toast from 'react-hot-toast';
import FeedbackForm from './FeedbackForm';

/* ── Tiny ID generator ── */
const uid = () => Math.random().toString(36).slice(2, 9);

/* ══════════════════════════════════════════════
   Inline editable text — click to edit in place
══════════════════════════════════════════════ */
const EditableText = ({ value, onChange, style = {}, placeholder = 'Enter text…', multiline = false }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) onChange(trimmed);
    else setDraft(value);
    setEditing(false);
  };

  if (editing) {
    const shared = {
      value: draft,
      onChange: e => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: e => { if (e.key === 'Enter' && !multiline) commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } },
      autoFocus: true,
      style: {
        background: '#111', color: '#fff',
        border: '1.5px solid #ff7b00',
        borderRadius: 8, padding: '6px 10px',
        fontSize: '0.9rem', width: '100%',
        fontFamily: 'Inter, sans-serif',
        outline: 'none', resize: 'vertical',
        ...style
      }
    };
    return multiline ? <textarea rows={2} {...shared} /> : <input type="text" {...shared} />;
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      title="Click to edit"
      style={{
        ...style, cursor: 'text',
        borderBottom: '1px dashed #444',
        paddingBottom: 1, display: 'inline-block'
      }}
    >
      {value || <span style={{ color: '#555' }}>{placeholder}</span>}
    </span>
  );
};

/* ══════════════════════════════════════════════
   Option Row
══════════════════════════════════════════════ */
const OptionRow = ({ opt, onEdit, onToggle, onDelete, idx }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px',
    background: opt.hidden ? '#0e0e0e' : '#111',
    border: `1px solid ${opt.hidden ? '#1a1a1a' : '#252525'}`,
    borderRadius: 10,
    opacity: opt.hidden ? 0.5 : 1,
    transition: 'all 0.15s ease'
  }}>
    {/* Radio dot (visual only) */}
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: '2px solid #444', flexShrink: 0
    }} />

    {/* Label */}
    <div style={{ flex: 1 }}>
      <EditableText
        value={opt.label}
        onChange={v => onEdit({ ...opt, label: v })}
        style={{ color: opt.hidden ? '#555' : '#ccc', fontSize: '0.85rem' }}
        placeholder="Option label…"
      />
    </div>

    {/* Actions */}
    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <button
        onClick={() => onToggle()}
        title={opt.hidden ? 'Show option' : 'Hide option'}
        style={{
          background: opt.hidden ? '#2b2b00' : '#1e1e1e',
          color: opt.hidden ? '#aaa' : '#666',
          border: 'none', borderRadius: 6,
          padding: '4px 8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600
        }}
      >
        {opt.hidden ? '👁 Show' : '🙈 Hide'}
      </button>
      <button
        onClick={() => onDelete()}
        title="Delete option"
        style={{
          background: '#2b1010', color: '#ff4757',
          border: 'none', borderRadius: 6,
          padding: '4px 8px', cursor: 'pointer', fontSize: '0.72rem'
        }}
      >
        ✕
      </button>
    </div>
  </div>
);

/* ══════════════════════════════════════════════
   Question Card
══════════════════════════════════════════════ */
const QuestionCard = ({ q, idx, total, onChange, onDelete, onMoveUp, onMoveDown }) => {
  const [expanded, setExpanded] = useState(true);

  const updateOption = (oid, updater) => {
    onChange({
      ...q,
      options: q.options.map(o => o.id === oid ? updater(o) : o)
    });
  };

  const deleteOption = (oid) => {
    if (q.options.length <= 2) {
      toast.error('A question must have at least 2 options');
      return;
    }
    onChange({ ...q, options: q.options.filter(o => o.id !== oid) });
  };

  const addOption = () => {
    const newOpt = { id: uid(), label: `Option ${String.fromCharCode(65 + q.options.length)}. New option` };
    onChange({ ...q, options: [...q.options, newOpt] });
  };

  return (
    <div style={{
      background: q.hidden ? '#111' : '#1a1a1a',
      border: `1.5px solid ${q.hidden ? '#1e1e1e' : expanded ? '#ff7b0033' : '#252525'}`,
      borderRadius: 14, overflow: 'hidden',
      opacity: q.hidden ? 0.55 : 1,
      transition: 'all 0.2s ease'
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '14px 16px', cursor: 'pointer',
        background: q.hidden ? '#0d0d0d' : 'transparent'
      }}>
        {/* Number badge */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: q.hidden ? '#1e1e1e' : '#ff7b0022',
          color: q.hidden ? '#444' : '#ff7b00',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.75rem', fontWeight: 800, marginTop: 2
        }}>
          {idx + 1}
        </div>

        {/* Question text */}
        <div style={{ flex: 1 }} onClick={e => e.stopPropagation()}>
          <p style={{ color: '#666', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
            Question {idx + 1} of {total} {q.hidden && '· HIDDEN'}
          </p>
          <EditableText
            value={q.question}
            onChange={v => onChange({ ...q, question: v })}
            style={{ color: q.hidden ? '#555' : '#e0e0e0', fontSize: '0.92rem', fontWeight: 500, lineHeight: 1.4 }}
            placeholder="Question text…"
            multiline
          />
          <p style={{ color: '#555', fontSize: '0.7rem', marginTop: 6 }}>
            {q.options.filter(o => !o.hidden).length}/{q.options.length} options visible
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(p => !p)}
            style={{
              background: '#252525', color: '#888', border: 'none',
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            {expanded ? '▲ Collapse' : '▼ Options'}
          </button>

          <div style={{ display: 'flex', gap: 5 }}>
            {/* Move up/down */}
            {idx > 0 && (
              <button onClick={onMoveUp} title="Move up" style={{ background: '#1e1e1e', color: '#666', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>↑</button>
            )}
            {idx < total - 1 && (
              <button onClick={onMoveDown} title="Move down" style={{ background: '#1e1e1e', color: '#666', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>↓</button>
            )}

            {/* Hide toggle */}
            <button
              onClick={() => onChange({ ...q, hidden: !q.hidden })}
              title={q.hidden ? 'Show question' : 'Hide question'}
              style={{
                background: q.hidden ? '#2b2b00' : '#1e1e1e',
                color: q.hidden ? '#cc0' : '#888',
                border: 'none', borderRadius: 6,
                padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
              }}
            >
              {q.hidden ? '👁 Show' : '🙈 Hide'}
            </button>

            {/* Delete */}
            <button
              onClick={onDelete}
              title="Delete question"
              style={{
                background: '#2b1010', color: '#ff4757',
                border: 'none', borderRadius: 6,
                padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700
              }}
            >
              🗑 Del
            </button>
          </div>
        </div>
      </div>

      {/* Options list */}
      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #1e1e1e' }}>
          <p style={{ color: '#555', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '12px 0 8px' }}>
            Options (click label to edit)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {q.options.map((opt, oi) => (
              <OptionRow
                key={opt.id}
                opt={opt}
                idx={oi}
                onEdit={updated => updateOption(opt.id, () => updated)}
                onToggle={() => updateOption(opt.id, o => ({ ...o, hidden: !o.hidden }))}
                onDelete={() => deleteOption(opt.id)}
              />
            ))}
          </div>

          {/* Add option */}
          <button
            onClick={addOption}
            style={{
              marginTop: 10, padding: '8px 16px',
              background: '#1e1e1e', color: '#888',
              border: '1px dashed #333', borderRadius: 8,
              cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              width: '100%', textAlign: 'center'
            }}
          >
            + Add Option
          </button>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   FeedbackTemplateEditor  (main export)
══════════════════════════════════════════════ */
const FeedbackTemplateEditor = ({ initialQuestions, onSave, onClose }) => {
  const [questions, setQuestions] = useState(() =>
    (initialQuestions || []).map(q => ({
      ...q,
      options: (q.options || []).map(o => ({ ...o }))
    }))
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  const updateQ = (id, updater) =>
    setQuestions(prev => prev.map(q => q.id === id ? updater(q) : q));

  const deleteQ = (id) => {
    if (questions.length <= 1) { toast.error('Keep at least 1 question'); return; }
    if (!window.confirm('Delete this question?')) return;
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const moveQ = (idx, dir) => {
    const arr = [...questions];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setQuestions(arr);
  };

  const addQuestion = () => {
    const newQ = {
      id: uid(),
      question: 'New question — click to edit',
      options: [
        { id: uid(), label: 'A. Option one' },
        { id: uid(), label: 'B. Option two' },
        { id: uid(), label: 'C. Option three' },
      ]
    };
    setQuestions(prev => [...prev, newQ]);
    toast.success('New question added at the bottom');
  };

  const handleSave = () => {
    const visible = questions.filter(q => !q.hidden);
    if (visible.length === 0) {
      toast.error('At least one question must be visible');
      return;
    }
    const hasEmptyOpts = questions.some(q =>
      !q.hidden && q.options.filter(o => !o.hidden).length < 2
    );
    if (hasEmptyOpts) {
      toast.error('Each visible question needs at least 2 visible options');
      return;
    }
    onSave(questions);
    onClose();
    toast.success('Template saved! You can now create the cycle.');
  };

  const visibleCount = questions.filter(q => !q.hidden).length;
  const hiddenCount = questions.length - visibleCount;

  /* Preview cycle object */
  const previewCycle = {
    _id: 'preview',
    title: 'Preview — Student View',
    deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
    status: 'active',
    hasSubmitted: false,
    questions: questions
      .filter(q => !q.hidden)
      .map(q => ({
        ...q,
        options: q.options.filter(o => !o.hidden)
      }))
  };

  return (
    <>
      {/* Preview modal */}
      {previewOpen && (
        <>
          <div
            onClick={() => setPreviewOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(6px)', zIndex: 1300
            }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 'min(540px, 96vw)', maxHeight: '90vh',
            background: '#0f0f0f', borderRadius: 20,
            border: '1px solid #ff7b0033',
            boxShadow: '0 24px 80px rgba(0,0,0,0.9)',
            display: 'flex', flexDirection: 'column', zIndex: 1301
          }}>
            <div style={{
              padding: '14px 22px', borderBottom: '1px solid #1e1e1e',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <p style={{ color: '#ff9f44', fontWeight: 700, fontSize: '0.78rem', margin: 0 }}>STUDENT PREVIEW</p>
                <p style={{ color: '#666', fontSize: '0.72rem', margin: 0 }}>
                  {visibleCount} question{visibleCount !== 1 ? 's' : ''} visible to students
                </p>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                style={{ background: '#1e1e1e', border: '1px solid #333', color: '#aaa', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700 }}
              >✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '20px 22px', flex: 1 }}>
              <FeedbackForm cycle={previewCycle} previewMode={true} />
            </div>
          </div>
        </>
      )}

      {/* Main editor overlay */}
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(5px)', zIndex: 1200
      }} onClick={onClose} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 'min(740px, 97vw)', maxHeight: '95vh',
        background: '#121212', borderRadius: 20,
        border: '1px solid #2a2a2a',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column', zIndex: 1201
      }} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #1e1e1e',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexShrink: 0,
          background: 'linear-gradient(135deg, #1a0d00, #121212)'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>✏️ Edit Feedback Questions</h3>
            <p style={{ color: '#777', fontSize: '0.78rem', marginTop: 4 }}>
              {visibleCount} visible &nbsp;·&nbsp;
              <span style={{ color: hiddenCount > 0 ? '#cc0' : '#555' }}>{hiddenCount} hidden</span>
              &nbsp;·&nbsp; {questions.length} total &nbsp;&nbsp;
              <span style={{ color: '#555', fontSize: '0.68rem' }}>Click any label to edit inline</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setPreviewOpen(true)}
              style={{
                padding: '9px 18px', background: '#1a1000',
                color: '#ff9f44', border: '1px solid #ff7b0044',
                borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem'
              }}
            >👁 Preview</button>
            <button
              onClick={onClose}
              style={{ background: '#1e1e1e', border: '1px solid #333', color: '#aaa', borderRadius: 8, padding: '9px 14px', cursor: 'pointer', fontWeight: 700 }}
            >✕</button>
          </div>
        </div>

        {/* ── Scrollable question list ── */}
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {questions.map((q, idx) => (
              <QuestionCard
                key={q.id}
                q={q}
                idx={idx}
                total={questions.length}
                onChange={updated => updateQ(q.id, () => updated)}
                onDelete={() => deleteQ(q.id)}
                onMoveUp={() => moveQ(idx, -1)}
                onMoveDown={() => moveQ(idx, 1)}
              />
            ))}
          </div>

          {/* Add question */}
          <button
            onClick={addQuestion}
            style={{
              marginTop: 16, width: '100%', padding: '14px',
              background: '#1a1a1a',
              color: '#888', border: '2px dashed #2a2a2a',
              borderRadius: 14, cursor: 'pointer',
              fontSize: '0.9rem', fontWeight: 600,
              transition: 'all 0.2s ease'
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#ff7b0055'; e.currentTarget.style.color = '#ff7b00'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#888'; }}
          >
            ＋ Add New Question
          </button>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #1e1e1e',
          display: 'flex', gap: 12, justifyContent: 'flex-end',
          background: '#0d0d0d', flexShrink: 0
        }}>
          <button
            onClick={onClose}
            style={{ padding: '11px 24px', background: '#1e1e1e', color: '#888', border: '1px solid #333', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '11px 28px',
              background: 'linear-gradient(135deg, #ff7b00, #ff9f44)',
              color: '#fff', border: 'none', borderRadius: 10,
              cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem',
              boxShadow: '0 4px 16px rgba(255,123,0,0.35)'
            }}
          >
            ✅ Save Template ({visibleCount} questions)
          </button>
        </div>
      </div>
    </>
  );
};

export default FeedbackTemplateEditor;
