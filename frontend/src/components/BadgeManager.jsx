import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { FaAward, FaSearch, FaChevronRight, FaInfoCircle, FaCheckCircle } from 'react-icons/fa';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOMAINS = [
  { key: 'morningTea', label: '🍵 Morning Tea / Milk' },
  { key: 'morningEgg', label: '🥚 Morning Egg' },
  { key: 'tiffin',     label: '🥪 Tiffin' },
  { key: 'lunch',      label: '🍱 Lunch' },
  { key: 'lunchEgg',   label: '🥚 Lunch Egg' },
  { key: 'eveningTea', label: '🍵 Evening Tea / Milk' },
  { key: 'snacks',     label: '🍟 Snacks' },
  { key: 'dinner',     label: '🍽️ Dinner' },
  { key: 'dinnerEgg',  label: '🥚 Dinner Egg' },
];

const BADGE_META = {
  none:    { color: '#444',    label: 'None',    icon: '—',  glow: '' },
  silver:  { color: '#c0c0c0', label: 'Silver',  icon: '🥈', glow: '#c0c0c066' },
  gold:    { color: '#ffd700', label: 'Gold',    icon: '🥇', glow: '#ffd70066' },
  diamond: { color: '#b9f2ff', label: 'Diamond', icon: '💎', glow: '#b9f2ff66' },
};

const THRESHOLDS = { none: 0, silver: 50, gold: 100, diamond: 200 };

// ─── Small Components ─────────────────────────────────────────────────────────

export const BadgeIcon = ({ badge, size = 18 }) => {
  const meta = BADGE_META[badge] || BADGE_META.none;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size + 12, height: size + 12, borderRadius: '50%',
      background: `${meta.color}15`, border: `2px solid ${meta.color}`,
      color: meta.color, fontSize: size,
      boxShadow: badge === 'diamond' ? `0 0 12px ${meta.glow}` : 'none'
    }}>
      <FaAward />
    </div>
  );
};

