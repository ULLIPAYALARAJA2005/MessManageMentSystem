import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { 
  FaAward, FaSearch, FaChevronRight, FaInfoCircle, 
  FaCheckCircle, FaUsers, FaArrowRight, FaCogs, 
  FaChartLine, FaHistory, FaTimes
} from 'react-icons/fa';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOMAINS = [
  { key: 'morningTea', label: 'Morning Tea / Milk', icon: '🍵' },
  { key: 'morningEgg', label: 'Morning Egg', icon: '🥚' },
  { key: 'morningBanana', label: 'Morning Banana', icon: '🍌' },
  { key: 'tiffin',     label: 'Tiffin', icon: '🥪' },
  { key: 'lunchVeg',   label: 'Lunch Veg', icon: '🌱' },
  { key: 'lunchNonVeg', label: 'Lunch Non-Veg', icon: '🍗' },
  { key: 'lunchEgg',   label: 'Lunch Egg', icon: '🥚' },
  { key: 'eveningTea', label: 'Evening Tea / Milk', icon: '🍵' },
  { key: 'snacks',     label: 'Snacks', icon: '🍟' },
  { key: 'dinnerVeg',  label: 'Dinner Veg', icon: '🌱' },
  { key: 'dinnerNonVeg', label: 'Dinner Non-Veg', icon: '🍗' },
  { key: 'dinnerEgg',  label: 'Dinner Egg', icon: '🥚' },
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
  const isSpecial = ['silver', 'gold', 'diamond'].includes(badge);
  
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size + 16, height: size + 16, borderRadius: '12px',
      background: isSpecial ? `linear-gradient(135deg, ${meta.color}33, ${meta.color}11)` : 'var(--border)',
      border: `1.5px solid ${isSpecial ? meta.color : 'var(--border)'}`,
      color: meta.color, fontSize: size,
      boxShadow: badge === 'diamond' ? `0 0 15px ${meta.glow}` : 'none',
      transition: '0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {badge === 'none' ? <FaAward style={{ opacity: 0.3 }} /> : <FaAward />}
    </div>
  );
};

