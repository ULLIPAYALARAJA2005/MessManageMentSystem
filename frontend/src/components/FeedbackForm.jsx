import React, { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

/* ─── Success overlay ─── */
const SuccessOverlay = ({ onDone }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 2000,
    background: 'rgba(0,0,0,0.88)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    animation: 'fbFadeIn 0.3s ease'
  }}>
    <div style={{
      background: '#1e1e1e', borderRadius: 24, padding: '50px 40px',
      textAlign: 'center', maxWidth: 340,
      border: '1px solid #2ed57344',
      boxShadow: '0 0 60px rgba(46,213,115,0.2)'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: 16, animation: 'fbPopIn 0.4s cubic-bezier(0.18,0.89,0.32,1.28)' }}>🎉</div>
      <h2 style={{ color: '#2ed573', marginBottom: 10, fontSize: '1.4rem' }}>Feedback Submitted!</h2>
      <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.6 }}>
        Thank you for helping us improve the mess experience. Your response has been recorded.
      </p>
      <button
        onClick={onDone}
        style={{
          marginTop: 24, padding: '14px 40px',
          background: '#2ed573', color: '#000',
          border: 'none', borderRadius: 12,
          fontWeight: 700, fontSize: '1rem', cursor: 'pointer'
        }}
      >
        Done
      </button>
    </div>
  </div>
);

/* ─── Inline Option List ─── */
const InlineOptions = ({ options, selected, onSelect, disabled }) => (
  <div style={{
    marginTop: 14,
    display: 'flex', flexDirection: 'column', gap: 8,
    animation: 'fbSlideDown 0.22s ease'
  }}>
    {options.map(opt => {
      const isSelected = selected === opt.id;
      return (
        <button
          key={opt.id}
          onClick={() => !disabled && onSelect(opt.id)}
          disabled={disabled}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '13px 16px',
            background: isSelected ? 'rgba(255,123,0,0.13)' : '#111',
            border: `1.5px solid ${isSelected ? '#ff7b00' : '#2a2a2a'}`,
            borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
            transition: 'all 0.16s ease',
            textAlign: 'left', width: '100%',
            outline: 'none'
          }}
        >
          {/* Radio circle */}
          <div style={{
            width: 18, height: 18, flexShrink: 0,
            borderRadius: '50%',
            border: `2px solid ${isSelected ? '#ff7b00' : '#444'}`,
            background: isSelected ? '#ff7b00' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.16s ease',
            boxShadow: isSelected ? '0 0 6px rgba(255,123,0,0.55)' : 'none'
          }}>
            {isSelected && (
              <div style={{ width: 6, height: 6, background: 'white', borderRadius: '50%' }} />
            )}
          </div>
          <span style={{
            color: isSelected ? '#fff' : '#aaa',
            fontSize: '0.88rem',
            fontWeight: isSelected ? 600 : 400,
            lineHeight: 1.4
          }}>
            {opt.label}
          </span>
        </button>
      );
    })}
  </div>
);

