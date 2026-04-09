import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import {
    FaHome, FaUtensils, FaCalendarCheck, FaUserGraduate,
    FaUserTie, FaStore, FaWallet, FaComments, FaChartPie,
    FaCog, FaSignOutAlt, FaBell, FaClipboardList, FaPoll, FaAward
} from 'react-icons/fa';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import PollManager from '../components/PollManager';
import BadgeManager, { BadgeIcon } from '../components/BadgeManager';

const MEALS = ["Morning Tea", "Morning Egg", "Tiffin", "Lunch", "Lunch Egg", "Evening Tea", "Evening Snacks", "Dinner", "Dinner Egg"];
const MEAL_COLORS = {
    'Morning Tea': '#f39c12', 'Morning Egg': '#e74c3c', 'Tiffin': '#9b59b6',
    'Lunch': '#27ae60', 'Lunch Egg': '#e74c3c', 'Evening Tea': '#f39c12',
    'Evening Snacks': '#e67e22', 'Dinner': '#2980b9', 'Dinner Egg': '#e74c3c'
};
const PIE_COLORS = ['#ff7b00', '#2ed573', '#1e90ff', '#ff4757'];

const WalletManager = () => {
    const [summary, setSummary] = useState({ totalRevenue: 0, todayCollection: 0, totalWalletBalance: 0, lowBalanceCount: 0 });
    const [txns, setTxns] = useState([]);
    const [students, setStudents] = useState([]);
    const [lowBalance, setLowBalance] = useState([]);
    const [analytics, setAnalytics] = useState({ daily: [], breakdown: [] });
    const [activeSection, setActiveSection] = useState('overview');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [form, setForm] = useState({ email: '', amount: '', purpose: 'Recharge', mode: 'add' });

    useEffect(() => {
        fetchAll();
        const t = setInterval(fetchAll, 8000);
        return () => clearInterval(t);
    }, []);

    const fetchAll = async () => {
        try {
            const [s, t, stu, lb, an] = await Promise.all([
                api.get('/wallet/summary'), api.get('/wallet/transactions'),
                api.get('/wallet/students'), api.get('/wallet/low-balance'), api.get('/wallet/analytics')
            ]);
            setSummary(s.data); setTxns(t.data); setStudents(stu.data); setLowBalance(lb.data); setAnalytics(an.data);
        } catch (e) { }
    };

    const handleWalletAction = async (e, mode) => {
        e.preventDefault();
        const endpoint = mode === 'add' ? '/wallet/add' : '/wallet/deduct';
        try {
            const { data } = await api.post(endpoint, { email: form.email, amount: Number(form.amount), purpose: form.purpose });
            toast.success(data.message);
            setForm({ email: '', amount: '', purpose: 'Recharge', mode });
            fetchAll();
        } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
    };

    const exportCSV = () => {
        const rows = [['Email', 'Name', 'Type', 'Amount', 'Purpose', 'Date']];
        txns.forEach(t => rows.push([t.email, t.studentName, t.type, t.amount, t.purpose, t.date]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'wallet_transactions.csv'; a.click();
        toast.success('CSV exported!');
    };

    const filtered = txns.filter(t => {
        const matchSearch = !search || t.email?.includes(search) || t.studentName?.toLowerCase().includes(search.toLowerCase());
        const matchType = typeFilter === 'all' || t.type === typeFilter;
        return matchSearch && matchType;
    });

    const sCards = [
        { label: 'Total Revenue', value: `₹${summary.totalRevenue}`, color: '#2ed573', icon: '💰' },
        { label: "Today's Collection", value: `₹${summary.todayCollection}`, color: '#ff7b00', icon: '📅' },
        { label: 'Total Wallet Balance', value: `₹${summary.totalWalletBalance}`, color: '#1e90ff', icon: '👛' },
        { label: 'Low Balance Students', value: summary.lowBalanceCount, color: '#ff4757', icon: '⚠️' },
    ];

    const SECTIONS = [
        { id: 'overview', label: '📊 Overview' },
        { id: 'transactions', label: '📋 Transactions' },
        { id: 'students', label: '👨‍🎓 Students' },
        { id: 'manage', label: '💳 Add / Deduct' },
        { id: 'alerts', label: '⚠️ Low Balance' },
    ];

    return (
        <div>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {sCards.map(c => (
                    <div key={c.label} style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', borderLeft: `4px solid ${c.color}` }}>
                        <div style={{ fontSize: '1.6rem' }}>{c.icon}</div>
                        <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '8px' }}>{c.label}</p>
                        <h2 style={{ color: c.color, marginTop: '4px' }}>{c.value}</h2>
                    </div>
                ))}
            </div>

            {/* Section nav tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {SECTIONS.map(s => (
                    <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
                        padding: '10px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: '0.2s',
                        background: activeSection === s.id ? 'var(--primary-color)' : '#1a1a1a',
                        color: activeSection === s.id ? 'white' : '#888'
                    }}>{s.label}</button>
                ))}
            </div>

            {/* --- OVERVIEW --- */}
            {activeSection === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
                    <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px' }}>
                        <h4 style={{ marginBottom: '15px' }}>Daily Revenue (Last 7 Days)</h4>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={analytics.daily || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="name" stroke="#888" />
                                <YAxis stroke="#888" />
                                <Tooltip contentStyle={{ background: '#111', border: 'none' }} />
                                <Bar dataKey="revenue" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px' }}>
                        <h4 style={{ marginBottom: '15px' }}>Transaction Breakdown</h4>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={analytics.breakdown || []} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => value > 0 ? `${name}: ₹${value}` : ''}>
                                    {(analytics.breakdown || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#111', border: 'none' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* --- TRANSACTIONS --- */}
            {activeSection === 'transactions' && (
                <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <input placeholder="Search by email or name..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '10px 14px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: '8px', width: '250px' }} />
                            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '10px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: '8px' }}>
                                <option value="all">All Types</option>
                                <option value="credit">Credit Only</option>
                                <option value="debit">Debit Only</option>
                            </select>
                        </div>
                        <button onClick={exportCSV} style={{ padding: '10px 20px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>⬇ Export CSV</button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ background: '#1a1a1a', color: '#888' }}>
                                    {['Student', 'Email', 'Type', 'Amount', 'Purpose', 'Date', 'By'].map(h => (
                                        <th key={h} style={{ padding: '12px 15px', textAlign: 'left', fontWeight: '600' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.slice(0, 100).map((t, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #252525' }}>
                                        <td style={{ padding: '12px 15px', fontWeight: '500' }}>{t.studentName || '—'}</td>
                                        <td style={{ padding: '12px 15px', color: '#888', fontSize: '0.8rem' }}>{t.email}</td>
                                        <td style={{ padding: '12px 15px' }}>
                                            <span style={{ background: t.type === 'credit' ? '#0d2b1a' : '#2b0d0d', color: t.type === 'credit' ? '#2ed573' : '#ff4757', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                {t.type === 'credit' ? '▲ Credit' : '▼ Debit'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 15px', fontWeight: 'bold', color: t.type === 'credit' ? '#2ed573' : '#ff4757' }}>₹{t.amount}</td>
                                        <td style={{ padding: '12px 15px', color: '#aaa' }}>{t.purpose}</td>
                                        <td style={{ padding: '12px 15px', color: '#666', fontSize: '0.8rem' }}>{t.date?.slice(0, 16)}</td>
                                        <td style={{ padding: '12px 15px', color: '#555', fontSize: '0.8rem' }}>{t.by || 'System'}</td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#555' }}>No transactions found</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length > 100 && <p style={{ color: '#555', textAlign: 'center', marginTop: '10px', fontSize: '0.8rem' }}>Showing 100 of {filtered.length} entries</p>}
                </div>
            )}

            {/* --- STUDENTS --- */}
            {activeSection === 'students' && (
                <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px' }}>
                    <h4 style={{ marginBottom: '15px' }}>All Student Wallets</h4>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#1a1a1a', color: '#888' }}>
                                {['Name', 'Email', 'Student ID', 'Wallet Balance', 'Status'].map(h => (
                                    <th key={h} style={{ padding: '12px 15px', textAlign: 'left' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((s, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #252525' }}>
                                    <td style={{ padding: '12px 15px', fontWeight: '500' }}>{s.name}</td>
                                    <td style={{ padding: '12px 15px', color: '#888', fontSize: '0.85rem' }}>{s.email}</td>
                                    <td style={{ padding: '12px 15px', color: '#888' }}>{s.studentId}</td>
                                    <td style={{ padding: '12px 15px', fontWeight: 'bold', color: (s.walletBalance || 0) < 50 ? '#ff4757' : '#2ed573' }}>₹{s.walletBalance || 0}</td>
                                    <td style={{ padding: '12px 15px' }}>
                                        {(s.walletBalance || 0) < 50
                                            ? <span style={{ background: '#2b0d0d', color: '#ff4757', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>⚠ Low Balance</span>
                                            : <span style={{ background: '#0d2b1a', color: '#2ed573', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>✓ Good</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* --- ADD / DEDUCT --- */}
            {activeSection === 'manage' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {['add', 'deduct'].map(mode => (
                        <div key={mode} style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: '12px', borderTop: `4px solid ${mode === 'add' ? '#2ed573' : '#ff4757'}` }}>
                            <h3 style={{ margin: '0 0 5px', color: mode === 'add' ? '#2ed573' : '#ff4757' }}>
                                {mode === 'add' ? '➕ Add Money' : '➖ Deduct Money'}
                            </h3>
                            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '20px' }}>
                                {mode === 'add' ? 'Credit wallet for recharge or bonus' : 'Deduct for penalty or correction'}
                            </p>
                            <form onSubmit={e => handleWalletAction(e, mode)}>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ color: '#888', fontSize: '0.85rem' }}>Student Email</label>
                                    <input list="student-emails" value={form.mode === mode ? form.email : ''} onChange={e => setForm({ ...form, email: e.target.value, mode })} required style={{ width: '100%', padding: '12px', marginTop: '6px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: '8px' }} placeholder="student@email.com" />
                                    <datalist id="student-emails">
                                        {students.map(s => <option key={s.email} value={s.email}>{s.name}</option>)}
                                    </datalist>
                                </div>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ color: '#888', fontSize: '0.85rem' }}>Amount (₹)</label>
                                    <input type="number" min="1" value={form.mode === mode ? form.amount : ''} onChange={e => setForm({ ...form, amount: e.target.value, mode })} required style={{ width: '100%', padding: '12px', marginTop: '6px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: '8px' }} placeholder="Enter amount" />
                                </div>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ color: '#888', fontSize: '0.85rem' }}>Purpose / Reason</label>
                                    <select value={form.mode === mode ? form.purpose : ''} onChange={e => setForm({ ...form, purpose: e.target.value, mode })} style={{ width: '100%', padding: '12px', marginTop: '6px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: '8px' }}>
                                        {mode === 'add'
                                            ? ['Recharge', 'Bonus', 'Correction', 'Refund'].map(p => <option key={p}>{p}</option>)
                                            : ['Meal Booking', 'Penalty', 'Adjustment', 'Meal Correction'].map(p => <option key={p}>{p}</option>)}
                                    </select>
                                </div>
                                <button type="submit" style={{ width: '100%', padding: '14px', background: mode === 'add' ? '#2ed573' : '#ff4757', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
                                    {mode === 'add' ? '✅ Add Money' : '🔻 Deduct Money'}
                                </button>
                            </form>
                        </div>
                    ))}
                </div>
            )}

            {/* --- LOW BALANCE ALERTS --- */}
            {activeSection === 'alerts' && (
                <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <h4 style={{ margin: 0 }}>⚠️ Low Balance Students</h4>
                        <span style={{ background: '#2b0d0d', color: '#ff4757', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' }}>{lowBalance.length} students</span>
                    </div>
                    <p style={{ color: '#888', marginBottom: '15px', fontSize: '0.9rem' }}>Students with wallet balance below ₹50. Consider notifying them to recharge.</p>
                    {lowBalance.length === 0
                        ? <div style={{ textAlign: 'center', padding: '40px', color: '#555' }}>🎉 All students have sufficient balance!</div>
                        : lowBalance.map((s, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a0909', border: '1px solid #ff475722', padding: '15px 20px', borderRadius: '10px', marginBottom: '10px' }}>
                                <div>
                                    <p style={{ fontWeight: 'bold', margin: 0 }}>{s.name}</p>
                                    <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '2px' }}>{s.email} · ID: {s.studentId}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ color: '#ff4757', fontWeight: 'bold', fontSize: '1.2rem', margin: 0 }}>₹{s.walletBalance || 0}</p>
                                    <p style={{ color: '#ff6b6b', fontSize: '0.75rem', marginTop: '2px' }}>⚠ Below threshold</p>
                                </div>
                            </div>
                        ))}
                </div>
            )}
        </div>
    );
};


const WeeklyMenuManager = () => {
    const [weekly, setWeekly] = useState(null);
    const [editMode, setEditMode] = useState({});

    useEffect(() => {
        api.get('/admin/weekly-menu').then(res => setWeekly(res.data)).catch(e => console.log(e));
    }, []);

    const saveDay = async () => {
        try {
            await api.put('/admin/weekly-menu', weekly);
            toast.success('Weekly menu updated and saved to Server!');
        } catch (e) { toast.error('Failed to save'); }
    };

    const copyMondayTo = (day) => {
        setWeekly(prev => ({ ...prev, [day]: JSON.parse(JSON.stringify(prev['Monday'])) }));
        toast.success(`Copied Monday to ${day}`);
    };

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const MEALS = ["Morning Tea", "Morning Egg", "Tiffin", "Lunch", "Lunch Egg", "Evening Tea", "Evening Snacks", "Dinner", "Dinner Egg"];

    const getDayTotal = (dayObj) => Object.values(dayObj).reduce((acc, curr) => acc + Number(curr?.price || 0), 0);

    if (!weekly) return <div style={{ color: 'var(--text-secondary)' }}>Loading Weekly Menu Framework...</div>;

    return (
        <div style={{ background: 'var(--bg-color)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', background: 'var(--surface-color)', padding: '20px', borderRadius: '12px' }}>
                <div>
                    <h3 style={{ margin: 0, color: 'white' }}>Weekly Menu Framework</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '5px' }}>This serves as the default fallback daily template.</p>
                </div>
                <button onClick={saveDay} className="btn-primary" style={{ width: 'auto', background: 'var(--success-color)' }}>Save All Changes</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                {DAYS.map(day => (
                    <div key={day} style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: '12px', borderTop: day === new Date().toLocaleDateString('en-US', { weekday: 'long' }) ? '4px solid var(--primary-color)' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ color: day === new Date().toLocaleDateString('en-US', { weekday: 'long' }) ? 'var(--primary-color)' : 'white', margin: 0 }}>{day} {day === new Date().toLocaleDateString('en-US', { weekday: 'long' }) && '(Today)'}</h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {day !== 'Monday' && <button onClick={() => copyMondayTo(day)} style={{ background: '#333', color: 'white', padding: '6px 12px', borderRadius: '6px', border: '1px solid #444', cursor: 'pointer', fontSize: '0.8rem', transition: '0.2s' }}>Copy Mon</button>}
                                <button onClick={() => setEditMode(p => ({ ...p, [day]: !p[day] }))} style={{ background: editMode[day] ? 'var(--success-color)' : 'transparent', color: editMode[day] ? 'white' : 'var(--primary-color)', padding: '6px 12px', borderRadius: '6px', border: `1px solid ${editMode[day] ? 'var(--success-color)' : 'var(--primary-color)'}`, cursor: 'pointer', fontSize: '0.8rem', transition: '0.2s' }}>{editMode[day] ? 'Done' : 'Edit'}</button>
                            </div>
                        </div>

                        <div style={{ padding: '10px 15px', background: '#111', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Total Daily Cost</span>
                            <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>₹{getDayTotal(weekly[day])}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {MEALS.map(meal => (
                                <div key={meal} style={{ display: 'flex', justifyContent: 'space-between', background: '#1a1a1a', padding: '12px', borderRadius: '8px', alignItems: 'center', borderLeft: meal.includes('Egg') ? '3px solid #ff4757' : '3px solid #2ed573' }}>
                                    <div style={{ flex: 1, paddingRight: '15px' }}>
                                        <p style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>{meal} {meal.includes('Egg') ? '🥚' : '🌱'}</p>
                                        {editMode[day] ? (
                                            <input value={weekly[day][meal]?.name || ''} onChange={(e) => setWeekly(p => ({ ...p, [day]: { ...p[day], [meal]: { ...p[day][meal], name: e.target.value } } }))} style={{ width: '100%', background: '#222', color: 'white', border: '1px solid #444', padding: '8px', borderRadius: '4px' }} placeholder="Item Name" />
                                        ) : <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>{weekly[day][meal]?.name || <span style={{ color: '#555' }}>Not Set</span>}</span>}
                                    </div>
                                    <div style={{ width: '80px', textAlign: 'right' }}>
                                        {editMode[day] ? (
                                            <input type="number" value={weekly[day][meal]?.price || ''} onChange={(e) => setWeekly(p => ({ ...p, [day]: { ...p[day], [meal]: { ...p[day][meal], price: Number(e.target.value) } } }))} style={{ width: '100%', background: '#222', color: 'var(--success-color)', border: '1px solid #444', padding: '8px', borderRadius: '4px', textAlign: 'right' }} placeholder="₹" />
                                        ) : <span style={{ color: 'var(--success-color)', fontWeight: 'bold', fontSize: '1.1rem' }}>₹{weekly[day][meal]?.price || 0}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

const DailyMenuManager = () => {
    const [targetDate, setTargetDate] = useState(() => {
        const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().split('T')[0];
    });
    const [deadline, setDeadline] = useState(() => {
        const date = new Date();
        date.setHours(19, 0, 0, 0);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    });
    const [selectedDay, setSelectedDay] = useState('');
    const [publishedMenus, setPublishedMenus] = useState([]);

    // Festival Specific
    const [isFestival, setIsFestival] = useState(false);
    const [festivalName, setFestivalName] = useState('');
    const [description, setDescription] = useState('');
    const [festItems, setFestItems] = useState([{ domain: 'Lunch', name: '', price: '' }]);

    const DOMAIN_OPTIONS = [
        { key: 'Morning Tea', label: '🍵 Morning Tea / Milk' },
        { key: 'Morning Egg', label: '🥚 Morning Egg' },
        { key: 'Tiffin', label: '🥪 Tiffin' },
        { key: 'Lunch', label: '🍱 Lunch' },
        { key: 'Lunch Egg', label: '🥚 Lunch Egg' },
        { key: 'Evening Tea', label: '🍵 Evening Tea / Milk' },
        { key: 'Evening Snacks', label: '🍿 Evening Snacks' },
        { key: 'Dinner', label: '🍽️ Dinner' },
        { key: 'Dinner Egg', label: '🥚 Dinner Egg' },
    ];

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const [items, setItems] = useState(() => {
        const st = {};
        MEALS.forEach(m => st[m] = { name: '', price: 0 });
        return st;
    });

    useEffect(() => {
        const fetchCurrentMenu = async () => {
            try {
                const { data } = await api.get(`/admin/menu/${targetDate}`);
                if (data && data.items) {
                    setItems(data.items);
                    setDeadline(data.deadline || '19:00');
                    setIsFestival(data.isFestival || false);
                    setFestivalName(data.festivalName || '');
                    setDescription(data.description || '');
                    if (data.isFestival) {
                        const arr = Object.entries(data.items).map(([dom, d]) => ({
                            domain: dom, name: d.name, price: d.price
                        }));
                        setFestItems(arr.length > 0 ? arr : [{ domain: 'Lunch', name: '', price: '' }]);
                    }
                }
            } catch (err) {
                // If 404, reset to empty/template state
                const emptyItems = {};
                MEALS.forEach(m => emptyItems[m] = { name: '', price: 0 });
                setItems(emptyItems);
            }
        };
        fetchCurrentMenu();
    }, [targetDate]);

    const fetchPublishedMenus = async () => {
        try {
            const { data } = await api.get('/admin/menus');
            setPublishedMenus(data || []);
        } catch (err) {
            console.error("Failed to fetch published menus", err);
        }
    };

    useEffect(() => {
        fetchPublishedMenus();
    }, []);

    const loadFromDay = async () => {
        if (!selectedDay) { toast.error('Please select a weekday first'); return; }
        try {
            const { data } = await api.get('/admin/weekly-menu');
            if (data && data[selectedDay]) {
                setItems(data[selectedDay]);
                toast.success(`✅ Loaded ${selectedDay}'s menu template!`);
            } else {
                toast.error(`No template set for ${selectedDay} yet`);
            }
        } catch (e) { toast.error("Failed to load weekly menu"); }
    };

    const handlePublish = async (e) => {
        e.preventDefault();
        try {
            let finalItems = items;
            if (isFestival) {
                finalItems = {};
                festItems.forEach(it => {
                    if (it.name && it.price !== '') {
                        finalItems[it.domain] = { name: it.name, price: Number(it.price) };
                    }
                });
                if (Object.keys(finalItems).length === 0) {
                    toast.error('Add at least one item for the festival menu'); return;
                }
            }
            await api.post('/admin/menu', {
                date: targetDate, deadline, items: finalItems,
                isFestival, festivalName, description
            });
            toast.success(`Menu published for ${targetDate}!`);
            fetchPublishedMenus();
        } catch (e) { toast.error(e.response?.data?.message || "Failed to publish menu"); }
    };

    const handleDelete = async (dateToDelete = targetDate) => {
        if (!window.confirm(`Are you sure you want to delete the menu for ${dateToDelete}?`)) return;
        try {
            await api.delete(`/admin/menu/${dateToDelete}`);
            toast.success(`Menu for ${dateToDelete} deleted successfully`);
            fetchPublishedMenus();
            if (targetDate === dateToDelete) {
                setTargetDate(prev => prev); // re-trigger fetch
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to delete menu");
        }
    };

    const getDailyTotal = () => Object.values(items).reduce((acc, curr) => acc + Number(curr.price || 0), 0);

    return (
        <div style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                    <h3 style={{ margin: 0 }}>📅 Publish Daily Override Menu</h3>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>Override default for a date or create a special festival layout.</p>
                </div>
                <div
                    onClick={() => setIsFestival(!isFestival)}
                    style={{
                        padding: '10px 18px', borderRadius: '10px', cursor: 'pointer',
                        background: isFestival ? 'var(--primary-color)' : '#1a1a1a',
                        border: `1.5px solid ${isFestival ? 'var(--primary-color)' : '#333'}`,
                        display: 'flex', alignItems: 'center', gap: '10px', transition: '0.2s'
                    }}>
                    <span style={{ fontSize: '1.2rem' }}>🎉</span>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold', color: isFestival ? 'white' : '#888' }}>Festival Mode</p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: isFestival ? '#ffffff99' : '#555' }}>{isFestival ? 'ACTIVE' : 'OFF'}</p>
                    </div>
                </div>
            </div>

            {/* Load from Weekday */}
            <div style={{ background: '#111', padding: '20px', borderRadius: '10px', marginBottom: '25px', borderLeft: '4px solid var(--primary-color)', display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>📋 Load From Weekly Template</label>
                    <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} style={{ width: '100%', padding: '12px', background: '#222', border: '1px solid #444', color: 'white', borderRadius: '8px', fontSize: '1rem' }}>
                        <option value="">-- Select a Weekday --</option>
                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <button type="button" onClick={loadFromDay} style={{ padding: '12px 24px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                    Load ↓
                </button>
            </div>

            <form onSubmit={handlePublish} style={{ marginTop: '25px' }}>
                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Target Date</label>
                        <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} style={{ width: '100%', padding: '12px', marginTop: '8px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: '8px' }} required />
                    </div>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Booking Deadline Date & Time</label>
                        <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ width: '100%', padding: '12px', marginTop: '8px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: '8px' }} required />
                    </div>
                </div>

                {isFestival && (
                    <div style={{ background: '#1a1300', padding: '20px', borderRadius: '12px', border: '1px solid #ff7b0033', marginBottom: '25px' }}>
                        <h4 style={{ margin: '0 0 15px', color: '#ff7b00', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>✨ Festival Details</span>
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                            <div>
                                <label style={{ color: '#888', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>FESTIVAL NAME *</label>
                                <input value={festivalName} onChange={e => setFestivalName(e.target.value)} placeholder="e.g. Holi Special, Diwali Feast" style={{ width: '100%', padding: '10px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: '8px' }} />
                            </div>
                            <div>
                                <label style={{ color: '#888', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>DESCRIPTION (Optional)</label>
                                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Wishing you a very happy Holi..." style={{ width: '100%', padding: '10px', background: '#111', border: '1px solid #333', color: 'white', borderRadius: '8px' }} />
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ padding: '15px', background: '#111', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', borderLeft: '4px solid var(--primary-color)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Daily Cost Preview</span>
                    <span style={{ color: 'var(--success-color)', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        ₹{isFestival
                            ? festItems.reduce((acc, c) => acc + Number(c.price || 0), 0)
                            : getDailyTotal()
                        }
                    </span>
                </div>

                {!isFestival ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
                        {MEALS.map(meal => (
                            <div key={meal} style={{ display: 'flex', justifyContent: 'space-between', background: '#1a1a1a', padding: '15px', borderRadius: '8px', alignItems: 'center' }}>
                                <div style={{ flex: 1, paddingRight: '15px' }}>
                                    <p style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>{meal} {meal.includes('Egg') ? '🥚' : '🌱'}</p>
                                    <input value={items[meal]?.name || ''} onChange={(e) => setItems(p => ({ ...p, [meal]: { ...p[meal], name: e.target.value } }))} style={{ width: '100%', background: '#222', color: 'white', border: '1px solid #444', padding: '10px', borderRadius: '6px' }} placeholder="Item Name" />
                                </div>
                                <div style={{ width: '90px' }}>
                                    <p style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', marginBottom: '8px', textAlign: 'right' }}>Price</p>
                                    <input type="number" value={items[meal]?.price || ''} onChange={(e) => setItems(p => ({ ...p, [meal]: { ...p[meal], price: Number(e.target.value) } }))} style={{ width: '100%', background: '#222', color: 'var(--success-color)', border: '1px solid #444', padding: '10px', borderRadius: '6px', textAlign: 'right' }} placeholder="₹" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>FESTIVAL FOOD ITEMS *</label>
                            <button type="button" onClick={() => setFestItems([...festItems, { domain: 'lunch', name: '', price: '' }])} style={{ background: '#333', color: 'white', border: 'none', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>+ Add Item</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {festItems.map((it, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 100px 40px', gap: '10px', background: '#1a1a1a', padding: '12px', borderRadius: '10px', alignItems: 'flex-end' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: '#555', display: 'block', marginBottom: '4px' }}>DOMAIN</label>
                                        <select value={it.domain} onChange={e => { const n = [...festItems]; n[idx].domain = e.target.value; setFestItems(n); }} style={{ width: '100%', padding: '9px', background: '#222', border: '1px solid #333', color: 'white', borderRadius: '6px' }}>
                                            {DOMAIN_OPTIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: '#555', display: 'block', marginBottom: '4px' }}>ITEM NAME</label>
                                        <input value={it.name} onChange={e => { const n = [...festItems]; n[idx].name = e.target.value; setFestItems(n); }} placeholder="Special Dish" style={{ width: '100%', padding: '9px', background: '#222', border: '1px solid #333', color: 'white', borderRadius: '6px' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: '#555', display: 'block', marginBottom: '4px' }}>PRICE (₹)</label>
                                        <input type="number" value={it.price} onChange={e => { const n = [...festItems]; n[idx].price = e.target.value; setFestItems(n); }} placeholder="₹" style={{ width: '100%', padding: '9px', background: '#222', border: '1px solid #333', color: 'var(--success-color)', borderRadius: '6px', fontWeight: 'bold' }} />
                                    </div>
                                    <button type="button" onClick={() => setFestItems(festItems.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: '1.5rem', padding: '5px' }}>×</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                    <button className="btn-primary" type="submit" style={{ width: 'auto', padding: '12px 30px', fontSize: '1.1rem' }}>Publish / Update Menu</button>
                </div>
            </form>

            {publishedMenus.length > 0 && (
                <div style={{ marginTop: '40px' }}>
                    <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '10px', color: 'var(--text-secondary)' }}>Published Daily Menus</h3>
                    <div style={{ display: 'grid', gap: '15px', marginTop: '15px' }}>
                        {publishedMenus.map(m => (
                            <div key={m.date} style={{ display: 'flex', flexDirection: 'column', gap: '15px', background: '#111', padding: '15px 20px', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <strong style={{ fontSize: '1.2rem', color: 'white' }}>{new Date(m.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</strong>
                                            {m.date === new Date().toISOString().split('T')[0] && <span style={{ background: '#2ed57322', color: '#2ed573', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>TODAY</span>}
                                            {m.date === new Date(Date.now() + 86400000).toISOString().split('T')[0] && <span style={{ background: 'var(--primary-color)22', color: 'var(--primary-color)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>TOMORROW</span>}
                                            {m.isFestival && <span style={{ background: '#ff7b0022', color: '#ff7b00', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>🎉 FESTIVAL</span>}
                                        </div>
                                        <div style={{ color: '#888', fontSize: '0.9rem', marginTop: '5px' }}>
                                            <span style={{ marginRight: '15px', color: new Date(m.deadline) < new Date() ? '#ff4757' : '#888' }}>
                                                {new Date(m.deadline) < new Date() ? '⛔' : '⏱'} Deadline:
                                                <strong style={{ color: '#ddd', marginLeft: '5px' }}>
                                                    {new Date(m.deadline).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </strong>
                                            </span>
                                            <span>💰 Cost: <strong style={{ color: 'var(--success-color)' }}>₹{Object.values(m.items || {}).reduce((acc, curr) => acc + Number(curr.price || 0), 0)}</strong></span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button type="button" onClick={() => { setTargetDate(m.date); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ padding: '6px 16px', background: 'var(--primary-color)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>Edit</button>
                                        <button type="button" onClick={() => handleDelete(m.date)} style={{ padding: '6px 16px', background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>Delete</button>
                                    </div>
                                </div>
                                <div style={{ background: '#1a1a1a', padding: '12px', borderRadius: '6px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {Object.entries(m.items || {}).map(([mealType, details]) => {
                                        if (!details.name || Number(details.price) === 0) return null;
                                        return (
                                            <span key={mealType} style={{ background: '#222', border: '1px solid #333', padding: '4px 10px', borderRadius: '4px', fontSize: '0.85rem', color: '#ccc' }}>
                                                <strong style={{ color: '#aaa' }}>{mealType}:</strong> {details.name} (₹{details.price})
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [profile, setProfile] = useState({ name: localStorage.getItem('name') });
    const [blockModal, setBlockModal] = useState({ isOpen: false, studentId: null, studentName: '', currentlyBlocked: false });

    // Dashboards States
    const [stats, setStats] = useState({ totalStudents: 0, totalBookings: 0, walletCollection: 0, feedbackCount: 0 });
    const [complaints, setComplaints] = useState([]);
    const [students, setStudents] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [analytics, setAnalytics] = useState({ attendance: [] });

    // Menu specific removed for Weekly Menu System

    // Employee Specific
    const [empEmail, setEmpEmail] = useState('');
    const [empName, setEmpName] = useState('');
    const [empPassword, setEmpPassword] = useState('');

    const [selectedBookingDate, setSelectedBookingDate] = useState(() => {
        const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().split('T')[0];
    });

    const navigate = useNavigate();

    useEffect(() => {
        const role = localStorage.getItem('role');
        if (role !== 'Admin') {
            toast.error('Unauthorized access to Admin Dashboard');
            navigate('/login');
            return;
        }
        fetchStats(); fetchComplaints(); fetchStudents(); fetchBookings(); fetchEmployees(); fetchInventory(); fetchAnalytics();

        socket.on('bookingCreated', () => { toast('New meal booked!', { icon: '✅' }); fetchBookings(); fetchStats(); fetchAnalytics(); });
        socket.on('bookingCancelled', () => { fetchBookings(); fetchStats(); fetchAnalytics(); });
        socket.on('complaintAdded', () => { toast('New feedback submitted!', { icon: '⚠️' }); fetchComplaints(); });
        socket.on('complaintUpdated', () => { fetchComplaints(); });
        socket.on('mealCompleted', () => { fetchStats(); fetchAnalytics(); });
        socket.on('employeeAdded', () => { fetchEmployees(); });
        socket.on('employeeRemoved', () => { fetchEmployees(); });
        socket.on('inventoryUpdated', () => { fetchInventory(); });
        socket.on('stockRequested', () => { toast('Store manager requested stock!', { icon: '📦' }); });

        return () => {
            socket.off('bookingCreated');
            socket.off('bookingCancelled');
            socket.off('complaintAdded');
            socket.off('complaintUpdated');
            socket.off('mealCompleted');
            socket.off('employeeAdded');
            socket.off('employeeRemoved');
            socket.off('inventoryUpdated');
            socket.off('stockRequested');
        };
    }, []);

    const fetchStats = async () => { try { const { data } = await api.get('/admin/dashboard'); setStats(data); } catch (e) { } };
    const fetchComplaints = async () => { try { const { data } = await api.get('/admin/complaints'); setComplaints(data); } catch (e) { } };
    const fetchStudents = async () => { try { const { data } = await api.get('/admin/students'); setStudents(data); } catch (e) { } };
    const handleBlockStudent = (id, name, currentlyBlocked) => {
        setBlockModal({ isOpen: true, studentId: id, studentName: name, currentlyBlocked });
    };

    const confirmBlockStudent = async () => {
        try {
            const { data } = await api.put(`/admin/students/${blockModal.studentId}/block`);
            toast.success(data.message);
            fetchStudents();
            setBlockModal({ isOpen: false, studentId: null, studentName: '', currentlyBlocked: false });
        } catch (err) { toast.error(err.response?.data?.message || 'Action failed'); }
    };
    const fetchBookings = async () => { try { const { data } = await api.get('/admin/bookings'); setBookings(data); } catch (e) { } };
    const fetchEmployees = async () => { try { const { data } = await api.get('/admin/employees'); setEmployees(data); } catch (e) { } };
    const fetchInventory = async () => { try { const { data } = await api.get('/store/inventory'); setInventory(data); } catch (e) { } };
    const fetchAnalytics = async () => { try { const { data } = await api.get('/admin/analytics'); setAnalytics(data); } catch (e) { } };

    const handleCreateEmployee = async (e) => {
        e.preventDefault();
        try { await api.post('/admin/employees', { email: empEmail, name: empName, password: empPassword }); toast.success('Employee created'); fetchEmployees(); setEmpEmail(''); setEmpName(''); setEmpPassword(''); }
        catch (err) { toast.error('Creation failed'); }
    }

    // Weekly override handles the global array saving instead of manual daily

    const handleResolveComplaint = async (id) => {
        try { await api.put(`/admin/complaints/${id}/resolve`); toast.success('Resolved!'); fetchComplaints(); } catch (err) { }
    };

    const handleRemoveEmployee = async (id) => {
        if (!window.confirm('Are you sure you want to revoke this employee?')) return;
        try { await api.delete(`/admin/employees/${id}`); toast.success('Employee Removed'); fetchEmployees(); }
        catch (err) { toast.error('Failed to remove employee'); }
    };

    const handleLogout = () => { localStorage.clear(); navigate('/login'); };

    const TABS = [
        { id: 'dashboard', label: 'Dashboard', icon: <FaHome /> },
        { id: 'weekly', label: 'Weekly Base Plan', icon: <FaClipboardList /> },
        { id: 'daily', label: 'Set Daily Menu', icon: <FaUtensils /> },
        { id: 'polls', label: 'Poll Management', icon: <FaPoll /> },
        { id: 'bookings', label: 'Bookings', icon: <FaCalendarCheck /> },
        { id: 'students', label: 'Students', icon: <FaUserGraduate /> },
        { id: 'employees', label: 'Employees', icon: <FaUserTie /> },
        { id: 'store', label: 'Store Mgmt', icon: <FaStore /> },
        { id: 'wallet', label: 'Wallet', icon: <FaWallet /> },
        { id: 'badges', label: 'Badges & Rewards', icon: <FaAward /> },
        { id: 'feedback', label: 'Feedbacks', icon: <FaComments /> },
        { id: 'analytics', label: 'Analytics', icon: <FaChartPie /> },
        { id: 'settings', label: 'Settings', icon: <FaCog /> },
    ];

    const pieColors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
    const dummyPie = [{ name: 'Lunch', value: 400 }, { name: 'Dinner', value: 300 }, { name: 'Tiffin', value: 300 }, { name: 'Snacks', value: 200 }];

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                            <div className="stat-card" style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', borderLeft: '4px solid var(--primary-color)' }}>
                                <h4 style={{ color: 'var(--text-secondary)' }}>Total Students</h4>
                                <h1 style={{ color: 'white', marginTop: '10px' }}>{stats.totalStudents}</h1>
                            </div>
                            <div className="stat-card" style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #2ed573' }}>
                                <h4 style={{ color: 'var(--text-secondary)' }}>Bookings Today</h4>
                                <h1 style={{ color: 'white', marginTop: '10px' }}>{stats.totalBookings}</h1>
                            </div>
                            <div className="stat-card" style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #1e90ff' }}>
                                <h4 style={{ color: 'var(--text-secondary)' }}>Wallet Collection</h4>
                                <h1 style={{ color: 'white', marginTop: '10px' }}>₹{stats.walletCollection}</h1>
                            </div>
                            <div className="stat-card" style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #ff4757' }}>
                                <h4 style={{ color: 'var(--text-secondary)' }}>Pending Complaints</h4>
                                <h1 style={{ color: 'white', marginTop: '10px' }}>{complaints.filter(c => c.status === 'Pending').length}</h1>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
                            <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px' }}>
                                <h3>Weekly Attendance Trends</h3>
                                <div style={{ height: '300px', marginTop: '20px' }}>
                                    {analytics.attendance?.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={analytics.attendance}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                                <XAxis dataKey="name" stroke="#a0a0a0" />
                                                <YAxis stroke="#a0a0a0" />
                                                <Tooltip contentStyle={{ background: '#1e1e1e', border: 'none' }} />
                                                <Bar dataKey="lunch" fill="var(--primary-color)" />
                                                <Bar dataKey="dinner" fill="#2ed573" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : <p style={{ color: 'var(--text-secondary)' }}>Loading analytics...</p>}
                                </div>
                            </div>
                            <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: '12px' }}>
                                <h3>Meal Distribution</h3>
                                <div style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={dummyPie} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                {dummyPie.map((entry, index) => <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />)}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: '#1e1e1e', border: 'none' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'weekly':
                return <WeeklyMenuManager />;
            case 'daily':
                return <DailyMenuManager />;
            case 'polls':
                return <PollManager />;
            case 'badges':
                return <BadgeManager />;
            case 'students':
                return (
                    <div style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: '12px' }}>
                        <h3>Student Master List</h3>
                        <table style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#333', textAlign: 'left' }}>
                                    <th style={{ padding: '15px' }}>Name</th>
                                    <th style={{ padding: '15px' }}>Student ID</th>
                                    <th style={{ padding: '15px' }}>Email</th>
                                    <th style={{ padding: '15px' }}>Wallet</th>
                                    <th style={{ padding: '15px' }}>Status</th>
                                    <th style={{ padding: '15px' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(s => {
                                    const blocked = s.isBlocked;
                                    return (
                                    <tr key={s._id} style={{ borderBottom: '1px solid #333', opacity: blocked ? 0.6 : 1 }}>
                                        <td style={{ padding: '15px' }}>{s.name}</td>
                                        <td style={{ padding: '15px' }}>{s.studentId}</td>
                                        <td style={{ padding: '15px' }}>{s.email}</td>
                                        <td style={{ padding: '15px', color: 'var(--success-color)' }}>₹{s.walletBalance}</td>
                                        <td style={{ padding: '15px' }}>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold',
                                                background: blocked ? '#e74c3c22' : '#2ecc7122',
                                                color: blocked ? '#e74c3c' : '#2ecc71',
                                                border: `1px solid ${blocked ? '#e74c3c55' : '#2ecc7155'}`
                                            }}>
                                                {blocked ? '🚫 Blocked' : '✅ Active'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px' }}>
                                            <button
                                                onClick={() => handleBlockStudent(s._id, s.name, blocked)}
                                                style={{
                                                    background: blocked ? 'var(--success-color)' : 'var(--danger-color)',
                                                    border: 'none', color: 'white', padding: '6px 14px',
                                                    borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem'
                                                }}>
                                                {blocked ? '🔓 Unblock' : '🔒 Block'}
                                            </button>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            case 'bookings':
                const filteredBookings = (bookings || []).filter(b => b.date === selectedBookingDate);
                const domainCounts = MEALS.reduce((acc, m) => {
                    let totalItems = 0;
                    filteredBookings.forEach(b => {
                        const regex = new RegExp('^' + m + '(?:\\s+x\\d+)?$');
                        const match = (b.meals || []).find(mealStr => regex.test(mealStr));
                        if (match) {
                            const qtyMatch = match.match(/x(\d+)/);
                            const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
                            totalItems += qty;
                        }
                    });
                    acc[m] = totalItems;
                    return acc;
                }, {});

                return (
                    <div style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
                            <div>
                                <h3 style={{ margin: 0 }}>📊 Booking Summary</h3>
                                <p style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>Domain-wise counts for the selected date.</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    onClick={() => setSelectedBookingDate(new Date().toISOString().split('T')[0])}
                                    style={{ padding: '8px 15px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}
                                >Today</button>
                                <input
                                    type="date"
                                    value={selectedBookingDate}
                                    onChange={(e) => setSelectedBookingDate(e.target.value)}
                                    style={{ padding: '10px', background: '#222', border: '1px solid #444', color: 'white', borderRadius: '8px' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                            {MEALS.map(meal => (
                                <div key={meal} style={{ background: '#111', padding: '15px', borderRadius: '10px', borderTop: `3px solid ${MEAL_COLORS[meal] || '#333'}` }}>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>{meal}</p>
                                    <h2 style={{ margin: '10px 0 0', color: domainCounts[meal] > 0 ? 'var(--primary-color)' : '#444' }}>{domainCounts[meal]}</h2>
                                </div>
                            ))}
                        </div>

                        <div style={{ borderTop: '1px solid #333', paddingTop: '25px' }}>
                            <h3 style={{ marginBottom: '20px' }}>Detailed Register ({filteredBookings.length})</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#111', textAlign: 'left' }}>
                                            <th style={{ padding: '15px' }}>Date</th>
                                            <th style={{ padding: '15px' }}>Student / Guest Name</th>
                                            <th style={{ padding: '15px' }}>Meals Ordered</th>
                                            <th style={{ padding: '15px' }}>Paid Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBookings.length > 0 ? (
                                            filteredBookings.map(b => (
                                                <tr key={b._id} style={{ borderBottom: '1px solid #333' }}>
                                                    <td style={{ padding: '15px' }}>{b.date}</td>
                                                    <td style={{ padding: '15px' }}>
                                                        <div style={{ fontWeight: 'bold' }}>{b.studentName || 'Guest User'}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{b.studentRollId || 'GUEST-ID'}</div>
                                                    </td>
                                                    <td style={{ padding: '15px' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                                            {b.meals.map(m => (
                                                                <span key={m} style={{ background: '#222', padding: '3px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>{m}</span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '15px', color: 'var(--success-color)', fontWeight: 'bold' }}>₹{b.price}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#555' }}>No bookings found for the selected date.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'feedback':
                return (
                    <div style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: '12px' }}>
                        <h3>Feedback & Complaints</h3>
                        <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
                            {complaints.map(cp => (
                                <div key={cp._id} style={{ background: '#111', padding: '20px', borderRadius: '8px', borderLeft: cp.status === 'Resolved' ? '4px solid var(--success-color)' : '4px solid var(--danger-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <h4 style={{ margin: 0 }}>{cp.topic}</h4>
                                            {cp.badge && cp.badge !== 'none' && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#333', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>
                                                    <BadgeIcon badge={cp.badge} size={12} />
                                                    <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{cp.badge} Priority</span>
                                                </div>
                                            )}
                                        </div>
                                        <span>Status: {cp.status}</span>
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', margin: '15px 0' }}>{cp.description}</p>
                                    {cp.imageBase64 && <img src={cp.imageBase64} alt="Complaint" style={{ maxWidth: '200px', borderRadius: '8px', marginBottom: '15px' }} />}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.9rem', color: '#888' }}>
                                            <span>By: {cp.studentName} | 👍 {cp.likes} Likes</span>
                                        </div>
                                        {cp.status === 'Pending' && <button onClick={() => handleResolveComplaint(cp._id)} className="btn-primary" style={{ width: 'auto', background: 'var(--success-color)', fontSize: '0.9rem' }}>Mark Resolved</button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            // Default catches employees, inventory, analytics etc. I will implement Employees briefly.
            case 'employees':
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: '12px' }}>
                            <h3>Current Staff Roster</h3>
                            {employees.map(e => (
                                <div key={e._id} style={{ background: '#222', padding: '15px', borderRadius: '8px', marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div><strong>{e.name}</strong><p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{e.email}</p></div>
                                    <button onClick={() => handleRemoveEmployee(e._id)} style={{ color: 'var(--danger-color)', background: 'transparent', border: '1px solid var(--danger-color)', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Revoke</button>
                                </div>
                            ))}
                        </div>
                        <div style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: '12px', alignSelf: 'start' }}>
                            <h3>Onboard New Employee</h3>
                            <form onSubmit={handleCreateEmployee} style={{ marginTop: '20px' }}>
                                <div className="form-group"><label>Full Name</label><input type="text" value={empName} onChange={e => setEmpName(e.target.value)} required style={{ width: '100%', padding: '10px' }} /></div>
                                <div className="form-group"><label>Email</label><input type="email" value={empEmail} onChange={e => setEmpEmail(e.target.value)} required style={{ width: '100%', padding: '10px' }} /></div>
                                <div className="form-group"><label>Start Password</label><input type="password" value={empPassword} onChange={e => setEmpPassword(e.target.value)} required style={{ width: '100%', padding: '10px' }} /></div>
                                <button className="btn-primary" type="submit">Create Employee Account</button>
                            </form>
                        </div>
                    </div>
                );
            case 'wallet':
                return <WalletManager />;
            default:
                return <div style={{ background: 'var(--surface-color)', padding: '40px', borderRadius: '12px', textAlign: 'center' }}><h3>Module Currently Under Maintenance</h3><p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>The {activeTab} module is partially built in this demo.</p></div>;
        }
    };

    return (
        <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: '#050505', fontFamily: 'Inter' }}>

            {/* SAAS SIDEBAR */}
            <div className="sidebar" style={{ width: '280px', background: '#121212', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '30px 25px' }}>
                    <h2 style={{ color: 'var(--primary-color)', fontSize: '1.6rem', fontWeight: '900', letterSpacing: '-0.5px' }}>Admin<span style={{ color: 'white' }}>Panel</span></h2>
                </div>

                <div style={{ flex: 1, padding: '0 15px', overflowY: 'auto' }}>
                    <p style={{ color: '#555', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '15px', paddingLeft: '10px' }}>Main Menu</p>
                    {TABS.map(tab => (
                        <div
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '15px', padding: '14px 15px', marginBottom: '5px',
                                borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s ease',
                                background: activeTab === tab.id ? 'var(--primary-color)' : 'transparent',
                                color: activeTab === tab.id ? 'white' : '#999',
                                fontWeight: activeTab === tab.id ? '600' : 'normal'
                            }}
                            onMouseOver={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = 'white'; } }}
                            onMouseOut={(e) => { if (activeTab !== tab.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#999'; } }}
                        >
                            {React.cloneElement(tab.icon, { size: 18 })}
                            <span style={{ fontSize: '1rem' }}>{tab.label}</span>
                        </div>
                    ))}
                </div>

                <div style={{ padding: '20px', borderTop: '1px solid #222' }}>
                    <div onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 15px', color: 'var(--danger-color)', cursor: 'pointer', borderRadius: '10px', transition: '0.2s', fontWeight: '600' }}>
                        <FaSignOutAlt size={18} /><span>Logout</span>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: '100vh' }}>

                {/* TOP NAVBAR */}
                <div style={{ height: '80px', display: 'flex', alignItems: 'center', padding: '0 40px', justifyContent: 'space-between', borderBottom: '1px solid #222', background: '#0a0a0a' }}>
                    <h2 style={{ textTransform: 'capitalize', fontWeight: '600' }}>{TABS.find(t => t.id === activeTab)?.label}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                        <div style={{ position: 'relative', cursor: 'pointer' }}>
                            <FaBell size={22} color="#a0a0a0" />
                            {complaints.some(c => c.status === 'Pending') && <div style={{ position: 'absolute', top: '-5px', right: '-5px', width: '10px', height: '10px', background: 'var(--danger-color)', borderRadius: '50%' }}></div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--primary-color), #ff4757)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>A</div>
                            <div>
                                <h4 style={{ fontSize: '0.95rem' }}>{profile.name}</h4>
                                <p style={{ fontSize: '0.8rem', color: '#888' }}>Super Admin</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* DYNAMIC VIEW */}
                <div style={{ padding: '40px' }}>
                    {renderContent()}
                </div>
            </div>

            {blockModal.isOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}>
                    <div style={{ background: 'var(--surface-color)', padding: '30px', borderRadius: '12px', width: '400px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '15px' }}>{blockModal.currentlyBlocked ? '🔓' : '🚫'}</div>
                        <h3 style={{ marginBottom: '10px' }}>{blockModal.currentlyBlocked ? 'Unblock Student' : 'Block Student'}</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '25px' }}>Are you sure you want to {blockModal.currentlyBlocked ? 'unblock' : 'block'} <strong>{blockModal.studentName}</strong>?</p>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                            <button onClick={() => setBlockModal({ isOpen: false, studentId: null, studentName: '', currentlyBlocked: false })} style={{ padding: '10px 20px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', flex: 1, fontWeight: 'bold' }}>Cancel</button>
                            <button onClick={confirmBlockStudent} style={{ padding: '10px 20px', background: blockModal.currentlyBlocked ? 'var(--success-color)' : 'var(--danger-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', flex: 1, fontWeight: 'bold' }}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
