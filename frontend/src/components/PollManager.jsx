import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { socket } from '../socket';

/* ── shared input style ───────────────────────────────────────────────── */
const inp = {
  width: '100%', padding: '10px 13px', background: '#101010',
  border: '1px solid #282828', color: 'white', borderRadius: '9px',
  fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.18s',
};

/* ── small label ─────────────────────────────────────────────────────── */
const Lbl = ({ children, mt }) => (
  <span style={{
    color: '#555', fontSize: '0.72rem', fontWeight: '700',
    letterSpacing: '0.07em', display: 'block', marginBottom: '6px',
    marginTop: mt || 0
  }}>
    {children}
  </span>
);

/* ── section wrapper ─────────────────────────────────────────────────── */
const Sec = ({ children, style }) => (
  <div style={{ marginBottom: '18px', ...style }}>{children}</div>
);

/* ── toggle checkbox ─────────────────────────────────────────────────── */
const Toggle = ({ value, onChange, label, disabled, note }) => (
  <div
    onClick={() => !disabled && onChange(!value)}
    style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '11px 14px', borderRadius: '10px', cursor: disabled ? 'not-allowed' : 'pointer',
      background: value ? '#0d2010' : '#101010',
      border: `1.5px solid ${value ? '#2ed57344' : '#252525'}`,
      opacity: disabled ? 0.5 : 1, transition: 'all 0.18s',
    }}>
    {/* pill toggle */}
    <div style={{
      width: '34px', height: '18px', borderRadius: '9px', flexShrink: 0,
      background: value ? '#2ed573' : '#333', position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: '3px', left: value ? '17px' : '3px',
        width: '12px', height: '12px', borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
      }} />
    </div>
    <span style={{ color: value ? '#b8f5d0' : '#888', fontSize: '0.9rem', flex: 1 }}>{label}</span>
    {note && <span style={{ fontSize: '0.72rem', color: '#ff7b00', background: '#ff7b0018', padding: '2px 7px', borderRadius: '6px' }}>{note}</span>}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════ */
