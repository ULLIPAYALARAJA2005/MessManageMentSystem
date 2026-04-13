import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    FaCalendarAlt, FaChartLine, FaChartBar, FaDownload,
    FaArrowUp, FaArrowDown, FaExchangeAlt, FaFilter
} from 'react-icons/fa';

const MEALS = [
    "Morning Tea/Milk", "Morning Egg", "Morning Banana", "Tiffin",
    "Lunch Veg", "Lunch Non-Veg", "Lunch Egg",
    "Evening Tea/Milk", "Snacks",
    "Dinner Veg", "Dinner Non-Veg", "Dinner Egg"
];

const MEAL_COLORS = {
    "Morning Tea/Milk": "#3498db", "Morning Egg": "#f1c40f", "Morning Banana": "#ffeb3b", "Tiffin": "#e67e22",
    "Lunch Veg": "#2ecc71", "Lunch Non-Veg": "#ff7043", "Lunch Egg": "#f39c12",
    "Evening Tea/Milk": "#9b59b6", "Snacks": "#e74c3c",
    "Dinner Veg": "#1abc9c", "Dinner Non-Veg": "#2980b9", "Dinner Egg": "#d35400",
    "Total": "#ffffff"
};

const AdminAnalytics = () => {
    const [data, setData] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);

    // Filters
    const [timeRange, setTimeRange] = useState('7D'); // 7D, 30D, 1Y, CUSTOM
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const [selectedDomain, setSelectedDomain] = useState('All Bookings');
    const [compareDomains, setCompareDomains] = useState(false);
    const [chartType, setChartType] = useState('line'); // line, bar

    // Helper: format YYYY-MM-DD
    const formatDate = (date) => {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        let year = d.getFullYear();
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        return [year, month, day].join('-');
    };

    // Auto-calculate dates based on preset
    useEffect(() => {
        if (timeRange === 'CUSTOM') return;
        const end = new Date();
        let start = new Date();

        if (timeRange === '7D') start.setDate(end.getDate() - 6);
        else if (timeRange === '30D') start.setDate(end.getDate() - 29);
        else if (timeRange === '1Y') start.setFullYear(end.getFullYear() - 1);

        setCustomStart(formatDate(start));
        setCustomEnd(formatDate(end));
    }, [timeRange]);

    useEffect(() => {
        if (customStart && customEnd) {
            fetchAnalytics();
        }
    }, [customStart, customEnd, selectedDomain]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/analytics/bookings?startDate=${customStart}&endDate=${customEnd}&domain=${selectedDomain}`);
            setData(res.data.data);
            setSummary(res.data.summary);
        } catch (err) {
            toast.error("Failed to load analytics data");
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = () => {
        if (!data.length) return toast.error("No data to download");

        // Define columns
        let cols = ["Date", "Total Bookings"];
        if (compareDomains) cols = ["Date", "Total Bookings", ...MEALS];

        let csvContent = "data:text/csv;charset=utf-8," + cols.join(",") + "\n";

        data.forEach(row => {
            let rowData = [row.date, row.total];
            if (compareDomains) {
                MEALS.forEach(m => rowData.push(row.domains[m] || 0));
            }
            csvContent += rowData.join(",") + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `analytics_${customStart}_to_${customEnd}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("CSV Exported!");
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{ background: 'var(--surface-color)', padding: '15px', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
                    <p style={{ margin: '0 0 10px', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '5px' }}>{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', color: entry.color, fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '5px' }}>
                            <span>{entry.name}:</span>
                            <span>{entry.value}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* --- CONTROLS SECTION --- */}
            <div style={{ background: 'var(--card)', borderRadius: '16px', padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
                {/* Time Range */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <FaCalendarAlt style={{ color: 'var(--text-sec)' }} />
                    <div style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--input-border)' }}>
                        {['7D', '30D', '1Y', 'CUSTOM'].map(t => (
                            <button key={t} onClick={() => setTimeRange(t)}
                                style={{
                                    padding: '8px 15px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold',
                                    background: timeRange === t ? 'var(--primary-color)' : 'transparent',
                                    color: timeRange === t ? '#fff' : 'var(--text-sec)', transition: '0.2s'
                                }}>
                                {t === '1Y' ? '1 Year' : t}
                            </button>
                        ))}
                    </div>
                    {timeRange === 'CUSTOM' && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ padding: '8px', borderRadius: '8px', background: 'var(--input-bg)', color: '#fff', border: '1px solid var(--input-border)', outline: 'none' }} />
                            <span style={{ color: 'var(--text-sec)' }}>to</span>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ padding: '8px', borderRadius: '8px', background: 'var(--input-bg)', color: '#fff', border: '1px solid var(--input-border)', outline: 'none' }} />
                        </div>
                    )}
                </div>

                {/* Domain & Options */}
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <FaFilter style={{ position: 'absolute', left: '12px', color: 'var(--text-sec)', pointerEvents: 'none' }} />
                        <select value={selectedDomain} onChange={e => { setSelectedDomain(e.target.value); if (e.target.value !== 'All Bookings') setCompareDomains(false); }}
                            style={{ padding: '10px 15px 10px 35px', borderRadius: '8px', background: 'var(--input-bg)', color: '#fff', border: '1px solid var(--input-border)', outline: 'none', appearance: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                            <option value="All Bookings">All Bookings</option>
                            {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>

                    <button onClick={() => { setCompareDomains(!compareDomains); if (!compareDomains) setSelectedDomain('All Bookings'); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', borderRadius: '8px', border: compareDomains ? '1px solid var(--primary-color)' : '1px solid var(--input-border)', background: compareDomains ? 'var(--primary-color)' : 'var(--input-bg)', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}>
                        <FaExchangeAlt /> Compare Domains
                    </button>

                    <div style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--input-border)' }}>
                        <button onClick={() => setChartType('line')} style={{ padding: '10px', background: chartType === 'line' ? '#333' : 'transparent', color: chartType === 'line' ? 'var(--primary-color)' : 'var(--text-sec)', border: 'none', cursor: 'pointer' }}><FaChartLine /></button>
                        <button onClick={() => setChartType('bar')} style={{ padding: '10px', background: chartType === 'bar' ? '#333' : 'transparent', color: chartType === 'bar' ? 'var(--primary-color)' : 'var(--text-sec)', border: 'none', cursor: 'pointer' }}><FaChartBar /></button>
                    </div>

                    <button onClick={downloadCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', borderRadius: '8px', border: 'none', background: 'var(--success-color)', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
                        <FaDownload /> Export
                    </button>
                </div>
            </div>

            {/* --- SUMMARY CARDS --- */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    <div style={{ background: 'var(--card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ color: 'var(--text-sec)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Bookings</div>
                        <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--primary-color)', marginTop: '5px' }}>{summary.totalBookings.toLocaleString()}</div>
                        <FaChartLine style={{ position: 'absolute', right: '15px', bottom: '15px', fontSize: '3rem', color: 'var(--primary-color)', opacity: 0.1 }} />
                    </div>
                    <div style={{ background: 'var(--card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                        <div style={{ color: 'var(--text-sec)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}><FaArrowUp style={{ color: 'var(--success-color)' }} /> Peak Day</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fff', marginTop: '5px' }}>{summary.highestDay}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--success-color)', fontWeight: 'bold' }}>{summary.highestCount} bookings</div>
                    </div>
                    <div style={{ background: 'var(--card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                        <div style={{ color: 'var(--text-sec)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}><FaArrowDown style={{ color: 'var(--danger-color)' }} /> Lowest Day</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#fff', marginTop: '5px' }}>{summary.lowestDay}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--danger-color)', fontWeight: 'bold' }}>{summary.lowestCount} bookings</div>
                    </div>
                    <div style={{ background: 'var(--card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                        <div style={{ color: 'var(--text-sec)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Daily Average</div>
                        <div style={{ fontSize: '2rem', fontWeight: '900', color: '#f39c12', marginTop: '5px' }}>{summary.average}</div>
                    </div>
                </div>
            )}

            {/* --- MAIN CHART --- */}
            <div style={{ background: 'var(--card)', padding: '25px', borderRadius: '20px', border: '1px solid var(--border)', minHeight: '450px' }}>
                <h3 style={{ margin: '0 0 25px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FaChartLine color="var(--primary-color)" /> Booking Volume Trends
                </h3>

                {loading ? (
                    <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid var(--border)', borderTopColor: 'var(--primary-color)', animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : data.length === 0 ? (
                    <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sec)' }}>
                        No data available for the selected range.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={380}>
                        {chartType === 'line' ? (
                            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="date" stroke="#888" tick={{ fontSize: 12 }} dy={10} />
                                <YAxis stroke="#888" tick={{ fontSize: 12 }} dx={-10} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />

                                {!compareDomains ? (
                                    <Line type="monotone" dataKey="total" name={selectedDomain} stroke="var(--primary-color)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 8 }} />
                                ) : (
                                    MEALS.map(meal => (
                                        <Line key={meal} type="monotone" dataKey={(row) => row.domains[meal] || 0} name={meal} stroke={MEAL_COLORS[meal]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                                    ))
                                )}
                            </LineChart>
                        ) : (
                            <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                <XAxis dataKey="date" stroke="#888" tick={{ fontSize: 12 }} dy={10} />
                                <YAxis stroke="#888" tick={{ fontSize: 12 }} dx={-10} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />

                                {!compareDomains ? (
                                    <Bar dataKey="total" name={selectedDomain} fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
                                ) : (
                                    MEALS.map(meal => (
                                        <Bar key={meal} dataKey={(row) => row.domains[meal] || 0} name={meal} stackId="a" fill={MEAL_COLORS[meal]} />
                                    ))
                                )}
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                )}
            </div>

            {/* --- INSIGHTS --- */}
            {summary && (
                <div style={{ background: 'var(--card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: 'var(--text-sec)' }}>Qualitative Insights</h3>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text)', lineHeight: '1.6', fontSize: '0.9rem' }}>
                        <li>The highest volume of bookings recorded was <strong>{summary.highestCount}</strong> on <strong>{summary.highestDay}</strong>. Ensure adequate kitchen staff and resource availability during similar peak periods.</li>
                        <li>Conversely, the lowest volume occurred on <strong>{summary.lowestDay}</strong> ({summary.lowestCount} bookings), indicating a potential operational lull where resources can be re-allocated.</li>
                        <li>Over this selected period, the mess serves an average of <strong>{summary.average}</strong> {selectedDomain !== 'All Bookings' ? selectedDomain : 'meals'} per day. Use this baseline for ordering bulk perishables.</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AdminAnalytics;
