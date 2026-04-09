import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  FaUserCheck, FaClock, FaCheckCircle, FaSearch,
  FaCoffee, FaEgg, FaConciergeBell, FaUtensils, FaCalendarAlt, FaChartBar
} from 'react-icons/fa';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { socket } from '../socket';

const SECTIONS = [
  { id: 'Morning Egg', label: '🥚 Morning Egg', icon: <FaEgg /> },
  { id: 'Morning Tea', label: 'Morning Tea / Milk', icon: <FaCoffee /> },
  { id: 'Tiffin', label: '🥞 Tiffin', icon: <FaUtensils /> },
  { id: 'Lunch', label: '🍛 Lunch', icon: <FaConciergeBell /> },
  { id: 'Lunch Egg', label: '🥚 Lunch Egg', icon: <FaEgg /> },
  { id: 'Evening Tea', label: '☕ Evening Tea / Milk', icon: <FaCoffee /> },
  { id: 'Evening Snacks', label: '🍿 Evening Snacks', icon: <FaCoffee /> },
  { id: 'Dinner', label: '🍽 Dinner', icon: <FaConciergeBell /> },
  { id: 'Dinner Egg', label: '🥚 Dinner Egg', icon: <FaEgg /> },
  { id: 'Analysis', label: '📊 Analysis', icon: <FaChartBar /> }
];

// Sections where quantity matters — show the Qty column
const QTY_SECTIONS = ['Morning Egg', 'Lunch Egg', 'Dinner Egg', 'Evening Snacks'];