const DetailCard = ({ domain, badge, count, onAssign }) => {
  const meta = BADGE_META[badge] || BADGE_META.none;
  const nextTarget = badge === 'none' ? THRESHOLDS.silver : badge === 'silver' ? THRESHOLDS.gold : badge === 'gold' ? THRESHOLDS.diamond : null;
  const prevTarget = badge === 'diamond' ? THRESHOLDS.gold : badge === 'gold' ? THRESHOLDS.silver : badge === 'silver' ? 0 : 0;
  
  const pct = nextTarget ? Math.min(((count - prevTarget) / (nextTarget - prevTarget)) * 100, 100) : 100;

  return (
    <div style={{
      background: 'var(--card)', borderRadius: '16px', border: '1px solid var(--border)',
      padding: '16px', transition: '0.3s', display: 'flex', flexDirection: 'column', gap: '12px',
      position: 'relative', overflow: 'hidden'
    }} className="domain-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.2rem' }}>{domain.icon}</span>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text)' }}>{domain.label}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-sec)' }}>{count} Bookings</div>
          </div>
        </div>
        <div style={{ padding: '4px 8px', borderRadius: '8px', background: `${meta.color}15`, border: `1px solid ${meta.color}33`, color: meta.color, fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase' }}>
          {meta.label}
        </div>
      </div>

      <div style={{ position: 'relative', height: '6px', background: 'var(--border)', borderRadius: '3px' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`, background: meta.color, borderRadius: '3px', transition: '1s' }} />
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        {['none', 'silver', 'gold', 'diamond'].map(b => (
          <button key={b} onClick={() => onAssign(domain.key, b)} style={{
            flex: 1, padding: '6px 0', borderRadius: '6px', border: badge === b ? `1px solid ${BADGE_META[b].color}` : '1px solid var(--border)',
            background: badge === b ? `${BADGE_META[b].color}20` : 'transparent', color: badge === b ? BADGE_META[b].color : 'var(--text-sec)',
            fontSize: '0.6rem', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s'
          }}>
            {BADGE_META[b].icon}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const BadgeManager = () => {
  const [activeTab, setActiveTab] = useState('registry'); // registry | settings
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
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
      toast.success("Rules strictly enforced! Badges updated.");
      setIsEditingRules(false);
      fetchStudents();
      if (selected) openDetails(selected.email);
    } catch { toast.error("Failed to save rules"); }
  };

  const handleRecalculate = async () => {
    const loader = toast.loading("Processing millions of booking records...");
    try {
      await api.post('/badge/recalculate');
      toast.dismiss(loader);
      toast.success("Algorithm executed successfully.", { icon: '🧠' });
      fetchStudents();
    } catch { toast.dismiss(loader); toast.error("Calculation failed"); }
  };

  const handleRuleChange = (domain, tier, val) => {
    setRules(prev => ({ ...prev, [domain]: { ...prev[domain], [tier]: Number(val) } }));
  };

  const fetchStudents = async () => {
    try {
      const { data } = await api.get('/badge/students');
      setStudents(data);
    } catch { toast.error("Network synchronization error"); }
    finally { setLoading(false); }
  };

  const openDetails = async (email) => {
    try {
      const { data } = await api.get(`/badge/student/${email}`);
      setSelected(data);
    } catch { toast.error("Student profile unreachable"); }
  };

  const handleAssign = async (email, domain, badge) => {
    try {
      await api.post('/badge/assign', { email, domain, badge });
      toast.success(`${BADGE_META[badge].label} awarded for ${domain === 'all' ? 'Universal' : domain}!`, { icon: '✨' });
      openDetails(email);
      fetchStudents();
    } catch { toast.error("Manual override rejected"); }
  };

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    const matchBadge = filter === 'all' || s.badge === filter || (s.domainBadges && Object.values(s.domainBadges).includes(filter));
    return matchSearch && matchBadge;
  }).sort((a, b) => b.totalBookings - a.totalBookings);

  const stats = {
    silver: students.filter(s => s.badge === 'silver').length,
    gold: students.filter(s => s.badge === 'gold').length,
    diamond: students.filter(s => s.badge === 'diamond').length,
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'pulse 1.5s ease-in-out infinite' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      
      {/* Skeleton Navbar */}
      <div style={{ height: '56px', background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)' }} />
      
      {/* Skeleton Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {[1, 2, 3, 4].map(k => (
          <div key={k} style={{ height: '110px', background: 'var(--card)', borderRadius: '20px', border: '1px solid var(--border)' }} />
        ))}
      </div>

      {/* Skeleton Main Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1.2fr) minmax(400px, 1fr)', gap: '24px' }}>
        <div style={{ height: '500px', background: 'var(--card)', borderRadius: '20px', border: '1px solid var(--border)' }} />
        <div style={{ height: '500px', background: 'var(--card)', borderRadius: '20px', border: '1px solid var(--border)' }} />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* ── Navbar Options ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => setActiveTab('registry')} style={{
            padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: '0.2s',
            background: activeTab === 'registry' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'registry' ? '#fff' : 'var(--text-sec)',
            fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <FaUsers /> Badge Registry
          </button>
          <button onClick={() => setActiveTab('settings')} style={{
            padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: '0.2s',
            background: activeTab === 'settings' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'settings' ? '#fff' : 'var(--text-sec)',
            fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px'
          }}>
            <FaCogs /> Global Standards
          </button>
        </div>
        <button onClick={handleRecalculate} style={{
          padding: '10px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
          background: 'var(--border)', color: 'var(--text)', fontWeight: 'bold', fontSize: '0.8rem',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          Recalculate All
        </button>
      </div>

      {activeTab === 'registry' ? (
        <>
          {/* ── Summary Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {['silver', 'gold', 'diamond'].map(tier => (
              <div key={tier} style={{ background: 'var(--card)', padding: '20px', borderRadius: '20px', border: '1px solid var(--border)', position: 'relative' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-sec)', textTransform: 'uppercase', fontWeight: '800' }}>Active {tier} Holders</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: BADGE_META[tier].color, marginTop: '5px' }}>{stats[tier]}</div>
                <div style={{ position: 'absolute', right: '20px', bottom: '15px', color: BADGE_META[tier].color, opacity: 0.1, fontSize: '3rem' }}><FaAward /></div>
              </div>
            ))}
            <div style={{ background: 'linear-gradient(135deg, #111, #000)', padding: '20px', borderRadius: '20px', border: '1px solid #333' }}>
              <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', fontWeight: '800' }}>Total Students tracked</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff', marginTop: '5px' }}>{students.length}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1.2fr) minmax(400px, 1fr)', gap: '24px', alignItems: 'start' }}>
            {/* ── Student List ── */}
            <div style={{ background: 'var(--card)', borderRadius: '20px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <FaSearch style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search registry..."
                      style={{ width: '100%', padding: '12px 12px 12px 42px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: '#fff', borderRadius: '10px', outline: 'none' }} />
                  </div>
                  <select value={filter} onChange={e => setFilter(e.target.value)}
                    style={{ padding: '0 15px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: '#fff', borderRadius: '10px', outline: 'none' }}>
                    <option value="all">Filter: All</option>
                    {['none', 'silver', 'gold', 'diamond'].map(t => (
                      <option key={t} value={t}>{BADGE_META[t].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
                {filteredStudents.map(s => (
                  <div key={s.id} onClick={() => openDetails(s.email)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '15px', padding: '16px 20px', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', transition: '0.2s', background: selected?.id === s.id ? `${BADGE_META[s.badge].color}10` : 'transparent'
                    }}>
                    <BadgeIcon badge={s.badge} size={16} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '800', fontSize: '0.95rem', color: selected?.id === s.id ? BADGE_META[s.badge].color : 'var(--text)' }}>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{s.studentId}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {['diamond', 'gold', 'silver'].map(t => {
                        const count = Object.values(s.domainBadges || {}).filter(b => b === t).length;
                        return count > 0 ? <span key={t} style={{ fontSize: '0.7rem', color: BADGE_META[t].color, background: `${BADGE_META[t].color}15`, padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>{BADGE_META[t].icon} {count}</span> : null;
                      })}
                    </div>
                    <FaChevronRight style={{ color: 'var(--border)', fontSize: '0.8rem' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Profile Detail Panel ── */}
            <div style={{ position: 'sticky', top: '24px' }}>
              {!selected ? (
                <div style={{ background: 'var(--card)', padding: '60px 40px', borderRadius: '24px', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-sec)' }}>
                  <FaChartLine style={{ fontSize: '3.5rem', marginBottom: '20px', opacity:0.1 }} />
                  <h3 style={{ margin: 0 }}>Analyzer Inactive</h3>
                  <p style={{ fontSize: '0.85rem' }}>Select a student from the registry to inspect domain-level performance metrics.</p>
                </div>
              ) : (
                <div style={{ background: 'var(--card)', borderRadius: '24px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div style={{ padding: '30px', background: 'linear-gradient(180deg, #111, transparent)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ display: 'inline-block', position: 'relative' }}>
                      <BadgeIcon badge={selected.badge} size={35} />
                      <div style={{ position: 'absolute', top: -5, right: -5, width: '15px', height: '15px', background: 'var(--success-color)', borderRadius: '50%', border: '2px solid #111' }} />
                    </div>
                    <h2 style={{ margin: '15px 0 5px', letterSpacing: '-0.5px' }}>{selected.name}</h2>
                    <p style={{ margin: 0, color: 'var(--text-sec)', fontSize: '0.8rem' }}>{selected.email} • <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{selected.totalBookings} Total Bookings</span></p>
                  </div>

                  <div style={{ padding: '24px', maxHeight: 'calc(100vh - 425px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      {DOMAINS.map(domain => (
                        <DetailCard key={domain.key} domain={domain} badge={selected.domainBadges?.[domain.key] || 'none'} count={selected.mealCounts?.[domain.key] || 0} onAssign={(d, b) => handleAssign(selected.email, d, b)} />
                      ))}
                    </div>

                    {selected.badgeHistory?.length > 0 && (
                      <div style={{ marginTop: '10px' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', marginBottom: '15px' }}><FaHistory /> Activity Timeline</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '15px', borderLeft: '2px solid var(--border)' }}>
                          {selected.badgeHistory.slice().reverse().slice(0, 5).map((h, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                              <div style={{ position: 'absolute', left: '-21px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: BADGE_META[h.badge]?.color || '#333' }} />
                              <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{h.badge?.toUpperCase()} Awarded</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-sec)' }}>{h.domain !== 'all' ? `Domain: ${h.domain}` : 'Universal Badge'} • {h.date}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', fontStyle: 'italic', marginTop: '2px' }}>"{h.reason}"</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* ── Global Standards Tab ── */
        <div style={{ background: 'var(--card)', borderRadius: '24px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '25px 30px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Automated Tier Logic</h3>
              <p style={{ margin: '5px 0 0', color: 'var(--text-sec)', fontSize: '0.85rem' }}>Configure the required number of bookings for each badge tier.</p>
            </div>
            {isEditingRules ? (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" onClick={() => setIsEditingRules(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleSaveRules} style={{ width: 'auto' }}>Publish Standards</button>
              </div>
            ) : (
              <button className="btn-primary" onClick={() => setIsEditingRules(true)} style={{ width: 'auto' }}>✏️ Adjust Thresholds</button>
            )}
          </div>
          <div style={{ padding: '0 30px 30px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '20px 10px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-sec)' }}>Meal Category</th>
                  {['silver', 'gold', 'diamond'].map(t => (
                    <th key={t} style={{ padding: '20px 10px', fontSize: '0.75rem', textTransform: 'uppercase', color: BADGE_META[t].color, textAlign: 'center' }}>
                      {BADGE_META[t].icon} {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DOMAINS.map(d => (
                  <tr key={d.key} style={{ borderBottom: '1px solid var(--border)', background: 'transparent' }}>
                    <td style={{ padding: '15px 10px', fontWeight: 'bold' }}>{d.label}</td>
                    {['silver', 'gold', 'diamond'].map(tier => (
                      <td key={tier} style={{ padding: '15px 10px', textAlign: 'center' }}>
                        {isEditingRules ? (
                          <input type="number" value={rules[d.key]?.[tier] || ''} onChange={e => handleRuleChange(d.key, tier, e.target.value)}
                            style={{ width: '70px', padding: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: '#fff', borderRadius: '6px', textAlign: 'center' }} />
                        ) : (
                          <span style={{ fontSize: '1.1rem', fontWeight: '900', color: BADGE_META[tier].color }}>{rules[d.key]?.[tier] || 0}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgeManager;

