import React, { useState, useEffect, useCallback } from 'react';
import {
    FaUserGraduate, FaUtensils, FaCheckCircle, FaClock, FaRupeeSign, FaStar,
    FaChartBar, FaComments, FaPoll, FaAward, FaWallet, FaExclamationTriangle,
    FaHeartbeat, FaFire, FaBolt, FaMedal, FaGem, FaTrophy, FaUserTie,
    FaBell, FaShieldAlt, FaArrowUp, FaArrowDown, FaSync, FaCalendarDay,
    FaConciergeBell, FaCoffee, FaEgg, FaMoon, FaLeaf
} from 'react-icons/fa';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from 'recharts';
import api from '../services/api';
import { socket } from '../socket';
import toast from 'react-hot-toast';

const MEAL_ICONS = {
    'Morning Tea/Milk': <FaCoffee />, 'Morning Egg': <FaEgg />, 'Morning Banana': <FaCoffee />, 'Tiffin': <FaUtensils />,
    'Lunch Veg': <FaConciergeBell />, 'Lunch Non-Veg': <FaConciergeBell />, 'Lunch Egg': <FaEgg />, 'Evening Tea/Milk': <FaCoffee />,
    'Snacks': <FaLeaf />, 'Dinner Veg': <FaMoon />, 'Dinner Non-Veg': <FaMoon />, 'Dinner Egg': <FaEgg />
};

const MEAL_COLORS = {
    'Morning Tea/Milk': '#f59e0b', 'Morning Egg': '#ef4444', 'Morning Banana': '#ffeb3b', 'Tiffin': '#8b5cf6',
    'Lunch Veg': '#10b981', 'Lunch Non-Veg': '#f97316', 'Lunch Egg': '#ef4444', 'Evening Tea/Milk': '#f59e0b',
    'Snacks': '#f97316', 'Dinner Veg': '#3b82f6', 'Dinner Non-Veg': '#8b5cf6', 'Dinner Egg': '#ef4444'
};

const PIE_COLORS = ['#f97316', '#10b981', '#f59e0b', '#3b82f6'];
const BADGE_CONFIG = {
    diamond: { icon: <FaGem />, color: '#06b6d4', label: 'Diamond' },
    gold: { icon: <FaTrophy />, color: '#f59e0b', label: 'Gold' },
    silver: { icon: <FaMedal />, color: '#94a3b8', label: 'Silver' }
};