const DomainBadgePill = ({ badge }) => {
  const meta = BADGE_META[badge] || BADGE_META.none;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 9px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700',
      background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}55`,
    }}>
      {meta.icon} {meta.label}
    </span>
  );
};

const ProgressBar = ({ count, label }) => {
  const pct = Math.min((count / THRESHOLDS.diamond) * 100, 100);
  const tier = count >= THRESHOLDS.diamond ? 'diamond' : count >= THRESHOLDS.gold ? 'gold' : count >= THRESHOLDS.silver ? 'silver' : 'none';
  const meta = BADGE_META[tier];
  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#777', marginBottom: '3px' }}>
        <span>{label}</span>
        <span style={{ color: meta.color }}>{count} bookings</span>
      </div>
      <div style={{ height: '5px', background: '#111', borderRadius: '3px' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: '3px', background: meta.color, transition: '0.6s' }} />
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const BadgeManager = () => {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  // Rules Configuration State
  const [rules, setRules] = useState({});
  const [isEditingRules, setIsEditingRules] = useState(false);

  useEffect(() => { fetchStudents(); fetchRules(); }, []);

  const fetchRules = async () => {
    try {
      const { data } = await api.get('/badge/rules');
      setRules(data);
    } catch (err) { toast.error("Failed to load badge rules"); }
  };

  const handleSaveRules = async () => {
    try {
      await api.post('/badge/rules/update', { rules });
      toast.success("Rules strictly enforced! Badges assigned.");
      setIsEditingRules(false);
      fetchStudents();
      if (selected) openDetails(selected.email);
    } catch { toast.error("Failed to save rules"); }
  };

  const handleRecalculate = async () => {
    try {
      await api.post('/badge/recalculate');
      toast.success("Recalculation complete.");
      fetchStudents();
    } catch { toast.error("Failed to recalculate"); }
  };

  const handleRuleChange = (domain, tier, val) => {
    setRules(prev => ({ ...prev, [domain]: { ...prev[domain], [tier]: Number(val) } }));
  };

  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/badge/students');
      setStudents(data);
    } catch { toast.error("Failed to load students"); }
    finally { setLoading(false); }
  };

  const openDetails = async (email) => {
    try {
      const { data } = await api.get(`/badge/student/${email}`);
      setSelected(data);
    } catch { toast.error("Failed to load student details"); }
  };

  const handleAssign = async (email, domain, badge) => {
    try {
      await api.post('/badge/assign', { email, domain, badge });
      toast.success(`${BADGE_META[badge].label} badge set for ${domain === 'all' ? 'all domains' : domain}!`);
      // Refresh detail view
      const { data } = await api.get(`/badge/student/${email}`);
      setSelected(data);
      fetchStudents();
    } catch { toast.error("Assignment failed"); }
  };

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    const matchBadge = filter === 'all' || s.badge === filter || (s.domainBadges && Object.values(s.domainBadges).includes(filter));
    return matchSearch && matchBadge;
  }).sort((a, b) => b.totalBookings - a.totalBookings);

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#555' }}>Loading badge registry…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* ── Badge Rules Configuration Table ── */}
      <div style={{ background: '#141414', borderRadius: '16px', border: '1px solid #222', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>⚙️ Badge Rules Configuration (Auto-Assign)</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" onClick={handleRecalculate} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>🔄 Force Recalculate</button>
            {isEditingRules ? (
              <button className="btn-primary" onClick={handleSaveRules} style={{ padding: '6px 15px', background: 'var(--success-color)' }}>✅ Save & Apply</button>
            ) : (
              <button className="btn-primary" onClick={() => setIsEditingRules(true)} style={{ padding: '6px 15px' }}>✏️ Edit Thresholds</button>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: '#111', color: '#888' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Section</th>
                <th style={{ padding: '12px', textAlign: 'center', color: BADGE_META.silver.color }}>🥈 Silver</th>
                <th style={{ padding: '12px', textAlign: 'center', color: BADGE_META.gold.color }}>🥇 Gold</th>
                <th style={{ padding: '12px', textAlign: 'center', color: BADGE_META.diamond.color }}>💎 Diamond</th>
              </tr>
            </thead>
            <tbody>
              {DOMAINS.map(d => (
                <tr key={d.key} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '12px' }}>{d.label}</td>
                  {['silver', 'gold', 'diamond'].map(tier => (
                    <td key={tier} style={{ padding: '12px', textAlign: 'center' }}>
                      {isEditingRules ? (
                        <input 
                          type="number" min="0" 
                          value={rules[d.key]?.[tier] || ''} 
                          onChange={(e) => handleRuleChange(d.key, tier, e.target.value)}
                          style={{ width: '60px', padding: '5px', background: '#222', border: '1px solid #444', color: 'white', textAlign: 'center', borderRadius: '4px' }}
                        />
                      ) : (
                        <span style={{ fontWeight: 'bold' }}>{rules[d.key]?.[tier] || 0}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '22px', alignItems: 'start' }}>

      {/* ── Student List ── */}
      <div style={{ background: '#141414', borderRadius: '16px', border: '1px solid #222', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0 }}>👥 Student Badge Registry</h3>
            <span style={{ fontSize: '0.8rem', color: '#555' }}>{filteredStudents.length} students</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name / ID / email…"
                style={{ width: '100%', padding: '10px 12px 10px 38px', background: '#0a0a0a', border: '1px solid #2a2a2a', color: 'white', borderRadius: '9px', outline: 'none', fontSize: '0.875rem' }} />
            </div>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              style={{ padding: '0 14px', background: '#0a0a0a', border: '1px solid #2a2a2a', color: 'white', borderRadius: '9px', outline: 'none', fontSize: '0.85rem' }}>
              <option value="all">All</option>
              <option value="none">No Badge</option>
              <option value="silver">🥈 Silver</option>
              <option value="gold">🥇 Gold</option>
              <option value="diamond">💎 Diamond</option>
            </select>
          </div>
        </div>

        <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
          {filteredStudents.map(s => {
            const domainBadges = s.domainBadges || {};
            const badgeCounts = { silver: 0, gold: 0, diamond: 0 };
            Object.values(domainBadges).forEach(b => { if (b !== 'none') badgeCounts[b] = (badgeCounts[b] || 0) + 1; });
            return (
              <div key={s.id} onClick={() => openDetails(s.email)}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: '1px solid #191919', cursor: 'pointer', transition: '0.2s', background: selected?.id === s.id ? '#1e1e1e' : 'transparent' }}>
                <BadgeIcon badge={s.badge} size={15} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '2px' }}>ID: {s.studentId}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {badgeCounts.diamond > 0 && <span style={{ fontSize: '0.72rem', background: '#b9f2ff20', color: '#b9f2ff', padding: '2px 7px', borderRadius: '10px' }}>💎×{badgeCounts.diamond}</span>}
                  {badgeCounts.gold    > 0 && <span style={{ fontSize: '0.72rem', background: '#ffd70020', color: '#ffd700', padding: '2px 7px', borderRadius: '10px' }}>🥇×{badgeCounts.gold}</span>}
                  {badgeCounts.silver  > 0 && <span style={{ fontSize: '0.72rem', background: '#c0c0c020', color: '#c0c0c0', padding: '2px 7px', borderRadius: '10px' }}>🥈×{badgeCounts.silver}</span>}
                  {badgeCounts.diamond + badgeCounts.gold + badgeCounts.silver === 0 && <span style={{ fontSize: '0.72rem', color: '#333' }}>No badges</span>}
                </div>
                <FaChevronRight style={{ color: '#2a2a2a', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Detail Panel ── */}
      <div style={{ position: 'sticky', top: 0 }}>
        {!selected ? (
          <div style={{ background: '#111', padding: '60px 40px', borderRadius: '16px', border: '1px dashed #2a2a2a', textAlign: 'center', color: '#333' }}>
            <FaInfoCircle style={{ fontSize: '3rem', marginBottom: '15px' }} />
            <p>Select a student to view domain badges and booking analytics.</p>
          </div>
        ) : (
          <div style={{ background: '#141414', borderRadius: '16px', border: '1px solid #222', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '25px', textAlign: 'center', background: 'linear-gradient(145deg,#1a1a1a,#111)', borderBottom: '1px solid #1e1e1e' }}>
              <BadgeIcon badge={selected.badge} size={30} />
              <h2 style={{ margin: '12px 0 4px' }}>{selected.name}</h2>
              <p style={{ color: '#666', margin: 0, fontSize: '0.85rem' }}>{selected.email} · {selected.studentId}</p>
              <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#555' }}>{selected.totalBookings} total bookings</div>
            </div>

            <div style={{ padding: '20px', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
              {/* Domain Badges Table */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '0.72rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Domain Badges & Bookings</div>
                {DOMAINS.map(({ key, label }) => {
                  const count = selected.mealCounts?.[key] ?? 0;
                  const currentBadge = selected.domainBadges?.[key] ?? 'none';
                  return (
                    <div key={key} style={{ background: '#0e0e0e', borderRadius: '12px', padding: '14px', marginBottom: '10px', border: '1px solid #1a1a1a' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{label}</span>
                        <DomainBadgePill badge={currentBadge} />
                      </div>
                      <ProgressBar count={count} label="" />
                      {/* Quick-assign buttons for this domain */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                        {['none','silver','gold','diamond'].map(b => (
                          <button key={b} onClick={() => handleAssign(selected.email, key, b)}
                            style={{
                              flex: 1, padding: '6px 0', borderRadius: '8px', cursor: 'pointer', fontWeight: currentBadge === b ? '800' : '500',
                              fontSize: '0.7rem', textTransform: 'capitalize',
                              background: currentBadge === b ? `${BADGE_META[b].color}33` : '#1a1a1a',
                              color: currentBadge === b ? BADGE_META[b].color : '#555',
                              border: currentBadge === b ? `1px solid ${BADGE_META[b].color}88` : '1px solid #222',
                              transition: '0.15s'
                            }}>
                            {BADGE_META[b].icon} {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* History */}
              {selected.badgeHistory?.length > 0 && (
                <>
                  <div style={{ fontSize: '0.72rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Badge History</div>
                  {selected.badgeHistory.slice().reverse().slice(0, 8).map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start', fontSize: '0.8rem' }}>
                      <FaCheckCircle style={{ color: '#2ed573', marginTop: '3px', flexShrink: 0 }} />
                      <div>
                        <span style={{ color: '#aaa', fontWeight: 'bold' }}>{(h.badge || '').toUpperCase()}</span>
                        {h.domain && h.domain !== 'all' && <span style={{ color: '#555' }}> ({h.domain})</span>}
                        <div style={{ fontSize: '0.72rem', color: '#444' }}>{h.date} · {h.reason}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default BadgeManager;