const PollManager = () => {
  const [polls, setPolls] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const DOMAINS = [
    { key: 'morningTea', label: '🍵 Morning Tea / Milk' },
    { key: 'morningEgg', label: '🥚 Morning Egg' },
    { key: 'tiffin', label: '🥪 Tiffin' },
    { key: 'lunch', label: '🍱 Lunch' },
    { key: 'lunchEgg', label: '🥚 Lunch Egg' },
    { key: 'eveningTea', label: '🍵 Evening Tea / Milk' },
    { key: 'snacks', label: '🍟 Snacks' },
    { key: 'dinner', label: '🍽️ Dinner' },
    { key: 'dinnerEgg', label: '🥚 Dinner Egg' },
    { key: 'none', label: 'General / Other' },
  ];

  /* create form */
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [domain, setDomain] = useState('none');
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0];
  });
  const [deadline, setDeadline] = useState(() => {
    const d = new Date(); d.setHours(19, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [options, setOptions] = useState([{ item: '', price: '' }, { item: '', price: '' }]);

  /* edit modal */
  const [editPoll, setEditPoll] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDomain, setEditDomain] = useState('none');
  const [editDate, setEditDate] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editAllowMultiple, setEditAllowMultiple] = useState(false);
  const [editOptions, setEditOptions] = useState([]);

  /* socket + fetch */
  useEffect(() => {
    fetchPolls();
    const handles = {
      pollCreated: (p) => setPolls(prev => [p, ...prev]),
      pollDeleted: ({ pollId }) => setPolls(prev => prev.filter(p => p._id !== pollId)),
      voteUpdated: (p) => setPolls(prev => prev.map(x => x._id === p._id ? p : x)),
      pollUpdated: (p) => setPolls(prev => prev.map(x => x._id === p._id ? p : x)),
    };
    Object.entries(handles).forEach(([ev, fn]) => socket.on(ev, fn));
    return () => Object.entries(handles).forEach(([ev, fn]) => socket.off(ev, fn));
  }, []);

  const fetchPolls = async () => {
    try { const { data } = await api.get('/poll/all'); setPolls(data); }
    catch { console.error('Failed to fetch polls'); }
  };

  /* create */
  const handleCreate = async (e) => {
    e.preventDefault();
    const valid = options.filter(o => o.item.trim() && o.price !== '');
    if (valid.length < 2) { toast.error('At least 2 valid options required'); return; }
    try {
      await api.post('/poll/create', { title, description, date, deadline, options: valid, allowMultiple, domain });
      toast.success('Poll created! 🎉');
      setTitle(''); setDescription(''); setAllowMultiple(false); setDomain('none'); setShowForm(false);
      setOptions([{ item: '', price: '' }, { item: '', price: '' }]);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to create poll'); }
  };

  /* delete */
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this poll?')) return;
    try { await api.delete(`/poll/${id}`); toast.success('Poll deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  /* edit */
  const openEdit = (poll) => {
    setEditPoll(poll);
    setEditTitle(poll.title);
    setEditDescription(poll.description || '');
    setEditDomain(poll.domain || 'none');
    setEditDate(poll.date);
    setEditDeadline(poll.deadline.replace(' ', 'T'));
    setEditAllowMultiple(poll.allowMultiple || false);
    setEditOptions(poll.options.map(o => ({ ...o, price: String(o.price) })));
  };

  const handleEditSave = async () => {
    const validOpts = editOptions.filter(o => o.item.trim() && o.price !== '');
    if (validOpts.length < 2) { toast.error('At least 2 options required'); return; }
    try {
      await api.put(`/poll/${editPoll._id}`, {
        title: editTitle, description: editDescription,
        domain: editDomain,
        date: editDate, deadline: editDeadline,
        allowMultiple: editAllowMultiple,
        options: editOptions.filter(o => o.item.trim()),
      });
      toast.success('Poll updated!');
      setEditPoll(null);
    } catch (e) { toast.error(e.response?.data?.message || 'Update failed'); }
  };

  const hasVotes = editPoll && (editPoll.votedBy?.length || 0) > 0;

  return (
    <div>
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>🗳️ Poll Management</h2>
          <p style={{ color: '#555', fontSize: '0.85rem', marginTop: '4px' }}>
            Create polls, track student votes, plan special menus
          </p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{
            padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: showForm ? '#1e1e1e' : 'var(--primary-color)',
            color: showForm ? '#888' : 'white', fontWeight: 'bold', fontSize: '0.92rem',
            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s',
          }}>
          {showForm ? '✕ Cancel' : '＋ New Poll'}
        </button>
      </div>

      {/* ── Create Form (collapsible) ─────────────────────────────────── */}
      {showForm && (
        <div style={{
          background: '#111', border: '1px solid #1e1e1e', borderRadius: '16px',
          padding: '24px', marginBottom: '28px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}>
          <h3 style={{ margin: '0 0 22px', fontSize: '1rem', color: '#ccc' }}>📋 New Poll Details</h3>
          <form onSubmit={handleCreate}>

            {/* Title + Description */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <Sec>
                <Lbl>POLL TITLE *</Lbl>
                <input style={inp} value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Ugadi Festival Special" required />
              </Sec>
              <Sec>
                <Lbl>RELATED DOMAIN (for vote weight) *</Lbl>
                <select style={inp} value={domain} onChange={e => setDomain(e.target.value)}>
                  {DOMAINS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </Sec>
              <Sec>
                <Lbl>DESCRIPTION</Lbl>
                <input style={inp} value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Optional note" />
              </Sec>
            </div>

            {/* Date + Deadline */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <Sec>
                <Lbl>MENU DATE *</Lbl>
                <input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} required />
              </Sec>
              <Sec>
                <Lbl>VOTING DEADLINE *</Lbl>
                <input type="datetime-local" style={inp} value={deadline} onChange={e => setDeadline(e.target.value)} required />
              </Sec>
              <Sec style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <Toggle value={allowMultiple} onChange={setAllowMultiple} label="Allow multi-select" />
              </Sec>
            </div>

            {/* Food Options */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <Lbl>FOOD OPTIONS (min 2) *</Lbl>
                <button type="button" onClick={() => setOptions([...options, { item: '', price: '' }])}
                  style={{ background: 'transparent', border: '1px solid #333', color: '#777', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' }}>
                  + Add Option
                </button>
              </div>
              {/* header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '20px 1fr 90px 28px', gap: '8px', padding: '4px 6px', marginBottom: '4px' }}>
                <span />
                <span style={{ color: '#444', fontSize: '0.72rem', fontWeight: '600', letterSpacing: '0.05em' }}>ITEM NAME</span>
                <span style={{ color: '#444', fontSize: '0.72rem', fontWeight: '600', letterSpacing: '0.05em', textAlign: 'right' }}>PRICE (₹)</span>
                <span />
              </div>
              <div className="mobile-responsive-row" style={{ background: '#0a0a0a', borderRadius: '12px', border: '1px solid #1a1a1a', overflow: 'auto' }}>
                {options.map((opt, idx) => (
                  <div key={idx} style={{
                    display: 'grid', gridTemplateColumns: '20px 1fr 90px 28px', gap: '8px',
                    alignItems: 'center', padding: '8px 10px',
                    borderBottom: idx < options.length - 1 ? '1px solid #141414' : 'none',
                  }}>
                    <span style={{ color: '#3a3a3a', fontSize: '0.8rem', textAlign: 'center' }}>{idx + 1}</span>
                    <input type="text" value={opt.item}
                      onChange={e => { const n = [...options]; n[idx].item = e.target.value; setOptions(n); }}
                      placeholder="e.g. Biryani"
                      style={{ ...inp, padding: '7px 10px' }} />
                    <input type="number" value={opt.price} min="0"
                      onChange={e => { const n = [...options]; n[idx].price = e.target.value; setOptions(n); }}
                      placeholder="0"
                      style={{ ...inp, padding: '7px 8px', color: '#2ed573', textAlign: 'right' }} />
                    {options.length > 2 ? (
                      <button type="button" onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', color: '#ff475788', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>×</button>
                    ) : <span />}
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" style={{
              width: '100%', padding: '13px', background: 'var(--primary-color)',
              border: 'none', color: 'white', borderRadius: '11px',
              fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', letterSpacing: '0.3px',
            }}>
              🚀 Publish Poll
            </button>
          </form>
        </div>
      )}

      {/* ── Polls Grid ────────────────────────────────────────────────── */}
      {polls.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#111', borderRadius: '16px', color: '#444' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>🗳️</div>
          <p style={{ fontSize: '1rem' }}>No polls yet. Click <strong style={{ color: '#ccc' }}>＋ New Poll</strong> to create one.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {polls.map(poll => {
            const total = poll.options.reduce((a, o) => a + o.votes, 0);
            const topVotes = Math.max(...poll.options.map(o => o.votes));
            const isActive = poll.status === 'active';
            const participantCount = poll.votedBy?.length || 0;
            const sortedOpts = [...poll.options].sort((a, b) => b.votes - a.votes);

            return (
              <div key={poll._id} style={{
                background: '#111', border: '1px solid #1e1e1e',
                borderRadius: '16px', overflow: 'hidden',
                borderTop: `3px solid ${isActive ? '#2ed573' : '#ff4757'}`,
                display: 'flex', flexDirection: 'column',
              }}>
                {/* Card header */}
                <div style={{ padding: '18px 20px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        background: isActive ? '#2ed57318' : '#ff475718',
                        color: isActive ? '#2ed573' : '#ff4757',
                        padding: '2px 9px', borderRadius: '20px',
                        fontSize: '0.7rem', fontWeight: '700', marginBottom: '8px',
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                        {isActive ? 'ACTIVE' : 'CLOSED'}
                        {poll.allowMultiple && <span style={{ marginLeft: '6px', color: '#888' }}>· Multi-select</span>}
                      </span>
                      <h3 style={{ margin: 0, fontSize: '1rem', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {poll.title}
                      </h3>
                      <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                        🔗 Domain: {DOMAINS.find(d => d.key === poll.domain)?.label || 'General'}
                      </div>
                      {poll.description && (
                        <p style={{ color: '#555', fontSize: '0.8rem', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {poll.description}
                        </p>
                      )}
                    </div>
                    {/* actions */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => openEdit(poll)}
                        style={{ padding: '6px 11px', background: '#1a2535', border: '1px solid #1e3a5f', color: '#4da8ff', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}>
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDelete(poll._id)}
                        style={{ padding: '6px 11px', background: '#25121a', border: '1px solid #5f1e2a', color: '#ff6b7a', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}>
                        🗑 Del
                      </button>
                    </div>
                  </div>

                  {/* meta row */}
                  <div style={{ display: 'flex', gap: '14px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#444', fontSize: '0.76rem' }}>
                      📅 <span style={{ color: '#666' }}>{new Date(poll.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    </span>
                    <span style={{ color: '#444', fontSize: '0.76rem' }}>
                      ⏰ <span style={{ color: isActive ? '#f39c12' : '#555' }}>{poll.deadline?.replace('T', ' ')}</span>
                    </span>
                    <span style={{ color: '#444', fontSize: '0.76rem' }}>
                      👥 <span style={{ color: '#666' }}>{participantCount} voter{participantCount !== 1 ? 's' : ''}</span>
                    </span>
                  </div>
                </div>

                {/* divider */}
                <div style={{ borderTop: '1px solid #181818', margin: '0 20px' }} />

                {/* Options result bars */}
                <div style={{ padding: '14px 20px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {total === 0 && (
                    <p style={{ color: '#333', fontSize: '0.82rem', margin: 0, textAlign: 'center', padding: '10px 0' }}>No votes yet</p>
                  )}
                  {sortedOpts.map((opt, i) => {
                    const pct = total === 0 ? 0 : Math.round((opt.votes / total) * 100);
                    const isTop = opt.votes === topVotes && opt.votes > 0;
                    return (
                      <div key={opt.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                            {isTop && i === 0 && <span style={{ fontSize: '0.75rem' }}>🥇</span>}
                            <span style={{
                              fontSize: '0.88rem', color: isTop ? '#e0ffe0' : '#909090',
                              fontWeight: isTop ? '600' : '400',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px',
                            }}>{opt.item}</span>
                            <span style={{ color: '#333', fontSize: '0.75rem', flexShrink: 0 }}>₹{opt.price}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                            <span style={{ color: isTop ? '#2ed573' : '#555', fontWeight: 'bold', fontSize: '0.88rem' }}>{opt.votes}</span>
                            <span style={{ color: '#333', fontSize: '0.75rem' }}>{pct}%</span>
                          </div>
                        </div>
                        <div style={{ height: '5px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%', borderRadius: '3px',
                            background: isTop ? 'linear-gradient(90deg, #2ed573, #22c161)' : 'linear-gradient(90deg, #2a3a5a, #1e3050)',
                            transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────── */}
      {editPoll && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000000cc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }} onClick={e => e.target === e.currentTarget && setEditPoll(null)}>
          <div style={{
            background: '#111', border: '1px solid #242424', borderRadius: '18px',
            width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 80px rgba(0,0,0,0.7)',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px', borderBottom: '1px solid #1e1e1e' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>✏️ Edit Poll</h3>
                <p style={{ color: '#555', fontSize: '0.78rem', margin: '3px 0 0' }}>
                  {hasVotes ? `${editPoll.votedBy?.length} vote${editPoll.votedBy?.length !== 1 ? 's' : ''} cast · Options names/prices editable` : 'No votes yet — all fields editable'}
                </p>
              </div>
              <button onClick={() => setEditPoll(null)}
                style={{ background: '#1e1e1e', border: 'none', color: '#777', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>

            <div style={{ padding: '22px 24px' }}>
              {/* Title + Description */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Sec>
                  <Lbl>POLL TITLE</Lbl>
                  <input style={inp} value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                </Sec>
                <Sec>
                  <Lbl>DOMAIN</Lbl>
                  <select style={inp} value={editDomain} onChange={e => setEditDomain(e.target.value)}>
                    {DOMAINS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                </Sec>
              </div>
              <Sec>
                <Lbl>DESCRIPTION</Lbl>
                <textarea style={{ ...inp, minHeight: '56px', resize: 'vertical' }} value={editDescription} onChange={e => setEditDescription(e.target.value)} />
              </Sec>

              {/* Date + Deadline */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <Sec>
                  <Lbl>MENU DATE</Lbl>
                  <input type="date" style={inp} value={editDate} onChange={e => setEditDate(e.target.value)} />
                </Sec>
                <Sec>
                  <Lbl>DEADLINE</Lbl>
                  <input type="datetime-local" style={inp} value={editDeadline} onChange={e => setEditDeadline(e.target.value)} />
                </Sec>
              </div>

              {/* Toggle */}
              <Sec>
                <Toggle value={editAllowMultiple} onChange={setEditAllowMultiple}
                  disabled={hasVotes} label="Allow multiple selections"
                  note={hasVotes ? '🔒 locked' : null} />
              </Sec>

              {/* Options table */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <Lbl>FOOD OPTIONS</Lbl>
                  {!hasVotes && (
                    <button type="button" onClick={() => setEditOptions(prev => [...prev, { item: '', price: '', votes: 0, id: '' }])}
                      style={{ background: 'transparent', border: '1px solid #282828', color: '#666', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                      + Add
                    </button>
                  )}
                </div>

                {/* column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr 80px 50px 26px', gap: '6px', padding: '4px 8px', marginBottom: '4px' }}>
                  <span />
                  <span style={{ color: '#3a3a3a', fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.05em' }}>ITEM</span>
                  <span style={{ color: '#3a3a3a', fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.05em', textAlign: 'right' }}>PRICE</span>
                  <span style={{ color: '#3a3a3a', fontSize: '0.7rem', fontWeight: '600', textAlign: 'center' }}>VOTES</span>
                  <span />
                </div>

                <div className="mobile-responsive-row" style={{ background: '#0a0a0a', borderRadius: '11px', border: '1px solid #1a1a1a', overflow: 'auto' }}>
                  {editOptions.map((opt, idx) => (
                    <div key={idx} style={{
                      display: 'grid', gridTemplateColumns: '22px 1fr 80px 50px 26px',
                      gap: '6px', alignItems: 'center', padding: '8px 10px',
                      borderBottom: idx < editOptions.length - 1 ? '1px solid #141414' : 'none',
                    }}>
                      <span style={{ color: '#3a3a3a', fontSize: '0.78rem', textAlign: 'center' }}>{idx + 1}</span>
                      <input type="text" value={opt.item}
                        onChange={e => { const n = [...editOptions]; n[idx].item = e.target.value; setEditOptions(n); }}
                        placeholder="Item name"
                        style={{ ...inp, padding: '7px 9px', fontSize: '0.85rem' }} />
                      <input type="number" value={opt.price} min="0"
                        onChange={e => { const n = [...editOptions]; n[idx].price = e.target.value; setEditOptions(n); }}
                        placeholder="0"
                        style={{ ...inp, padding: '7px 7px', color: '#2ed573', textAlign: 'right', fontSize: '0.85rem' }} />
                      <span style={{ color: hasVotes ? '#666' : '#282828', fontSize: '0.88rem', textAlign: 'center', fontWeight: '700' }}>
                        {opt.votes ?? 0}
                      </span>
                      {!hasVotes && editOptions.length > 2 ? (
                        <button type="button" onClick={() => setEditOptions(prev => prev.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: '#ff475777', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, textAlign: 'center', padding: 0 }}>×</button>
                      ) : <span />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal footer */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setEditPoll(null)}
                  style={{ flex: 1, padding: '12px', background: '#1a1a1a', border: '1px solid #282828', color: '#888', borderRadius: '10px', cursor: 'pointer', fontSize: '0.92rem' }}>
                  Cancel
                </button>
                <button onClick={handleEditSave}
                  style={{ flex: 2, padding: '12px', background: 'var(--primary-color)', border: 'none', color: 'white', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.92rem' }}>
                  💾 Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PollManager;