const EmployeeDashboard = () => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedSection, setSelectedSection] = useState('Lunch');

  const [studentId, setStudentId] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const idInputRef = useRef(null);

  const [analysisData, setAnalysisData] = useState([]);
  const [analysisDuration, setAnalysisDuration] = useState('week');
  const [analysisDays, setAnalysisDays] = useState(7);
  const [analysisStartDate, setAnalysisStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [analysisEndDate, setAnalysisEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [analysisMealType, setAnalysisMealType] = useState('All');

  const fetchData = async () => {
    try {
      const [statsRes, bookingsRes] = await Promise.all([
        api.get(`/employee/stats?date=${selectedDate}&section=${selectedSection}`),
        api.get(`/employee/bookings?date=${selectedDate}&section=${selectedSection}`)
      ]);
      setStats(statsRes.data.summary);
      setBookings(bookingsRes.data);
    } catch (err) {
      console.error("Fetch failed", err);
    }
  };

  const fetchAnalysisData = async () => {
    try {
      let url = `/employee/analysis?mealType=${analysisMealType}`;
      if (analysisDuration === 'range') {
        url += `&startDate=${analysisStartDate}&endDate=${analysisEndDate}`;
      } else {
        url += `&days=${analysisDays}&endDate=${selectedDate}`;
      }
      const res = await api.get(url);
      setAnalysisData(res.data);
    } catch (err) {
      console.error("Fetch analysis failed", err);
    }
  };

  useEffect(() => {
    if (selectedSection === 'Analysis') {
      fetchAnalysisData();
    } else {
      fetchData();
    }

    const handleUpdate = (data) => {
      // Real-time update for both bookings and stats
      if (selectedSection === 'Analysis') {
        fetchAnalysisData();
      } else {
        fetchData();
      }
    };

    socket.on('mealStatusUpdate', handleUpdate);
    socket.on('bookingCreated', handleUpdate);
    socket.on('bookingCancelled', handleUpdate);

    return () => {
      socket.off('mealStatusUpdate', handleUpdate);
      socket.off('bookingCreated', handleUpdate);
      socket.off('bookingCancelled', handleUpdate);
    };
  }, [selectedDate, selectedSection, analysisMealType, analysisDays, analysisDuration, analysisStartDate, analysisEndDate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/employee/verify', {
        studentId,
        secretCode,
        date: selectedDate,
        section: selectedSection
      });
      setVerifyResult({ ...data, type: 'success' });
      toast.success('Student Verified');
      // If code is correct, we can automatically mark completed maybe?
      // "If student booked: Show button -> 'Mark as Completed'"
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid ID or Code');
      setVerifyResult({ message: err.response?.data?.message || 'Verification Failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (bookingId, sectionToMark) => {
    try {
      await api.post('/employee/complete', { bookingId, section: sectionToMark });
      toast.success('Meal Completed');
      if (verifyResult && verifyResult.bookingId === bookingId) {
        setVerifyResult(null);
        setStudentId('');
        setSecretCode('');
        if (idInputRef.current) idInputRef.current.focus();
      }
      fetchData(); // or rely on socket
    } catch (err) {
      toast.error(err.response?.data?.message || 'Already Completed');
    }
  };

  const handleUndo = async (bookingId, sectionToMark) => {
    try {
      await api.post('/employee/undo', { bookingId, section: sectionToMark });
      toast.success('Undone successfully');
      if (verifyResult && verifyResult.bookingId === bookingId) {
        setVerifyResult(null);
        setStudentId('');
        setSecretCode('');
        if (idInputRef.current) idInputRef.current.focus();
      }
      fetchData();
    } catch (err) {
      toast.error('Failed to undo');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f0f13', color: '#fff' }}>

      {/* 📂 LEFT SIDEBAR */}
      <div style={{ width: '280px', background: '#181820', borderRight: '1px solid #2a2a35', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ margin: '0 0 30px', display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
          <FaUserCheck style={{ color: '#007bff' }} /> Employee Panel
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '0.85rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', fontWeight: 'bold' }}>
            Meal Sections
          </div>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSection(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '15px', padding: '15px 20px',
                borderRadius: '12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: selectedSection === s.id ? '#007bff22' : 'transparent',
                color: selectedSection === s.id ? '#007bff' : '#aaa',
                borderLeft: selectedSection === s.id ? '4px solid #007bff' : '4px solid transparent',
                fontWeight: selectedSection === s.id ? 'bold' : 'normal',
                transition: 'all 0.2s',
                fontSize: '1.05rem'
              }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>

        {selectedSection === 'Analysis' ? (
          <div style={{ background: '#181820', borderRadius: '15px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FaChartBar style={{ color: '#007bff' }} /> Analytics Dashboard
            </h1>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: '#252530', padding: '15px', borderRadius: '10px' }}>
              <select
                value={analysisMealType}
                onChange={e => setAnalysisMealType(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', background: '#181820', color: '#fff', border: '1px solid #333', outline: 'none' }}
              >
                <option value="All">All Items</option>
                {SECTIONS.filter(s => s.id !== 'Analysis').map(s => (
                  <option key={s.id} value={s.id}>{s.id}</option>
                ))}
              </select>

              <select
                value={analysisDuration}
                onChange={e => {
                  setAnalysisDuration(e.target.value);
                  if (e.target.value === 'week') setAnalysisDays(7);
                  if (e.target.value === 'month') setAnalysisDays(30);
                }}
                style={{ padding: '10px', borderRadius: '8px', background: '#181820', color: '#fff', border: '1px solid #333', outline: 'none' }}
              >
                <option value="week">Week (7 Days)</option>
                <option value="month">Month (30 Days)</option>
                <option value="custom">Custom Days</option>
                <option value="range">Date Range</option>
              </select>

              {analysisDuration === 'custom' && (
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={analysisDays}
                  onChange={e => setAnalysisDays(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ padding: '10px', borderRadius: '8px', background: '#181820', color: '#fff', border: '1px solid #333', width: '80px', outline: 'none' }}
                />
              )}
              
              {analysisDuration === 'range' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#181820', padding: '5px 15px', borderRadius: '8px', border: '1px solid #333' }}>
                  <input 
                    type="date"
                    value={analysisStartDate}
                    onChange={e => setAnalysisStartDate(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none' }}
                  />
                  <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>→</span>
                  <input 
                    type="date"
                    value={analysisEndDate}
                    onChange={e => setAnalysisEndDate(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none' }}
                  />
                </div>
              )}
            </div>

            <div style={{ height: '400px', width: '100%', marginTop: '20px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analysisData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#888"
                    tick={{ fill: '#aaa', fontSize: 11, angle: -45, textAnchor: 'end', dy: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    height={60}
                    minTickGap={-5}
                  />
                  <YAxis
                    stroke="#888"
                    tick={{ fill: '#aaa', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    dx={-10}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#181820', border: '1px solid #333', borderRadius: '12px', color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#00e5ff', fontWeight: 'bold', fontSize: '1.2rem' }}
                    cursor={{ stroke: '#2a2a35', strokeWidth: 2, strokeDasharray: '5 5' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#00e5ff"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorCount)"
                    activeDot={{ r: 8, fill: '#00e5ff', stroke: '#181820', strokeWidth: 3, style: { filter: 'drop-shadow(0px 0px 8px rgba(0, 229, 255, 0.8))' } }}
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <>
            {/* 📅 TOP BAR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: '#181820', padding: '20px', borderRadius: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{selectedSection} Dashboard</h1>
                <div style={{ display: 'flex', alignItems: 'center', background: '#252530', padding: '10px 15px', borderRadius: '10px', gap: '10px' }}>
                  <FaCalendarAlt style={{ color: '#007bff' }} />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.1rem', outline: 'none' }}
                  />
                </div>
              </div>

              {/* 📊 SUMMARY CARDS */}
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ background: '#252530', padding: '10px 20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase' }}>Total Bookings</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.total}</span>
                </div>
                <div style={{ background: '#2ed57322', padding: '10px 20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#2ed573' }}>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase' }}>Completed</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.completed}</span>
                </div>
                <div style={{ background: '#ff475722', padding: '10px 20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#ff4757' }}>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8, textTransform: 'uppercase' }}>Pending</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.pending}</span>
                </div>
              </div>
            </div>

            {/* 🔍 VERIFICATION SYSTEM */}
            <div style={{ background: '#181820', borderRadius: '15px', padding: '25px', marginBottom: '30px' }}>
              <h2 style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaSearch /> Student Verification System
              </h2>

              <form onSubmit={handleVerify} style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <input
                    ref={idInputRef}
                    autoFocus
                    type="text"
                    placeholder="Student ID (e.g. r210264)"
                    value={studentId}
                    onChange={e => setStudentId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '15px', fontSize: '1.2rem', background: '#0f0f13', border: '1px solid #333', color: '#fff', borderRadius: '10px', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Secret Code"
                    value={secretCode}
                    onChange={e => setSecretCode(e.target.value)}
                    required
                    style={{ width: '100%', padding: '15px', fontSize: '1.2rem', background: '#0f0f13', border: '1px solid #333', color: '#fff', borderRadius: '10px', outline: 'none' }}
                  />
                </div>
                <button
                  disabled={loading}
                  type="submit"
                  style={{ padding: '15px 30px', fontSize: '1.2rem', fontWeight: 'bold', background: '#007bff', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', minWidth: '150px', justifyContent: 'center' }}
                >
                  {loading ? 'Verifying...' : '🔍 Verify'}
                </button>
              </form>

              {/* Verification Result Display */}
              {verifyResult && (
                <div style={{
                  marginTop: '20px', padding: '20px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  border: `1px solid ${verifyResult.type === 'error' ? '#ff4757' : (verifyResult.status === 'Completed' ? '#2ed573' : '#ffa502')}`,
                  background: verifyResult.type === 'error' ? '#ff475711' : (verifyResult.status === 'Completed' ? '#2ed57311' : '#ffa50211')
                }}>
                  <div>
                    {verifyResult.type === 'error' ? (
                      <h3 style={{ margin: 0, color: '#ff4757' }}>❌ {verifyResult.message}</h3>
                    ) : (
                      <>
                        <h3 style={{ margin: '0 0 5px' }}>{verifyResult.studentName} <span style={{ color: '#888', fontSize: '1rem', fontWeight: 'normal' }}>({verifyResult.studentId})</span></h3>
                        <p style={{ margin: 0, color: verifyResult.status === 'Completed' ? '#2ed573' : '#ffa502', fontWeight: 'bold', fontSize: '1.1rem' }}>
                          Status: {verifyResult.status}
                        </p>
                      </>
                    )}
                  </div>

                  {verifyResult.type === 'success' && (
                    <div>
                      {verifyResult.status === 'Pending' ? (
                        <button
                          onClick={() => handleComplete(verifyResult.bookingId, verifyResult.mealSection)}
                          style={{ background: '#2ed573', color: '#111', padding: '12px 25px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}
                        >
                          Mark as Completed
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUndo(verifyResult.bookingId, verifyResult.mealSection)}
                          style={{ background: '#ff4757', color: '#fff', padding: '12px 25px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 📋 BOOKINGS LIST (TABLE) */}
            <div style={{ background: '#181820', borderRadius: '15px', padding: '25px' }}>
              <h2 style={{ margin: '0 0 20px' }}>Bookings List</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #333' }}>
                    <th style={{ padding: '15px 10px', color: '#888' }}>Student Name</th>
                    <th style={{ padding: '15px 10px', color: '#888' }}>Student ID</th>
                    {QTY_SECTIONS.includes(selectedSection) && (
                      <th style={{ padding: '15px 10px', color: '#f5a623', fontWeight: 'bold' }}>📦 Qty</th>
                    )}
                    <th style={{ padding: '15px 10px', color: '#888' }}>Status</th>
                    <th style={{ padding: '15px 10px', color: '#888' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan={QTY_SECTIONS.includes(selectedSection) ? 5 : 4} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No bookings for {selectedSection} on this date.</td>
                    </tr>
                  ) : (
                    bookings.map(b => (
                      <tr key={b.bookingId} style={{ borderBottom: '1px solid #222', transition: 'background 0.2s', ':hover': { background: '#252530' } }}>
                        <td style={{ padding: '15px 10px', fontSize: '1.1rem' }}>{b.studentName}</td>
                        <td style={{ padding: '15px 10px', color: '#aaa', fontFamily: 'monospace', fontSize: '1.1rem' }}>{b.studentId}</td>
                        {QTY_SECTIONS.includes(selectedSection) && (
                          <td style={{ padding: '15px 10px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              minWidth: '36px', height: '36px', borderRadius: '8px',
                              background: '#f5a62322', color: '#f5a623',
                              fontWeight: 'bold', fontSize: '1.2rem', border: '1px solid #f5a62355'
                            }}>
                              {b.qty || 1}
                            </span>
                          </td>
                        )}
                        <td style={{ padding: '15px 10px' }}>
                          <span style={{
                            padding: '5px 12px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold',
                            background: b.status === 'Completed' ? '#2ed57322' : '#ff475722',
                            color: b.status === 'Completed' ? '#2ed573' : '#ff4757'
                          }}>
                            {b.status}
                          </span>
                        </td>
                        <td style={{ padding: '15px 10px' }}>
                          {b.status !== 'Completed' ? (
                            <button
                              onClick={() => handleComplete(b.bookingId, selectedSection)}
                              style={{ background: '#007bff22', color: '#007bff', border: '1px solid #007bff', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              Mark Complete
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUndo(b.bookingId, selectedSection)}
                              style={{ background: 'transparent', color: '#ff4757', border: '1px solid #ff4757', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              Undo
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}


      </div>
    </div>
  );
};

export default EmployeeDashboard;