const SummaryCard = ({ icon, label, value, trend, trendLabel, accent, isDark }) => {
    const isPositive = trend >= 0;
    return (
        <div style={{
            background: isDark ? '#16161a' : '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderTop: `4px solid ${accent}`,
            boxShadow: isDark ? 'none' : '0 4px 16px rgba(0,0,0,0.06)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'default'
        }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 32px ${accent}22`; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isDark ? 'none' : '0 4px 16px rgba(0,0,0,0.06)'; }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: `${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, fontSize: '1.3rem' }}>
                    {icon}
                </div>
                {trend !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', background: isPositive ? '#10b98120' : '#ef444420', color: isPositive ? '#10b981' : '#ef4444', fontSize: '0.78rem', fontWeight: '700' }}>
                        {isPositive ? <FaArrowUp size={10} /> : <FaArrowDown size={10} />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <div style={{ marginTop: '20px' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: '800', lineHeight: 1, color: isDark ? '#f3f4f6' : '#1e293b' }}>{value}</div>
                <div style={{ marginTop: '8px', fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '500' }}>{label}</div>
                {trendLabel && <div style={{ marginTop: '4px', fontSize: '0.75rem', color: isDark ? '#64748b' : '#94a3b8' }}>{trendLabel}</div>}
            </div>
        </div>
    );
};

const SectionTitle = ({ icon, title, subtitle, isDark }) => (
    <div style={{ marginBottom: '20px' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: '700', color: isDark ? '#f3f4f6' : '#1e293b', margin: 0 }}>
            <span style={{ color: 'var(--primary-color)' }}>{icon}</span> {title}
        </h2>
        {subtitle && <p style={{ margin: '5px 0 0', fontSize: '0.85rem', color: isDark ? '#64748b' : '#94a3b8' }}>{subtitle}</p>}
    </div>
);

const Card = ({ children, style = {}, isDark }) => (
    <div style={{
        background: isDark ? '#16161a' : '#ffffff',
        borderRadius: '16px',
        padding: '24px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: isDark ? 'none' : '0 4px 16px rgba(0,0,0,0.05)',
        ...style
    }}>
        {children}
    </div>
);

const AdminOverview = ({ isDark, onNavigate }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [liveCount, setLiveCount] = useState(0);

    const fetchOverview = useCallback(async () => {
        try {
            const res = await api.get('/admin/overview');
            setData(res.data);
            setLastUpdated(new Date());
        } catch (e) {
            console.error('Overview fetch failed', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOverview();

        const handleUpdate = () => {
            fetchOverview();
            setLiveCount(p => p + 1);
        };

        socket.on('bookingCreated', handleUpdate);
        socket.on('bookingCancelled', handleUpdate);
        socket.on('mealCompleted', handleUpdate);
        socket.on('complaintAdded', handleUpdate);
        socket.on('mealStatusUpdate', handleUpdate);

        return () => {
            socket.off('bookingCreated', handleUpdate);
            socket.off('bookingCancelled', handleUpdate);
            socket.off('mealCompleted', handleUpdate);
            socket.off('complaintAdded', handleUpdate);
            socket.off('mealStatusUpdate', handleUpdate);
        };
    }, [fetchOverview]);

    const textColor = isDark ? '#f3f4f6' : '#1e293b';
    const subText = isDark ? '#94a3b8' : '#64748b';
    const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const cardBg = isDark ? '#16161a' : '#ffffff';
    const surfaceBg = isDark ? '#0f0f12' : '#f8fafc';
    const gridColor = isDark ? '#1e1e24' : '#f1f5f9';
    const axisColor = isDark ? '#475569' : '#94a3b8';
    const tooltipBg = isDark ? '#1e1e28' : '#ffffff';

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: '4px solid var(--primary-color)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: subText, fontSize: '1rem' }}>Loading dashboard overview...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    const s = data?.summary || {};
    const bookingTrend = s.yesterdayBookings > 0 ? Math.round(((s.totalBookingsToday - s.yesterdayBookings) / s.yesterdayBookings) * 100) : 0;
    const revTrend = s.yesterdayRevenue > 0 ? Math.round(((s.todayRevenue - s.yesterdayRevenue) / s.yesterdayRevenue) * 100) : 0;
    const health = data?.healthScore || 0;
    const healthColor = health >= 80 ? '#10b981' : health >= 60 ? '#f59e0b' : '#ef4444';
    const healthLabel = health >= 80 ? 'Excellent' : health >= 60 ? 'Good' : 'Needs Attention';

    return (
        <div style={{ color: textColor, fontFamily: "'Inter', sans-serif" }}>

            {/* ── Live Status Bar ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', padding: '14px 20px', background: isDark ? '#16161a' : '#ffffff', borderRadius: '12px', border: `1px solid ${borderColor}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 3px #10b98130' }} />
                    <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>Live Dashboard</span>
                    <span style={{ fontSize: '0.8rem', color: subText }}>Auto-refreshes every 60s</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {liveCount > 0 && (
                        <div style={{ padding: '4px 12px', background: '#f9731620', color: '#f97316', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700' }}>
                            <FaBolt style={{ marginRight: '5px' }} />{liveCount} live updates
                        </div>
                    )}
                    <div style={{ fontSize: '0.8rem', color: subText }}>
                        Updated {lastUpdated.toLocaleTimeString()}
                    </div>
                    <button onClick={fetchOverview} style={{ background: 'transparent', border: `1px solid ${borderColor}`, color: subText, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        <FaSync /> Refresh
                    </button>
                </div>
            </div>

            {/* ── 1. TOP SUMMARY CARDS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '18px', marginBottom: '32px' }}>
                <SummaryCard isDark={isDark} icon={<FaUserGraduate />} label="Total Students" value={s.totalStudents || 0} accent="#3b82f6" />
                <SummaryCard isDark={isDark} icon={<FaUtensils />} label="Today's Bookings" value={s.totalBookingsToday || 0} trend={bookingTrend} trendLabel={`Yesterday: ${s.yesterdayBookings}`} accent="#f97316" />
                <SummaryCard isDark={isDark} icon={<FaCheckCircle />} label="Meals Completed" value={s.mealsCompleted || 0} accent="#10b981" />
                <SummaryCard isDark={isDark} icon={<FaClock />} label="Meals Pending" value={s.mealsPending || 0} accent="#ef4444" />
                <SummaryCard isDark={isDark} icon={<FaRupeeSign />} label="Today's Revenue" value={`₹${s.todayRevenue || 0}`} trend={revTrend} trendLabel={`Yesterday: ₹${s.yesterdayRevenue}`} accent="#8b5cf6" />
                <SummaryCard isDark={isDark} icon={<FaStar />} label="Avg Feedback Rating" value={`${s.avgRating || 0}/5`} accent="#f59e0b" />
            </div>

            {/* ── 2. SYSTEM HEALTH SCORE ── */}
            <Card isDark={isDark} style={{ marginBottom: '32px', padding: '28px 32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: subText, marginBottom: '8px' }}>System Health Score</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '4rem', fontWeight: '900', color: healthColor, lineHeight: 1 }}>{health}</span>
                            <span style={{ fontSize: '1.5rem', color: subText }}>%</span>
                        </div>
                        <div style={{ marginTop: '8px', padding: '4px 14px', background: `${healthColor}20`, color: healthColor, borderRadius: '20px', display: 'inline-block', fontSize: '0.85rem', fontWeight: '700' }}>
                            {healthLabel}
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ height: '12px', background: isDark ? '#1e1e24' : '#f1f5f9', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
                            <div style={{ width: `${health}%`, height: '100%', background: `linear-gradient(90deg, ${healthColor}, ${healthColor}cc)`, borderRadius: '10px', transition: 'width 1s ease' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            {[
                                { label: 'Completion Rate', value: s.totalBookingsToday > 0 ? `${Math.round(s.mealsCompleted / s.totalBookingsToday * 100)}%` : '100%', color: '#10b981' },
                                { label: 'Feedback Score', value: `${s.avgRating || 0}/5`, color: '#f59e0b' },
                                { label: 'Pending Issues', value: data?.alerts?.pendingComplaints || 0, color: '#ef4444' }
                            ].map(item => (
                                <div key={item.label} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: '800', color: item.color }}>{item.value}</div>
                                    <div style={{ fontSize: '0.75rem', color: subText, marginTop: '4px' }}>{item.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {/* ── 3. MEAL BREAKDOWN TABLE ── */}
            <Card isDark={isDark} style={{ marginBottom: '32px' }}>
                <SectionTitle isDark={isDark} icon={<FaUtensils />} title="Today's Meal Breakdown" subtitle={`Live status for ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`} />
                <div style={{ overflowX: 'auto', borderRadius: '10px', border: `1px solid ${borderColor}` }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: isDark ? '#0f0f12' : '#f8fafc' }}>
                                {['Meal Section', 'Booked', 'Completed', 'Pending', 'Progress'].map(h => (
                                    <th key={h} style={{ padding: '14px 18px', textAlign: 'left', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: subText, borderBottom: `1px solid ${borderColor}` }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.mealBreakdown || []).map((row, i) => {
                                const pct = row.booked > 0 ? Math.round(row.completed / row.booked * 100) : 0;
                                const accent = MEAL_COLORS[row.meal] || '#94a3b8';
                                return (
                                    <tr key={row.meal} style={{ borderBottom: i < data.mealBreakdown.length - 1 ? `1px solid ${borderColor}` : 'none', transition: 'background 0.15s' }}
                                        onMouseOver={e => e.currentTarget.style.background = isDark ? '#1a1a20' : '#f8fafc'}
                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '14px 18px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: `${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, fontSize: '0.9rem' }}>
                                                    {MEAL_ICONS[row.meal]}
                                                </div>
                                                <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{row.meal}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 18px', fontWeight: '700', fontSize: '1rem' }}>{row.booked}</td>
                                        <td style={{ padding: '14px 18px' }}>
                                            <span style={{ color: '#10b981', fontWeight: '700', fontSize: '1rem' }}>{row.completed}</span>
                                        </td>
                                        <td style={{ padding: '14px 18px' }}>
                                            <span style={{ color: row.pending > 0 ? '#ef4444' : '#10b981', fontWeight: '700', fontSize: '1rem' }}>{row.pending}</span>
                                        </td>
                                        <td style={{ padding: '14px 18px', minWidth: '140px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ flex: 1, height: '8px', background: isDark ? '#1e1e24' : '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#10b981' : pct > 50 ? '#f59e0b' : accent, borderRadius: '10px', transition: 'width 0.8s ease' }} />
                                                </div>
                                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: subText, minWidth: '34px' }}>{pct}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* ── 4. ANALYTICS CHARTS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '20px', marginBottom: '32px' }}>
                {/* Weekly Bookings Bar Chart */}
                <Card isDark={isDark}>
                    <SectionTitle isDark={isDark} icon={<FaChartBar />} title="Weekly Bookings" subtitle="Last 7 days booking volume" />
                    <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.weeklyChart || []} barSize={28}>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                <XAxis dataKey="day" stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis stroke={axisColor} tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${borderColor}`, borderRadius: '10px', color: textColor }} cursor={{ fill: isDark ? '#ffffff08' : '#00000008' }} />
                                <Bar dataKey="bookings" fill="var(--primary-color)" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Meal Distribution Pie */}
                <Card isDark={isDark}>
                    <SectionTitle isDark={isDark} icon={<FaConciergeBell />} title="Meal Distribution" subtitle="Today's breakdown" />
                    <div style={{ height: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={data?.mealDistribution || []} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={4} dataKey="value">
                                    {(data?.mealDistribution || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${borderColor}`, borderRadius: '10px', color: textColor }} />
                                <Legend wrapperStyle={{ fontSize: '0.82rem', color: subText }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* ── 5. LIVE OPERATIONS + MENU STATUS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                {/* Live Operations */}
                <Card isDark={isDark}>
                    <SectionTitle isDark={isDark} icon={<FaBolt />} title="Live Operations" subtitle="Real-time meal activity" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {[
                            { icon: '🕐', label: 'Students with pending meals', value: s.mealsPending || 0, color: '#f97316' },
                            { icon: '✅', label: 'Meals completed today', value: s.mealsCompleted || 0, color: '#10b981' },
                            { icon: '📋', label: 'Active bookings today', value: s.totalBookingsToday || 0, color: '#3b82f6' },
                            { icon: '⚠️', label: 'Unresolved complaints', value: data?.feedbackSummary?.pendingCount || 0, color: '#ef4444' },
                        ].map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: isDark ? '#0f0f12' : '#f8fafc', borderRadius: '10px', border: `1px solid ${borderColor}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
                                    <span style={{ fontSize: '0.9rem', color: subText }}>{item.label}</span>
                                </div>
                                <span style={{ fontSize: '1.4rem', fontWeight: '800', color: item.color }}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Today's Menu Status */}
                <Card isDark={isDark}>
                    <SectionTitle isDark={isDark} icon={<FaCalendarDay />} title="Today's Menu Status" />
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>{data?.menuStatus === 'Published' ? '✅' : '❌'}</div>
                        <div style={{ padding: '8px 24px', borderRadius: '30px', display: 'inline-block', background: data?.menuStatus === 'Published' ? '#10b98120' : '#ef444420', color: data?.menuStatus === 'Published' ? '#10b981' : '#ef4444', fontWeight: '700', fontSize: '1rem', marginBottom: '20px' }}>
                            {data?.menuStatus || 'Not Published'}
                        </div>
                        {data?.todayMenu ? (
                            <div style={{ textAlign: 'left', marginTop: '16px' }}>
                                <div style={{ fontSize: '0.8rem', color: subText, fontWeight: '600', marginBottom: '10px', textTransform: 'uppercase' }}>Today's Items</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {Object.entries(data.todayMenu.items || {}).filter(([_, v]) => v.name).slice(0, 6).map(([meal, item]) => (
                                        <span key={meal} style={{ padding: '5px 12px', background: `${MEAL_COLORS[meal] || '#94a3b8'}20`, color: MEAL_COLORS[meal] || subText, borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600' }}>
                                            {item.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p style={{ color: subText, fontSize: '0.9rem', marginTop: '10px' }}>No menu published for today.</p>
                        )}
                        <button onClick={() => onNavigate?.('daily')} style={{ marginTop: '20px', padding: '10px 24px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>
                            {data?.menuStatus === 'Published' ? 'Edit Menu' : 'Publish Menu'}
                        </button>
                    </div>
                </Card>
            </div>

            {/* ── 6. EMPLOYEE PERFORMANCE ── */}
            <Card isDark={isDark} style={{ marginBottom: '32px' }}>
                <SectionTitle isDark={isDark} icon={<FaUserTie />} title="Employee Performance" subtitle="Meals served by each employee" />
                {(data?.employeePerformance || []).length === 0 ? (
                    <p style={{ color: subText, textAlign: 'center', padding: '20px' }}>No employees found.</p>
                ) : (
                    <div style={{ overflowX: 'auto', borderRadius: '10px', border: `1px solid ${borderColor}` }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: isDark ? '#0f0f12' : '#f8fafc' }}>
                                    {['Employee', 'Email', 'Meals Served', 'Status'].map(h => (
                                        <th key={h} style={{ padding: '14px 18px', textAlign: 'left', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', color: subText, borderBottom: `1px solid ${borderColor}` }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.employeePerformance || []).map((emp, i) => (
                                    <tr key={i} style={{ borderBottom: i < data.employeePerformance.length - 1 ? `1px solid ${borderColor}` : 'none' }}>
                                        <td style={{ padding: '14px 18px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-color), #ff6b6b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '0.9rem' }}>
                                                    {emp.name.charAt(0)}
                                                </div>
                                                <span style={{ fontWeight: '600' }}>{emp.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 18px', color: subText, fontSize: '0.85rem' }}>{emp.email}</td>
                                        <td style={{ padding: '14px 18px', fontWeight: '700', color: '#10b981', fontSize: '1.1rem' }}>{emp.mealsServed}</td>
                                        <td style={{ padding: '14px 18px' }}>
                                            <span style={{ padding: '4px 12px', borderRadius: '20px', background: '#10b98120', color: '#10b981', fontSize: '0.78rem', fontWeight: '700' }}>Active</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* ── 7 + 8 + 9. FEEDBACK + POLL + BADGES ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', marginBottom: '32px' }}>
                {/* Feedback Summary */}
                <Card isDark={isDark}>
                    <SectionTitle isDark={isDark} icon={<FaComments />} title="Feedback Summary" />
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', paddingBottom: '20px', borderBottom: `1px solid ${borderColor}` }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#f59e0b' }}>{data?.feedbackSummary?.avgRating || 0}</div>
                            <div style={{ fontSize: '0.8rem', color: subText }}>Average Rating</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '3px', marginTop: '6px' }}>
                                {[1, 2, 3, 4, 5].map(n => <FaStar key={n} size={14} color={n <= Math.round(data?.feedbackSummary?.avgRating || 0) ? '#f59e0b' : (isDark ? '#2d2d34' : '#e2e8f0')} />)}
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#ef4444' }}>{data?.feedbackSummary?.pendingCount || 0}</div>
                            <div style={{ fontSize: '0.8rem', color: subText }}>Pending Reviews</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ fontSize: '0.8rem', color: subText, fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Latest Complaints</div>
                        {(data?.feedbackSummary?.latest || []).slice(0, 4).map(fb => (
                            <div key={fb.id} style={{ padding: '12px 14px', background: isDark ? '#0f0f12' : '#f8fafc', borderRadius: '10px', borderLeft: `3px solid ${fb.status === 'Resolved' ? '#10b981' : '#f97316'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{fb.studentName}</span>
                                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', background: fb.status === 'Resolved' ? '#10b98120' : '#f9731620', color: fb.status === 'Resolved' ? '#10b981' : '#f97316' }}>{fb.status}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.82rem', color: subText }}>{fb.message}</p>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => onNavigate?.('feedback')} style={{ marginTop: '16px', width: '100%', padding: '10px', background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: '10px', color: subText, cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem' }}>
                        View All Feedback →
                    </button>
                </Card>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Poll Status */}
                    <Card isDark={isDark} style={{ flex: 1 }}>
                        <SectionTitle isDark={isDark} icon={<FaPoll />} title="Active Poll" />
                        {data?.pollData ? (
                            <div>
                                <p style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '16px', lineHeight: 1.4 }}>{data.pollData.question}</p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: isDark ? '#0f0f12' : '#f8fafc', borderRadius: '10px', borderLeft: '3px solid var(--primary-color)' }}>
                                    <div>
                                        <div style={{ fontSize: '0.78rem', color: subText }}>Leading</div>
                                        <div style={{ fontWeight: '700', color: 'var(--primary-color)' }}>{data.pollData.leading}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.78rem', color: subText }}>Total Votes</div>
                                        <div style={{ fontWeight: '700', fontSize: '1.2rem' }}>{data.pollData.totalVotes}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px 0', color: subText }}>
                                <FaPoll size={30} style={{ opacity: 0.3, marginBottom: '10px' }} />
                                <p style={{ margin: 0, fontSize: '0.9rem' }}>No active poll</p>
                                <button onClick={() => onNavigate?.('polls')} style={{ marginTop: '12px', padding: '8px 16px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>Create Poll</button>
                            </div>
                        )}
                    </Card>

                    {/* Badge Summary */}
                    <Card isDark={isDark} style={{ flex: 1 }}>
                        <SectionTitle isDark={isDark} icon={<FaAward />} title="Badge Distribution" />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {Object.entries(BADGE_CONFIG).map(([badge, config]) => (
                                <div key={badge} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: `${config.color}10`, borderRadius: '10px', border: `1px solid ${config.color}30` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: config.color }}>
                                        {config.icon}
                                        <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{config.label}</span>
                                    </div>
                                    <span style={{ fontWeight: '800', fontSize: '1.2rem', color: config.color }}>{data?.badgeSummary?.[badge] || 0}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>

            {/* ── 10 + 11. WALLET + ALERTS SIDE BY SIDE ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                {/* Wallet Summary */}
                <Card isDark={isDark}>
                    <SectionTitle isDark={isDark} icon={<FaWallet />} title="Wallet Summary" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                        {[
                            { label: "Today's Revenue", value: `₹${data?.walletSummary?.todayRevenue || 0}`, color: '#10b981' },
                            { label: 'Total Balance', value: `₹${data?.walletSummary?.totalWalletBalance || 0}`, color: '#3b82f6' },
                            { label: 'Total Transactions', value: data?.walletSummary?.totalTransactions || 0, color: '#8b5cf6' },
                        ].map(item => (
                            <div key={item.label} style={{ padding: '16px', background: `${item.color}12`, borderRadius: '12px', textAlign: 'center', border: `1px solid ${item.color}25` }}>
                                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: item.color }}>{item.value}</div>
                                <div style={{ fontSize: '0.75rem', color: subText, marginTop: '4px' }}>{item.label}</div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Alerts Panel */}
                <Card isDark={isDark}>
                    <SectionTitle isDark={isDark} icon={<FaBell />} title="System Alerts" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {data?.alerts?.pendingComplaints > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#ef444415', borderRadius: '10px', borderLeft: '3px solid #ef4444' }}>
                                <FaExclamationTriangle color="#ef4444" />
                                <div>
                                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#ef4444' }}>Pending Complaints</div>
                                    <div style={{ fontSize: '0.8rem', color: subText }}>{data.alerts.pendingComplaints} complaints need review</div>
                                </div>
                                <button onClick={() => onNavigate?.('feedback')} style={{ marginLeft: 'auto', padding: '5px 12px', background: '#ef444420', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700' }}>View</button>
                            </div>
                        )}
                        {data?.alerts?.blockedStudents > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f9731615', borderRadius: '10px', borderLeft: '3px solid #f97316' }}>
                                <FaShieldAlt color="#f97316" />
                                <div>
                                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#f97316' }}>Blocked Students</div>
                                    <div style={{ fontSize: '0.8rem', color: subText }}>{data.alerts.blockedStudents} students are blocked</div>
                                </div>
                                <button onClick={() => onNavigate?.('students')} style={{ marginLeft: 'auto', padding: '5px 12px', background: '#f9731620', color: '#f97316', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700' }}>Manage</button>
                            </div>
                        )}
                        {data?.menuStatus !== 'Published' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#f59e0b15', borderRadius: '10px', borderLeft: '3px solid #f59e0b' }}>
                                <FaUtensils color="#f59e0b" />
                                <div>
                                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#f59e0b' }}>Menu Not Published</div>
                                    <div style={{ fontSize: '0.8rem', color: subText }}>Today's menu hasn't been set yet</div>
                                </div>
                                <button onClick={() => onNavigate?.('daily')} style={{ marginLeft: 'auto', padding: '5px 12px', background: '#f59e0b20', color: '#f59e0b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700' }}>Publish</button>
                            </div>
                        )}
                        {(!data?.alerts?.pendingComplaints && !data?.alerts?.blockedStudents && data?.menuStatus === 'Published') && (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#10b981' }}>
                                <FaCheckCircle size={32} style={{ marginBottom: '10px' }} />
                                <p style={{ margin: 0, fontWeight: '700' }}>All Systems Normal</p>
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: subText }}>No alerts at this time</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* ── 12. TOP STUDENTS ── */}
            <Card isDark={isDark}>
                <SectionTitle isDark={isDark} icon={<FaTrophy />} title="Top Students" subtitle="Most active students by booking history" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    {(data?.topStudents || []).length === 0 ? (
                        <p style={{ color: subText }}>No student data yet.</p>
                    ) : (
                        (data?.topStudents || []).map((s, i) => {
                            const badgeInfo = BADGE_CONFIG[s.badge] || { icon: null, color: '#94a3b8', label: 'None' };
                            return (
                                <div key={i} style={{ padding: '16px', background: isDark ? '#0f0f12' : '#f8fafc', borderRadius: '12px', border: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: `linear-gradient(135deg, ${badgeInfo.color}, ${badgeInfo.color}90)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '1rem', flexShrink: 0 }}>
                                        {s.name.charAt(0)}
                                    </div>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ fontWeight: '700', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                                        <div style={{ fontSize: '0.78rem', color: subText }}>{s.studentId}</div>
                                        <div style={{ fontSize: '0.78rem', color: badgeInfo.color, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                            {badgeInfo.icon} {badgeInfo.label}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--primary-color)' }}>{s.totalBookings || 0}</div>
                                        <div style={{ fontSize: '0.72rem', color: subText }}>bookings</div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </Card>

        </div>
    );
};

export default AdminOverview;