/* ─── Main FeedbackForm ─── */
const FeedbackForm = ({ cycle, onSubmitted, previewMode = false }) => {
  const [answers, setAnswers] = useState({});
  const [comments, setComments] = useState('');
  const [openQ, setOpenQ] = useState(null);   // currently expanded question id
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const questions = cycle?.questions || [];

  const deadline = cycle?.deadline ? new Date(cycle.deadline) : null;
  const now = new Date();
  const isPastDeadline = deadline && now > deadline;
  const hasSubmitted = cycle?.hasSubmitted;
  // In preview mode, admin can click options but cannot submit
  const isDisabled = !previewMode && (isPastDeadline || hasSubmitted);

  const isComplete = questions.every(q => answers[q.id]);
  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;

  const getSelectedLabel = (qid, options) => {
    const sel = answers[qid];
    if (!sel) return null;
    return options.find(o => o.id === sel)?.label || null;
  };

  const handleSelect = (qid, optId) => {
    setAnswers(prev => ({ ...prev, [qid]: optId }));
    // Auto-close current question and open the next one
    const idx = questions.findIndex(q => q.id === qid);
    const next = questions[idx + 1];
    if (next && !answers[next.id]) {
      setOpenQ(next.id);
    } else {
      setOpenQ(null);
    }
  };

  const handleSubmit = async () => {
    if (!isComplete) {
      toast.error('Please answer all questions before submitting');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/feedback/submit', { cycleId: cycle._id, answers, comments });
      setShowSuccess(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete your feedback? You will have to fill it out again.")) return;
    setSubmitting(true);
    try {
      await api.delete('/feedback/submit', { data: { cycleId: cycle._id } });
      toast.success('Your response was deleted.');
      // Trick parent component to refresh, it'll fetch the active cycle again and notice `hasSubmitted` is false
      onSubmitted && onSubmitted();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessDone = () => {
    setShowSuccess(false);
    onSubmitted && onSubmitted();
  };

  return (
    <>
      <style>{`
        @keyframes fbFadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes fbPopIn {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes fbSlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0   rgba(255,123,0,0.4); }
          70%  { box-shadow: 0 0 0 10px rgba(255,123,0,0);  }
          100% { box-shadow: 0 0 0 0   rgba(255,123,0,0);  }
        }
        .fb-q-card { transition: border-color 0.18s ease, background 0.18s ease; }
        .fb-q-card:hover:not(.fb-disabled) { border-color: #ff7b0055 !important; }
        .fb-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(255,123,0,0.45) !important;
        }
        .fb-submit-btn:disabled { cursor: not-allowed; opacity: 0.5; }
      `}</style>

      {showSuccess && <SuccessOverlay onDone={handleSuccessDone} />}

      {/* ── Admin Preview Banner ── */}
      {previewMode && (
        <div style={{
          background: 'linear-gradient(135deg, #261800, #1a1000)',
          border: '1.5px dashed #ff7b0077',
          borderRadius: 12, padding: '12px 18px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <span style={{ fontSize: '1.3rem' }}>👁</span>
          <div>
            <p style={{ color: '#ff9f44', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>ADMIN PREVIEW MODE</p>
            <p style={{ color: '#888', fontSize: '0.75rem', marginTop: 2 }}>This is exactly what students see. You can tap options but cannot submit.</p>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0d00, #261800)',
        borderRadius: 14, padding: '22px 24px', marginBottom: 20,
        border: '1px solid #ff7b0033', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: '5rem', opacity: 0.06, pointerEvents: 'none' }}>📋</div>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{
              background: isDisabled ? '#ff475722' : '#2ed57322',
              color: isDisabled ? '#ff4757' : '#2ed573',
              padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700
            }}>
              {hasSubmitted ? '✅ Submitted' : isPastDeadline ? '🔒 Closed' : '🟢 Open'}
            </span>
            <h2 style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>{cycle?.title || 'Weekly Feedback'}</h2>
          </div>

          {deadline && (
            <p style={{ color: isPastDeadline ? '#ff4757' : '#888', fontSize: '0.82rem', margin: 0 }}>
              ⏰ Deadline:&nbsp;
              <strong style={{ color: isPastDeadline ? '#ff4757' : '#ff7b00' }}>
                {deadline.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </strong>
            </p>
          )}

          {/* Progress bar */}
          {!isDisabled && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#888', fontSize: '0.78rem' }}>{answeredCount} of {questions.length} answered</span>
                <span style={{ color: '#ff7b00', fontSize: '0.78rem', fontWeight: 700 }}>{progress}%</span>
              </div>
              <div style={{ background: '#2a2a2a', borderRadius: 6, height: 7, overflow: 'hidden' }}>
                <div style={{
                  width: `${progress}%`, height: '100%',
                  background: 'linear-gradient(90deg, #ff7b00, #ff9f44)',
                  borderRadius: 6, transition: 'width 0.4s ease'
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Already submitted banner ── */}
      {hasSubmitted && (
        <div style={{
          background: '#0d2b1a', border: '1px solid #2ed57344',
          borderRadius: 12, padding: '20px 24px', marginBottom: 20, textAlign: 'center'
        }}>
          <p style={{ fontSize: '1.8rem', marginBottom: 8 }}>✅</p>
          <h3 style={{ color: '#2ed573', margin: '0 0 6px 0' }}>Already Submitted</h3>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>
            You've already submitted feedback for this cycle. Check back next week!
          </p>

          {!isPastDeadline && !previewMode && (
             <button
               onClick={handleDelete}
               disabled={submitting}
               style={{
                 marginTop: 16, padding: '8px 16px', background: '#2b1010',
                 color: '#ff4757', border: '1px solid #ff475755', borderRadius: 8,
                 cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                 opacity: submitting ? 0.6 : 1
               }}
             >
               {submitting ? '⏳ Deleting...' : '🗑️ Delete & Retake Feedback'}
             </button>
          )}
        </div>
      )}

      {isPastDeadline && !hasSubmitted && (
        <div style={{
          background: '#2b0d0d', border: '1px solid #ff475744',
          borderRadius: 12, padding: '20px 24px', marginBottom: 20, textAlign: 'center'
        }}>
          <p style={{ fontSize: '1.8rem', marginBottom: 8 }}>🔒</p>
          <h3 style={{ color: '#ff4757' }}>Feedback Closed</h3>
          <p style={{ color: '#888', fontSize: '0.85rem', marginTop: 6 }}>The deadline for this feedback cycle has passed.</p>
        </div>
      )}

      {/* ── Questions ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {questions.map((q, idx) => {
          const selectedLabel = getSelectedLabel(q.id, q.options);
          const isAnswered = !!selectedLabel;
          const isOpen = openQ === q.id && !isDisabled;

          return (
            <div
              key={q.id}
              className={`fb-q-card${isDisabled ? ' fb-disabled' : ''}`}
              style={{
                background: isAnswered ? 'rgba(255,123,0,0.06)' : '#1a1a1a',
                border: `1.5px solid ${isOpen ? '#ff7b00' : isAnswered ? '#ff7b0044' : '#252525'}`,
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              {/* Question header — tap to expand/collapse */}
              <div
                onClick={() => !isDisabled && setOpenQ(isOpen ? null : q.id)}
                style={{
                  padding: '16px 18px',
                  cursor: isDisabled ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{
                    color: '#777', fontSize: '0.7rem', textTransform: 'uppercase',
                    letterSpacing: '0.5px', marginBottom: 5
                  }}>
                    Question {idx + 1} of {questions.length}
                  </p>
                  <h4 style={{
                    color: isAnswered ? '#fff' : '#ccc',
                    fontSize: '0.93rem', lineHeight: 1.45,
                    fontWeight: isAnswered ? 600 : 400, margin: 0
                  }}>
                    {q.question}
                  </h4>

                  {/* Selected answer preview */}
                  {isAnswered && !isOpen && (
                    <div style={{
                      marginTop: 9, padding: '7px 12px',
                      background: 'rgba(255,123,0,0.1)',
                      borderRadius: 8, borderLeft: '3px solid #ff7b00',
                      display: 'inline-block'
                    }}>
                      <p style={{ color: '#ff9f44', fontSize: '0.83rem', fontWeight: 600, margin: 0 }}>
                        {selectedLabel}
                      </p>
                    </div>
                  )}

                  {!isAnswered && !isOpen && !isDisabled && (
                    <p style={{ color: '#444', fontSize: '0.78rem', marginTop: 6 }}>Tap to answer</p>
                  )}
                </div>

                {/* Status badge / chevron */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: isAnswered ? '#ff7b00' : '#252525',
                    color: isAnswered ? '#fff' : '#555',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700,
                    transition: 'all 0.2s ease'
                  }}>
                    {isAnswered ? '✓' : idx + 1}
                  </div>
                  {!isDisabled && (
                    <span style={{
                      color: '#555', fontSize: '0.8rem',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      display: 'block'
                    }}>▼</span>
                  )}
                </div>
              </div>

              {/* Inline options — only shown when expanded */}
              {isOpen && (
                <div style={{ padding: '0 18px 18px' }}>
                  <InlineOptions
                    options={q.options}
                    selected={answers[q.id] || null}
                    onSelect={(optId) => handleSelect(q.id, optId)}
                    disabled={isDisabled}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* ── Comments ── */}
        <div style={{
          background: '#1a1a1a', border: '1.5px solid #252525',
          borderRadius: 14, padding: '16px 18px', marginTop: 4
        }}>
          <h4 style={{ color: '#ccc', fontSize: '0.92rem', marginBottom: 10 }}>
            📝 Additional Comments&nbsp;
            <span style={{ color: '#444', fontWeight: 400 }}>(Optional)</span>
          </h4>
          <textarea
            value={comments}
            onChange={e => setComments(e.target.value)}
            disabled={isDisabled}
            placeholder="Any specific feedback, suggestions, or concerns..."
            rows={3}
            style={{
              width: '100%', padding: '12px',
              background: '#111', color: '#ddd',
              border: '1px solid #2a2a2a', borderRadius: 10,
              resize: 'vertical', fontSize: '0.88rem', lineHeight: 1.5,
              outline: 'none', opacity: isDisabled ? 0.5 : 1,
              fontFamily: 'Inter, sans-serif'
            }}
          />
        </div>

        {/* ── Submit button ── */}
        {previewMode ? (
          <div style={{
            width: '100%', padding: '16px',
            background: '#1a1000',
            border: '1.5px dashed #ff7b0055',
            borderRadius: 14, textAlign: 'center', marginTop: 4
          }}>
            <p style={{ color: '#ff7b0099', fontWeight: 700, fontSize: '0.88rem', margin: 0 }}>
              🚫 Submit is disabled in Admin Preview Mode
            </p>
          </div>
        ) : !isDisabled && (
          <button
            className="fb-submit-btn"
            onClick={handleSubmit}
            disabled={submitting || !isComplete}
            style={{
              width: '100%', padding: '18px',
              background: isComplete
                ? 'linear-gradient(135deg, #ff7b00, #ff9f44)'
                : '#222',
              color: isComplete ? '#fff' : '#444',
              border: `1.5px solid ${isComplete ? 'transparent' : '#2a2a2a'}`,
              borderRadius: 14,
              fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
              boxShadow: isComplete ? '0 4px 20px rgba(255,123,0,0.3)' : 'none',
              transition: 'all 0.2s ease',
              animation: isComplete && !submitting ? 'pulseRing 2s infinite' : 'none',
              marginTop: 4
            }}
          >
            {submitting
              ? '⏳ Submitting...'
              : isComplete
                ? '✅ Submit Feedback'
                : `Answer ${questions.length - answeredCount} more question${questions.length - answeredCount !== 1 ? 's' : ''} to submit`}
          </button>
        )}
      </div>
    </>
  );
};

export default FeedbackForm;
