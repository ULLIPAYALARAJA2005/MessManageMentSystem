import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FaUserCheck, FaClock, FaCheckCircle, FaSearch,
  FaCoffee, FaEgg, FaConciergeBell, FaUtensils, FaCalendarAlt, FaChartBar, FaQrcode, FaMoon, FaSun, FaSignOutAlt
} from 'react-icons/fa';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { socket } from '../socket';

const SECTIONS = [
  { id: 'QR Scanner', label: 'QR Scanner', icon: <FaQrcode /> },
  { id: 'Morning Tea/Milk', label: 'Morning Tea/Milk', icon: <FaCoffee /> },
  { id: 'Morning Egg', label: 'Morning Egg', icon: <FaEgg /> },
  { id: 'Morning Banana', label: 'Morning Banana', icon: <FaConciergeBell /> },
  { id: 'Tiffin', label: 'Tiffin', icon: <FaUtensils /> },
  { id: 'Lunch Veg', label: 'Lunch Veg', icon: <FaConciergeBell /> },
  { id: 'Lunch Non-Veg', label: 'Lunch Non-Veg', icon: <FaConciergeBell /> },
  { id: 'Lunch Egg', label: 'Lunch Egg', icon: <FaEgg /> },
  { id: 'Evening Tea/Milk', label: 'Evening Tea/Milk', icon: <FaCoffee /> },
  { id: 'Snacks', label: 'Snacks', icon: <FaCoffee /> },
  { id: 'Dinner Veg', label: 'Dinner Veg', icon: <FaConciergeBell /> },
  { id: 'Dinner Non-Veg', label: 'Dinner Non-Veg', icon: <FaConciergeBell /> },
  { id: 'Dinner Egg', label: 'Dinner Egg', icon: <FaEgg /> },
  { id: 'Analysis', label: 'Analysis', icon: <FaChartBar /> }
];

// Sections where quantity matters — show the Qty column
const QTY_SECTIONS = ['Morning Egg', 'Lunch Egg', 'Dinner Egg', 'Snacks'];

/** 
 * ULTIMATE VOLUME SCANNER AUDIO 
 * Uses aggressive Square/Sawtooth waveforms to pierce through noise.
 */
const playScannerSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    // Create new context per-call to ensure it's "fresh", but try to resume
    const audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const playTone = (freq, duration, wave = 'square', delay = 0, volume = 1.0) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
      
      // Maximum volume envelope
      gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + delay + 0.01);
      gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + delay + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + duration);
    };

    if (type === 'success') {
      // High-frequency piercing double chirp (Standard 'Good' Sound)
      playTone(900, 0.1, 'square', 0, 0.8);
      playTone(1200, 0.15, 'square', 0.12, 1.0);
    } else {
      // Harsh low-frequency triple buzz (Aggressive 'Stop' Sound)
      playTone(220, 0.15, 'sawtooth', 0, 1.0);
      playTone(220, 0.15, 'sawtooth', 0.2, 1.0);
      playTone(220, 0.25, 'sawtooth', 0.4, 1.0);
    }
  } catch (e) {
    console.warn("Audio Context failed to play. Ensure user interaction.");
  }
};

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedSection, setSelectedSection] = useState('Lunch Veg');
  const [isDark, setIsDark] = useState(true);

  const [studentId, setStudentId] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  const [recentScans, setRecentScans] = useState([]);
  const [overrideSlot, setOverrideSlot] = useState('AUTO');
  const overrideSlotRef = React.useRef(overrideSlot);

  useEffect(() => {
    overrideSlotRef.current = overrideSlot;
  }, [overrideSlot]);

  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    if (selectedSection === 'Analysis' || selectedSection === 'QR Scanner') {
      if (selectedSection === 'Analysis') fetchAnalysisData();
    } else {
      fetchData();
    }

    const handleUpdate = (data) => {
      // Real-time update for both bookings and stats
      if (selectedSection === 'Analysis') {
        fetchAnalysisData();
      } else if (selectedSection !== 'QR Scanner') {
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

  useEffect(() => {
    let scanner = null;
    if (selectedSection === 'QR Scanner') {
      scanner = new Html5QrcodeScanner('reader', { qrbox: { width: 300, height: 300 }, fps: 10 }, false);
      let lastScannedBooking = null;
      let lastScanTime = 0;

      scanner.render((decodedText) => {
        try {
          const data = JSON.parse(decodedText);
          if (data.bookingId && data.mealsBooked) {
            const now = new Date();

            // Prevent overlapping network calls for exact same scan
            if (lastScannedBooking === data.bookingId && (now.getTime() - lastScanTime) < 5000) {
              return;
            }
            lastScannedBooking = data.bookingId;
            lastScanTime = now.getTime();

            const time = now.getHours() + now.getMinutes() / 60;
            let activeMeals = [];

            const currentOverride = overrideSlotRef.current;
            if (currentOverride === 'AUTO') {
              if (time >= 7 && time <= 10.5) activeMeals = ['Morning Tea/Milk', 'Morning Egg', 'Morning Banana', 'Tiffin'];
              else if (time >= 12 && time <= 15) activeMeals = ['Lunch Veg', 'Lunch Non-Veg', 'Lunch Egg'];
              else if (time >= 17 && time <= 18.5) activeMeals = ['Evening Tea/Milk', 'Snacks'];
              else if (time >= 19 && time <= 22) activeMeals = ['Dinner Veg', 'Dinner Non-Veg', 'Dinner Egg'];
            } else if (currentOverride === 'MORNING') {
              activeMeals = ['Morning Tea/Milk', 'Morning Egg', 'Morning Banana', 'Tiffin'];
            } else if (currentOverride === 'LUNCH') {
              activeMeals = ['Lunch Veg', 'Lunch Non-Veg', 'Lunch Egg'];
            } else if (currentOverride === 'SNACKS') {
              activeMeals = ['Evening Tea/Milk', 'Snacks'];
            } else if (currentOverride === 'DINNER') {
              activeMeals = ['Dinner Veg', 'Dinner Non-Veg', 'Dinner Egg'];
            }

            const bookedActiveMeals = data.mealsBooked.filter(m => activeMeals.includes(m));

            if (bookedActiveMeals.length > 0) {
              const promises = bookedActiveMeals.map(meal =>
                api.post('/employee/complete', { bookingId: data.bookingId, section: meal })
              );

              Promise.allSettled(promises).then(results => {
                let successCount = 0;
                let alreadyCompletedCount = 0;

                results.forEach(res => {
                  if (res.status === 'fulfilled') successCount++;
                  else if (res.reason?.response?.data?.message === 'Already Completed') alreadyCompletedCount++;
                });

                const isAlreadyDone = alreadyCompletedCount === bookedActiveMeals.length;

                const newScan = {
                  id: Math.random().toString(36).substr(2, 9),
                  bookingId: data.bookingId,
                  studentId: data.studentId,
                  timeStr: now.toLocaleTimeString(),
                  scannedAt: now,
                  meals: bookedActiveMeals,
                  qty: data.mealQty || {},
                  undone: false,
                  status: successCount > 0 ? 'Success' : (isAlreadyDone ? 'AlreadyScanned' : 'Error')
                };

                if (successCount > 0) {
                  playScannerSound('success');
                  toast.success(`Provided ${bookedActiveMeals.join(', ')} to ${data.studentId}`);
                } else if (isAlreadyDone) {
                  playScannerSound('error');
                  toast.error(`Already marked as completed for ${data.studentId}!`);
                } else {
                  playScannerSound('error');
                  toast.error(`Error processing scan for ${data.studentId}`);
                }

                setRecentScans(prev => [newScan, ...prev].slice(0, 50));
              });
            } else {
              const newScan = {
                id: Math.random().toString(36).substr(2, 9),
                bookingId: data.bookingId,
                studentId: data.studentId,
                timeStr: now.toLocaleTimeString(),
                scannedAt: now,
                meals: [],
                qty: data.mealQty || {},
                undone: false,
                status: 'NoMeals'
              };
              playScannerSound('error');
              toast.error(`No items booked by ${data.studentId} for current time!`);
              setRecentScans(prev => [newScan, ...prev].slice(0, 50));
            }
          }
        } catch (e) {
          playScannerSound('error');
          toast.error("Invalid QR Format detected");
        }
      }, (err) => { });
    }
    return () => {
      if (scanner) {
        scanner.clear().catch(error => console.error("Failed to clear Scanner", error));
      }
    };
  }, [selectedSection]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/employee/verify', {
        studentId,
        date: selectedDate,
        section: selectedSection
      });
      setVerifyResult({ ...data, type: 'success' });
      toast.success('Student Verified');
      // If code is correct, we can automatically mark completed maybe?
      // "If student booked: Show button -> 'Mark as Completed'"
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid ID');
      setVerifyResult({ message: err.response?.data?.message || 'Verification Failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (bookingId, sectionToMark, fromScanner = false) => {
    try {
      await api.post('/employee/complete', { bookingId, section: sectionToMark });
      toast.success(`${sectionToMark} marked Completed`);
      if (fromScanner) {
        setScannedStatuses(prev => ({ ...prev, [sectionToMark]: 'Completed' }));
      }

      if (!fromScanner && verifyResult && verifyResult.bookingId === bookingId) {
        setVerifyResult(null);
        setStudentId('');
        if (idInputRef.current) idInputRef.current.focus();
      }
      if (selectedSection !== 'QR Scanner') fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Already Completed');
      if (err.response?.data?.message === 'Already Completed' && fromScanner) {
        setScannedStatuses(prev => ({ ...prev, [sectionToMark]: 'Completed' }));
      }
    }
  };

  const handleUndo = async (bookingId, sectionToMark, fromScanner = false) => {
    try {
      await api.post('/employee/undo', { bookingId, section: sectionToMark });
      toast.success(`${sectionToMark} undone`);
      if (fromScanner) {
        setScannedStatuses(prev => ({ ...prev, [sectionToMark]: 'Pending' }));
      }

      if (!fromScanner && verifyResult && verifyResult.bookingId === bookingId) {
        setVerifyResult(null);
        setStudentId('');
        if (idInputRef.current) idInputRef.current.focus();
      }
      if (selectedSection !== 'QR Scanner') fetchData();
    } catch (err) {
      toast.error('Failed to undo');
    }
  };

  const handleMarkAllComplete = async () => {
    if (bookings.length === 0) return;
    const pendingCount = bookings.filter(b => b.status !== 'Completed').length;
    if (pendingCount === 0) {
      toast.error('No pending bookings to mark complete');
      return;
    }

    if (!window.confirm(`Are you sure you want to mark ${pendingCount} pending bookings for ${selectedSection} as completed?`)) return;

    setLoading(true);
    try {
      const res = await api.post('/employee/complete-all', {
        date: selectedDate,
        section: selectedSection
      });
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark all complete');
    } finally {
      setLoading(false);
    }
  };

  const theme = {
    "--dash-bg": isDark ? "#0f0f13" : "#f8fafc",
    "--dash-surface": isDark ? "#181820" : "#ffffff",
    "--dash-card": isDark ? "#252530" : "#ffffff",
    "--dash-border": isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
    "--dash-text": isDark ? "#f3f4f6" : "#1e293b",
    "--dash-text-sec": isDark ? "#94a3b8" : "#64748b",
    "--dash-text-reverse": isDark ? "#111111" : "#ffffff",
    "--dash-accent": "#007bff",
    "--input-bg": isDark ? "#0f0f13" : "#ffffff",
    "--input-border": isDark ? "#333333" : "#e2e8f0",
    "--success-color": "#10b981",
    "--danger-color": "#ef4444"
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="dashboard-layout" style={{ ...theme, display: 'flex', height: '100vh', background: 'var(--dash-bg)', color: 'var(--dash-text)', transition: 'all 0.3s ease', fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar Overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

      {/* 📂 LEFT SIDEBAR */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{
        width: '240px',
        minWidth: '240px',
        flexShrink: 0,
        background: 'var(--dash-surface)',
        borderRight: '1px solid var(--dash-border)',
        padding: '25px 20px',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease',
        boxShadow: isDark ? 'none' : '2px 0 10px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px', padding: '0 10px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--dash-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '1.2rem'
          }}>
            <FaUserCheck />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', letterSpacing: '-0.5px' }}>
            Employee Hub
          </h2>
          <button onClick={() => setSidebarOpen(false)} className="sidebar-close-btn" style={{ background: 'none', border: 'none', color: 'var(--dash-text-sec)', fontSize: '1.2rem', cursor: 'pointer', display: 'none' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--dash-text-sec)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', fontWeight: 'bold' }}>
            Meal Sections
          </div>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => { setSelectedSection(s.id); setSidebarOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                borderRadius: '10px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: selectedSection === s.id ? 'var(--dash-accent)' : 'transparent',
                color: selectedSection === s.id ? '#fff' : 'var(--dash-text-sec)',
                fontWeight: selectedSection === s.id ? '600' : '500',
                transition: 'all 0.2s',
                fontSize: '0.95rem',
                outline: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              <span style={{ fontSize: '1.1rem', display: 'flex' }}>{s.icon}</span> {s.label}
            </button>
          ))}
        </div>

        {/* 🚪 Logout Button */}
        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--dash-border)' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
              borderRadius: '10px', border: '1px solid transparent', cursor: 'pointer', width: '100%',
              background: 'transparent', color: '#ff4757', fontWeight: '600',
              transition: 'all 0.2s', fontSize: '0.95rem', outline: 'none'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#ff475711'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <FaSignOutAlt /> Sign Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>

        {selectedSection === 'Analysis' ? (
          <div style={{ background: 'var(--dash-surface)', borderRadius: '15px', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FaChartBar style={{ color: '#007bff' }} /> Analytics Dashboard
            </h1>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', background: 'var(--dash-card)', padding: '15px', borderRadius: '10px' }}>
              <select
                value={analysisMealType}
                onChange={e => setAnalysisMealType(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', background: 'var(--dash-surface)', color: 'var(--dash-text)', border: '1px solid #333', outline: 'none' }}
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
                style={{ padding: '10px', borderRadius: '8px', background: 'var(--dash-surface)', color: 'var(--dash-text)', border: '1px solid #333', outline: 'none' }}
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
                  style={{ padding: '10px', borderRadius: '8px', background: 'var(--dash-surface)', color: 'var(--dash-text)', border: '1px solid #333', width: '80px', outline: 'none' }}
                />
              )}

              {analysisDuration === 'range' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--dash-surface)', padding: '5px 15px', borderRadius: '8px', border: '1px solid #333' }}>
                  <input
                    type="date"
                    value={analysisStartDate}
                    onChange={e => setAnalysisStartDate(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--dash-text)', outline: 'none' }}
                  />
                  <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>→</span>
                  <input
                    type="date"
                    value={analysisEndDate}
                    onChange={e => setAnalysisEndDate(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--dash-text)', outline: 'none' }}
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
                    contentStyle={{ backgroundColor: 'var(--dash-surface)', border: '1px solid #333', borderRadius: '12px', color: 'var(--dash-text)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#00e5ff', fontWeight: 'bold', fontSize: '1.2rem' }}
                    cursor={{ stroke: 'var(--dash-border)', strokeWidth: 2, strokeDasharray: '5 5' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#00e5ff"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorCount)"
                    activeDot={{ r: 8, fill: '#00e5ff', stroke: 'var(--dash-surface)', strokeWidth: 3, style: { filter: 'drop-shadow(0px 0px 8px rgba(0, 229, 255, 0.8))' } }}
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : selectedSection === 'QR Scanner' ? (
          <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }} className="qr-scanner-layout">
            {/* Left: Camera View */}
            <div style={{ flex: 1, background: 'var(--dash-surface)', padding: '25px', borderRadius: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FaQrcode style={{ color: '#007bff' }} /> Live Scanner
                </h1>
                <button 
                  onClick={() => {
                    playScannerSound('success');
                    toast.success("Audio Initialized 🔊");
                  }}
                  style={{ 
                    padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--dash-accent)',
                    background: 'rgba(0, 123, 255, 0.1)', color: 'var(--dash-accent)', 
                    fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  🔊 Enable Audio
                </button>
              </div>

              <div style={{ background: 'var(--dash-card)', padding: '15px', borderRadius: '10px', marginBottom: '20px', borderLeft: '4px solid #f39c12' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={{ margin: 0, color: 'var(--dash-text-sec)', fontSize: '0.9rem' }}>Scanner Active Time Bucket:</p>
                  <select
                    value={overrideSlot}
                    onChange={(e) => setOverrideSlot(e.target.value)}
                    style={{ background: '#444', color: 'white', padding: '5px 10px', borderRadius: '5px', border: '1px solid #666', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="AUTO">Auto-Detect</option>
                    <option value="MORNING">Force: Morning / Tiffin</option>
                    <option value="LUNCH">Force: Lunch</option>
                    <option value="SNACKS">Force: Snacks</option>
                    <option value="DINNER">Force: Dinner</option>
                  </select>
                </div>

                {(() => {
                  const now = new Date();
                  if (overrideSlot !== 'AUTO') {
                    let label = '';
                    if (overrideSlot === 'MORNING') label = "Forced Mode: Tiffin Items";
                    if (overrideSlot === 'LUNCH') label = "Forced Mode: Lunch Items";
                    if (overrideSlot === 'SNACKS') label = "Forced Mode: Snacks";
                    if (overrideSlot === 'DINNER') label = "Forced Mode: Dinner Items";
                    return <h3 style={{ margin: '5px 0 0', color: '#f39c12' }}>{label}</h3>;
                  }

                  const t = now.getHours() + now.getMinutes() / 60;
                  let slot = "NONE (Outside Meal Hours)";
                  if (t >= 7 && t <= 9.5) slot = "Tiffin (7:00 AM - 9:30 AM)";
                  else if (t >= 12 && t <= 14.5) slot = "Lunch (12:00 PM - 2:30 PM)";
                  else if (t >= 17 && t <= 18.5) slot = "Snacks (5:00 PM - 6:30 PM)";
                  else if (t >= 19 && t <= 21.5) slot = "Dinner (7:00 PM - 9:30 PM)";
                  return <h3 style={{ margin: '5px 0 0', color: 'var(--dash-text)' }}>{slot} — Local Time: {now.toLocaleTimeString()}</h3>;
                })()}
              </div>

              <p style={{ color: 'var(--dash-text-sec)', marginBottom: '20px' }}>Point camera at student QR codes to process meals instantly.</p>
              <div id="reader" style={{ width: '100%', background: 'black', borderRadius: '15px', overflow: 'hidden', border: '2px solid #333' }}></div>
            </div>

            {/* Right: Scan Results List */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
              <h3 style={{ margin: 0, color: 'var(--dash-text-sec)', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Recent Scans</h3>

              {recentScans.length === 0 ? (
                <div style={{ background: 'var(--dash-surface)', padding: '40px', borderRadius: '15px', textAlign: 'center', border: '2px dashed #333' }}>
                  <p style={{ fontSize: '2.5rem', margin: 0, opacity: 0.5 }}>📷</p>
                  <p style={{ color: 'var(--dash-text-sec)', fontSize: '0.95rem', marginTop: '10px' }}>Waiting for scans... Auto-completed meals will appear here.</p>
                </div>
              ) : (
                recentScans.map(scan => (
                  <div key={scan.id} style={{
                    background: 'var(--dash-card)', padding: '15px 20px', borderRadius: '12px',
                    borderLeft: `4px solid ${scan.status === 'Success' ? '#2ed573' : (scan.status === 'AlreadyScanned' ? '#f39c12' : '#ff4757')}`,
                    opacity: scan.undone ? 0.6 : 1
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div>
                        <h4 style={{ margin: 0, color: 'var(--dash-text)', fontSize: '1.2rem' }}>Student: <span style={{ color: '#00e5ff' }}>{scan.studentId}</span></h4>
                        <span style={{ color: 'var(--dash-text-sec)', fontSize: '0.8rem' }}>{scan.timeStr}</span>
                      </div>
                      {scan.status === 'Success' && !scan.undone && (
                        <button
                          onClick={() => {
                            scan.meals.forEach(m => api.post('/employee/undo', { bookingId: scan.bookingId, section: m }));
                            setRecentScans(prev => prev.map(s => s.id === scan.id ? { ...s, undone: true } : s));
                            toast.success('Undo complete');
                          }}
                          style={{ background: 'transparent', color: '#ff4757', border: '1px solid #ff4757', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                          Undo
                        </button>
                      )}
                      {scan.undone && <span style={{ color: '#ff4757', fontSize: '0.8rem', fontWeight: 'bold' }}>UNDONE</span>}
                      {scan.status === 'AlreadyScanned' && <span style={{ color: '#f39c12', fontSize: '0.8rem', fontWeight: 'bold' }}>⚠️ ALREADY PROVIDED</span>}
                    </div>

                    {scan.status === 'Success' || scan.status === 'AlreadyScanned' ? (
                      scan.meals.map(m => (
                        <div key={m} style={{ background: 'var(--dash-surface)', padding: '8px 12px', borderRadius: '8px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: scan.status === 'AlreadyScanned' ? '#aaa' : '#ddd' }}>{m}</span>
                          <span style={{ color: scan.status === 'AlreadyScanned' ? '#aaa' : '#ffb142', fontWeight: 'bold' }}>x{scan.qty[m] || 1}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#ff4757', fontSize: '0.9rem' }}>No meals booked for the current active time slot.</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 📅 TOP BAR */}
            <div className="employee-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: 'var(--dash-surface)', padding: '20px', borderRadius: '15px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="hamburger-btn"
                  style={{
                    alignItems: 'center', justifyContent: 'center',
                    background: 'var(--dash-surface)', border: '1px solid var(--dash-border)',
                    color: 'var(--dash-text)', padding: '10px', borderRadius: '10px', cursor: 'pointer'
                  }}
                >☰</button>
                <h1 style={{ margin: 0, fontSize: 'clamp(1.2rem, 4vw, 1.8rem)' }}>{selectedSection} Dashboard</h1>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--dash-card)', padding: '10px 15px', borderRadius: '10px', gap: '10px' }}>
                  <FaCalendarAlt style={{ color: '#007bff' }} />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--dash-text)', fontSize: '1.1rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                {/* 🌙 Theme Toggle */}
                <button
                  onClick={() => setIsDark(!isDark)}
                  style={{
                    background: 'var(--dash-card)', border: '1px solid var(--dash-border)',
                    color: 'var(--dash-text)', padding: '10px', borderRadius: '50%', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  {isDark ? <FaSun size={20} color="#f39c12" /> : <FaMoon size={20} color="#007bff" />}
                </button>
              </div>

              {/* 📊 SUMMARY CARDS */}
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{
                  background: 'var(--dash-card)',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.05)',
                  border: '1px solid var(--dash-border)'
                }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--dash-text-sec)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>Total</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '800' }}>{stats.total}</span>
                </div>
                <div style={{
                  background: 'rgba(46, 213, 115, 0.1)',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  color: 'var(--success-color)',
                  border: '1px solid rgba(46, 213, 115, 0.2)'
                }}>
                  <span style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>Done</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '800' }}>{stats.completed}</span>
                </div>
                <div style={{
                  background: 'rgba(255, 71, 87, 0.1)',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  color: 'var(--danger-color)',
                  border: '1px solid rgba(255, 71, 87, 0.2)'
                }}>
                  <span style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>Left</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: '800' }}>{stats.pending}</span>
                </div>
              </div>
            </div>

            {/* 🔍 VERIFICATION SYSTEM */}
            <div style={{ background: 'var(--dash-surface)', borderRadius: '15px', padding: '25px', marginBottom: '30px' }}>
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
                    style={{
                      width: '100%',
                      padding: '14px 18px',
                      fontSize: '1rem',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--dash-text)',
                      borderRadius: '10px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxShadow: isDark ? 'none' : 'inset 0 1px 2px rgba(0,0,0,0.05)'
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--dash-accent)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--input-border)'}
                  />
                </div>
                <button
                  disabled={loading}
                  type="submit"
                  style={{
                    padding: '12px 28px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    background: 'var(--dash-accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    minWidth: '140px',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(0, 123, 255, 0.2)'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {loading ? 'Verifying...' : <><FaSearch /> Verify</>}
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
                      <h3 style={{ margin: 0, color: '#ff4757', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FaClock /> {verifyResult.message}
                      </h3>
                    ) : (
                      <>
                        <h3 style={{ margin: '0 0 5px', fontSize: '1.2rem', fontWeight: '700' }}>
                          {verifyResult.studentName}
                          <span style={{ color: 'var(--dash-text-sec)', fontSize: '0.9rem', fontWeight: '500', marginLeft: '8px' }}>
                            ({verifyResult.studentId})
                          </span>
                        </h3>
                        <p style={{
                          margin: 0,
                          color: verifyResult.status === 'Completed' ? 'var(--success-color)' : '#ffa502',
                          fontWeight: '600',
                          fontSize: '0.95rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          {verifyResult.status === 'Completed' ? <FaCheckCircle /> : <FaClock />}
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
                          style={{
                            background: 'var(--success-color)',
                            color: '#fff',
                            padding: '10px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: '600',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          Mark Completed
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUndo(verifyResult.bookingId, verifyResult.mealSection)}
                          style={{
                            background: 'rgba(255, 71, 87, 0.1)',
                            color: '#ff4757',
                            padding: '10px 24px',
                            borderRadius: '8px',
                            border: '1px solid #ff4757',
                            fontWeight: '600',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          Undo Status
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 📋 BOOKINGS LIST (TABLE) */}
            <div style={{ background: 'var(--dash-surface)', borderRadius: '15px', padding: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Bookings List</h2>
                {bookings.some(b => b.status !== 'Completed') && (
                  <button
                    onClick={handleMarkAllComplete}
                    style={{
                      background: 'var(--success-color)',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <FaCheckCircle /> Mark All Complete
                  </button>
                )}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #333' }}>
                    <th style={{ padding: '15px 10px', color: 'var(--dash-text-sec)' }}>Student Name</th>
                    <th style={{ padding: '15px 10px', color: 'var(--dash-text-sec)' }}>Student ID</th>
                    {QTY_SECTIONS.includes(selectedSection) && (
                      <th style={{ padding: '15px 10px', color: '#f5a623', fontWeight: 'bold' }}>📦 Qty</th>
                    )}
                    <th style={{ padding: '15px 10px', color: 'var(--dash-text-sec)' }}>Status</th>
                    <th style={{ padding: '15px 10px', color: 'var(--dash-text-sec)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.length === 0 ? (
                    <tr>
                      <td colSpan={QTY_SECTIONS.includes(selectedSection) ? 5 : 4} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No bookings for {selectedSection} on this date.</td>
                    </tr>
                  ) : (
                    bookings.map(b => (
                      <tr key={b.bookingId} style={{ borderBottom: '1px solid #222', transition: 'background 0.2s', ':hover': { background: 'var(--dash-card)' } }}>
                        <td style={{ padding: '15px 10px', fontSize: '1.1rem' }}>{b.studentName}</td>
                        <td style={{ padding: '15px 10px', color: 'var(--dash-text-sec)', fontFamily: 'monospace', fontSize: '1.1rem' }}>{b.studentId}</td>
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

