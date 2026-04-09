import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { FaUtensils, FaHistory, FaExclamationTriangle, FaChartBar, FaSignOutAlt, FaWallet, FaClipboardList, FaUser } from 'react-icons/fa';
import { socket } from '../socket';
import { BadgeIcon } from '../components/BadgeManager';
import { FaAward, FaCrown, FaBolt } from 'react-icons/fa';

const DOMAIN_LABELS = {
  morningTea: '🍵 Morning Tea / Milk',
  morningEgg: '🥚 Morning Egg',
  tiffin: '🥪 Tiffin',
  lunch: '🍱 Lunch',
  lunchEgg: '🥚 Lunch Egg',
  eveningTea: '🍵 Evening Tea / Milk',
  snacks: '🍟 Snacks',
  dinner: '🍽️ Dinner',
  dinnerEgg: '🥚 Dinner Egg',
};
const BADGE_META = {
  none: { color: '#444', icon: '—' },
  silver: { color: '#c0c0c0', icon: '🥈' },
  gold: { color: '#ffd700', icon: '🥇' },
  diamond: { color: '#b9f2ff', icon: '💎' },
};

const StudentDashboard = () => {
  const [profile, setProfile] = useState({ name: '', email: '', walletBalance: 0, _id: '', studentId: '', phone: '', photoBase64: '' });
  const [activeTab, setActiveTab] = useState('menu');

  // Data
  const [menu, setMenu] = useState(null);
  const [selectedMeals, setSelectedMeals] = useState([]);
  const [mealQty, setMealQty] = useState({});
  const [isGuest, setIsGuest] = useState(false);
  const [history, setHistory] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [polls, setPolls] = useState([]);
  const [newComplaint, setNewComplaint] = useState({ topic: '', description: '', imageBase64: '' });
  const [weeklyMenu, setWeeklyMenu] = useState(null);
  const [activeBookings, setActiveBookings] = useState([]);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    toast.success('Logged out');
    navigate('/login');
  };

  useEffect(() => {
    fetchProfile();
    fetchTomorrowMenu();
    fetchHistory();
    fetchComplaints();
    fetchPolls();
    fetchWeeklyMenu();

    setProfile(prev => ({ ...prev, _id: localStorage.getItem('userId') }));

    // Background live sync — poll every 30s to avoid flooding the server
    const syncInterval = setInterval(() => {
      fetchWeeklyMenu();
      fetchTomorrowMenu();
      fetchPolls();
      fetchComplaints();
      fetchActiveBookings();
    }, 30000);

    socket.on('menuUpdated', () => { toast('Menu was updated by Admin', { icon: '🍽️' }); fetchTomorrowMenu(); fetchWeeklyMenu(); });
    socket.on('mealStatusUpdate', () => { fetchHistory(); fetchActiveBookings(); });
    socket.on('walletUpdated', (data) => {
      fetchProfile(); fetchHistory();
      toast('Wallet balance updated!', { icon: '💰' });
    });
    socket.on('complaintUpdated', () => { fetchComplaints(); });
    socket.on('complaintAdded', () => { fetchComplaints(); });
    socket.on('pollCreated', (p) => setPolls(prev => [p, ...prev]));
    socket.on('voteUpdated', (p) => setPolls(prev => prev.map(poll => poll._id === p._id ? p : poll)));
    socket.on('pollDeleted', ({ pollId }) => setPolls(prev => prev.filter(p => p._id !== pollId)));
    socket.on('studentBlocked', (data) => {
      if (data.userId === localStorage.getItem('userId')) {
        setProfile(prev => ({ ...prev, isBlocked: true, blockReason: data.reason || '' }));
        toast.error('🚫 You have been blocked by admin');
      }
    });
    socket.on('studentUnblocked', (data) => {
      if (data.userId === localStorage.getItem('userId')) {
        setProfile(prev => ({ ...prev, isBlocked: false, blockReason: '' }));
        toast.success('✅ Your access has been restored!');
      }
    });

    return () => {
      clearInterval(syncInterval);
      socket.off('menuUpdated');
      socket.off('mealStatusUpdate');
      socket.off('walletUpdated');
      socket.off('complaintUpdated');
      socket.off('complaintAdded');
      socket.off('pollCreated');
      socket.off('voteUpdated');
      socket.off('pollDeleted');
      socket.off('studentBlocked');
      socket.off('studentUnblocked');
    };
  }, []);

  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchProfile = async () => {
    try { const { data } = await api.get('/student/me'); setProfile(data); } catch (err) { }
  };

  const fetchTomorrowMenu = async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = formatDateLocal(tomorrow);
      const { data } = await api.get(`/admin/menu/${dateStr}`);
      setMenu(data);
    } catch (err) { }
  };

  const fetchHistory = async () => {
    try { const { data } = await api.get('/student/history'); setHistory(data); } catch (err) { }
  };

  const fetchComplaints = async () => {
    try { const { data } = await api.get('/student/complaints'); setComplaints(data); } catch (err) { }
  };

  const fetchPolls = async () => {
    try { const { data } = await api.get('/poll/all'); setPolls(data); } catch (err) { }
  };

  const fetchWeeklyMenu = async () => {
    try { const { data } = await api.get('/admin/weekly-menu'); setWeeklyMenu(data); } catch (err) { }
  };

  const fetchActiveBookings = async () => {
    try { const { data } = await api.get('/student/active-bookings'); setActiveBookings(data); } catch (err) { }
  };

  const handleCancelBooking = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this booking? Refund will be added to your wallet.')) return;
    try {
      const { data } = await api.post(`/student/cancel-booking/${id}`);
      toast.success(data.message);
      fetchActiveBookings();
      fetchProfile();
    } catch (err) { toast.error(err.response?.data?.message || 'Cancellation failed'); }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put('/student/profile', { phone: profile.phone, photoBase64: profile.photoBase64 });
      toast.success('Profile updated successfully!');
      fetchProfile();
    } catch (err) { toast.error('Profile update failed'); }
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfile({ ...profile, photoBase64: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleMealToggle = (mealName) => {
    setSelectedMeals(prev => prev.includes(mealName) ? prev.filter(m => m !== mealName) : [...prev, mealName]);
  };

  const isQuantityMeal = (name) => name.toLowerCase().includes('egg') || name.toLowerCase().includes('snack');
  const getQty = (name) => mealQty[name] || 1;
  const adjustQty = (name, delta) => {
    setMealQty(prev => ({ ...prev, [name]: Math.max(1, (prev[name] || 1) + delta) }));
  };

  const calculateTotal = () => {
    if (!menu) return 0;
    let base = selectedMeals.reduce((acc, mealName) => {
      const price = parseInt(menu.items[mealName]?.price || 0);
      const qty = isQuantityMeal(mealName) ? getQty(mealName) : 1;
      return acc + price * qty;
    }, 0);
    return isGuest ? Math.round(base * 1.5) : base;
  };

  const MEAL_ICONS = {
    'Morning Tea': '☕', 'Morning Egg': '🥚', 'Tiffin': '🥞',
    'Lunch': '🍱', 'Lunch Egg': '🥚', 'Evening Tea': '🍵',
    'Evening Snacks': '🍿', 'Dinner': '🍽️', 'Dinner Egg': '🥚'
  };
  const MEAL_COLORS = {
    'Morning Tea': '#f39c12', 'Morning Egg': '#e74c3c', 'Tiffin': '#9b59b6',
    'Lunch': '#27ae60', 'Lunch Egg': '#e74c3c', 'Evening Tea': '#f39c12',
    'Evening Snacks': '#e67e22', 'Dinner': '#2980b9', 'Dinner Egg': '#e74c3c'
  };
  const MEAL_SECTIONS = [
    { label: '🌅 Morning', meals: ['Morning Tea', 'Morning Egg'] },
    { label: '🍠 Tiffin', meals: ['Tiffin'] },
    { label: '☀️ Lunch', meals: ['Lunch', 'Lunch Egg'] },
    { label: '🌆 Evening', meals: ['Evening Tea', 'Evening Snacks'] },
    { label: '🌙 Dinner', meals: ['Dinner', 'Dinner Egg'] },
  ];

  const handleBookMeals = async () => {
    if (profile.isBlocked) return toast.error('Access Denied – You are blocked by admin');
    if (selectedMeals.length === 0) return toast.error('Select at least one meal');
    const mealsWithQty = selectedMeals.map(m => isQuantityMeal(m) ? `${m} x${getQty(m)}` : m);
    try {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = formatDateLocal(tomorrow);
      const { data } = await api.post('/student/book', { date: dateStr, meals: mealsWithQty, isGuest, mealQty });
      toast.success(data.message);
      setSelectedMeals([]); setMealQty({}); fetchProfile(); fetchHistory();
    } catch (err) { toast.error(err.response?.data?.message || 'Booking failed'); }
  };

  // Base64 helper
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setNewComplaint({ ...newComplaint, imageBase64: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const submitComplaint = async (e) => {
    e.preventDefault();
    if (profile.isBlocked) return toast.error('Access Denied – You are blocked by admin');
    try {
      await api.post('/student/complaints', newComplaint);
      toast.success('Complaint submitted!');
      setNewComplaint({ topic: '', description: '', imageBase64: '' });
      fetchComplaints();
    } catch (err) { toast.error('Submit failed'); }
  };

  const likeComplaint = async (id) => {
    try { await api.put(`/student/complaints/${id}/like`); fetchComplaints(); } catch (err) { }
  };

  const [selectedOptions, setSelectedOptions] = useState({}); // pollId -> [optionId]

  // WhatsApp-style: instant vote — supports changing vote too
  const handleInstantVote = async (pollId, optionIds) => {
    if (profile.isBlocked) return toast.error('Access Denied – You are blocked by admin');
    if (!optionIds || optionIds.length === 0) return toast.error('Select at least one option');

    const userId = localStorage.getItem('userId');

    // Optimistic UI update: adjust old vote counts down and new ones up
    setPolls(prev => prev.map(p => {
      if (p._id !== pollId) return p;
      const prevVotes = p.studentVotes?.[userId] || [];
      const updatedOptions = p.options.map(opt => {
        let v = opt.votes;
        if (prevVotes.includes(opt.id) && !optionIds.includes(opt.id)) v = Math.max(0, v - 1); // remove old
        if (!prevVotes.includes(opt.id) && optionIds.includes(opt.id)) v += 1; // add new
        return { ...opt, votes: v };
      });
      const alreadyIn = p.votedBy?.includes(userId);
      return {
        ...p,
        options: updatedOptions,
        votedBy: alreadyIn ? p.votedBy : [...(p.votedBy || []), userId],
        studentVotes: { ...p.studentVotes, [userId]: optionIds }
      };
    }));

    // Clear local pending state — effectiveSelected will now fall back to myVotes (server state)
    setSelectedOptions(prev => { const n = { ...prev }; delete n[pollId]; return n; });

    try {
      const { data } = await api.post('/poll/vote', { pollId, optionIds });
      toast.success(data.message || 'Vote submitted! 🗳️');
    } catch (err) {
      // Rollback: re-fetch polls on failure
      fetchPolls();
      toast.error(err.response?.data?.message || 'Vote failed');
    }
  };

  const toggleOption = (pollId, optId, allowMultiple) => {
    setSelectedOptions(prev => {
      if (!allowMultiple) return { ...prev, [pollId]: [optId] };
      const current = prev[pollId] || [];
      return { ...prev, [pollId]: current.includes(optId) ? current.filter(i => i !== optId) : [...current, optId] };
    });
  };

  const renderTabContent = () => {
    if (activeTab === 'menu') {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const dateLabel = tomorrow.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
      return (
        <div>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #1a1a1a, #222)', padding: '20px 25px', borderRadius: '12px', marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
            <h3 style={{ margin: 0, fontSize: '1.3rem' }}>🍴 Meal Booking</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '5px', fontSize: '0.9rem' }}>Booking for <strong style={{ color: 'var(--primary-color)' }}>{dateLabel}</strong> — Deadline: {menu?.deadline || '19:00'}</p>
          </div>

          {!menu ? (
            <div style={{ background: 'var(--surface-color)', padding: '40px', borderRadius: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: '2rem' }}>🚫</p>
              <h4 style={{ marginTop: '10px' }}>No Menu Published Yet</h4>
              <p style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>Admin hasn't set tomorrow's menu. Check back later.</p>
            </div>
          ) : (
            <div>
              {/* Festival Banner */}
              {menu.isFestival && (
                <div style={{
                  background: 'linear-gradient(135deg, #2a1200 0%, #4a2200 100%)',
                  borderRadius: '16px', padding: '25px', marginBottom: '25px',
                  border: '1px solid #ff7b0055', boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                  position: 'relative', overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '-10px', fontSize: '5rem', opacity: 0.1, pointerEvents: 'none' }}>🎉</div>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ background: '#ff7b00', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Special Event</span>
                      <h2 style={{ margin: 0, color: '#ff7b00', fontSize: '1.6rem', letterSpacing: '0.5px' }}>{menu.festivalName || 'Festival Feast'} 🎊</h2>
                    </div>
                    <p style={{ margin: 0, color: '#ccc', fontSize: '0.95rem', lineHeight: 1.5, maxWidth: '80%' }}>{menu.description || 'Join us for a special celebration menu today!'}</p>
                  </div>
                </div>
              )}

              {/* Meal Sections */}
              {MEAL_SECTIONS.map(section => {
                // Check if any meal in this section is actually available in the filtered menu.items
                const availableMeals = section.meals.filter(m => menu.items[m]);
                if (availableMeals.length === 0) return null;

                return (
                  <div key={section.label} style={{ marginBottom: '20px' }}>
                    <h5 style={{ color: '#888', marginBottom: '10px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{section.label}</h5>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {availableMeals.map(mealName => {
                        const item = menu.items[mealName];
                        const selected = selectedMeals.includes(mealName);
                        const isQty = isQuantityMeal(mealName);
                        const qty = getQty(mealName);
                        const color = MEAL_COLORS[mealName] || 'var(--primary-color)';
                        return (
                          <div key={mealName} onClick={() => handleMealToggle(mealName)} style={{
                            display: 'flex', alignItems: 'center', gap: '15px',
                            background: selected ? `${color}18` : '#1a1a1a',
                            border: `1.5px solid ${selected ? color : '#333'}`,
                            padding: '15px 18px', borderRadius: '12px', cursor: 'pointer',
                            transition: 'all 0.2s ease', boxShadow: selected ? `0 0 12px ${color}30` : 'none'
                          }}>
                            {/* Icon */}
                            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: selected ? color : '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', transition: '0.2s', flexShrink: 0 }}>
                              {MEAL_ICONS[mealName]}
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1 }}>
                              <h4 style={{ margin: 0, fontSize: '1rem', color: selected ? 'white' : '#ccc' }}>{mealName}</h4>
                              <p style={{ color: selected ? '#aaa' : '#666', fontSize: '0.85rem', marginTop: '2px' }}>{item.name || 'Item TBD'}</p>
                            </div>
                            {/* Price + Qty */}
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }} onClick={e => e.stopPropagation()}>
                              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: selected ? color : '#888' }}>₹{item.price * (isQty ? qty : 1)}</span>
                              {isQty && selected && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111', borderRadius: '20px', padding: '4px 10px', border: `1px solid ${color}50` }}>
                                  <button onClick={() => adjustQty(mealName, -1)} style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>−</button>
                                  <span style={{ color: 'white', minWidth: '18px', textAlign: 'center', fontWeight: 'bold' }}>{qty}</span>
                                  <button onClick={() => adjustQty(mealName, 1)} style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>+</button>
                                </div>
                              )}
                              {isQty && !selected && <span style={{ fontSize: '0.75rem', color: '#555' }}>select to set qty</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Guest toggle */}
              <div onClick={() => setIsGuest(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: isGuest ? '#1a260f' : '#1a1a1a', border: `1.5px solid ${isGuest ? '#2ed573' : '#333'}`, padding: '14px 18px', borderRadius: '12px', cursor: 'pointer', marginBottom: '20px', transition: '0.2s' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: isGuest ? '#2ed573' : '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>👥</div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Book for Guest</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>1.5× price markup applies</p>
                </div>
                <div style={{ width: '28px', height: '16px', borderRadius: '8px', background: isGuest ? '#2ed573' : '#444', position: 'relative', transition: '0.3s' }}>
                  <div style={{ width: '12px', height: '12px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: isGuest ? '14px' : '2px', transition: '0.3s' }}></div>
                </div>
              </div>

              {/* Total + Book Button */}
              <div style={{ background: 'linear-gradient(135deg, #1a0a00, #2a1200)', border: '1px solid #ff7b0088', padding: '20px 25px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>{selectedMeals.length} meal{selectedMeals.length !== 1 ? 's' : ''} selected {isGuest ? '(Guest)' : ''}</p>
                  <h2 style={{ margin: '5px 0 0', color: 'var(--primary-color)' }}>₹{calculateTotal()}</h2>
                </div>
                <button onClick={handleBookMeals} style={{ background: selectedMeals.length > 0 ? 'var(--primary-color)' : '#333', color: 'white', border: 'none', padding: '15px 30px', borderRadius: '10px', cursor: selectedMeals.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '1rem', transition: '0.2s' }}>
                  {selectedMeals.length > 0 ? '✅ Confirm & Pay' : 'Select Meals First'}
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
    if (activeTab === 'weekly') {
      const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const MEALS = ["Morning Tea", "Morning Egg", "Tiffin", "Lunch", "Lunch Egg", "Evening Tea", "Evening Snacks", "Dinner", "Dinner Egg"];
      return (
        <div style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: 'var(--border-radius)' }}>
          <h3>Standard Weekly Overview</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>This is the default mess framework. Check Meal Bookings for exact daily variants.</p>
          {!weeklyMenu ? <p>Loading menu...</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              {DAYS.map(day => (
                <div key={day} style={{ background: '#111', padding: '20px', borderRadius: '12px', borderTop: day === new Date().toLocaleDateString('en-US', { weekday: 'long' }) ? '4px solid var(--primary-color)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ color: day === new Date().toLocaleDateString('en-US', { weekday: 'long' }) ? 'var(--primary-color)' : 'white', margin: 0 }}>{day} {day === new Date().toLocaleDateString('en-US', { weekday: 'long' }) && '(Today)'}</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {MEALS.map(meal => (
                      <div key={meal} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
                        <span style={{ color: '#888', fontSize: '0.85rem' }}>{meal} {meal.includes('Egg') ? '🥚' : '🌱'}</span>
                        <span style={{ color: 'white', fontWeight: '500' }}>{weeklyMenu[day]?.[meal]?.name || <span style={{ color: '#555' }}>Not Set</span>} <span style={{ color: 'var(--success-color)' }}>{weeklyMenu[day]?.[meal]?.price > 0 && `(₹${weeklyMenu[day][meal].price})`}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (activeTab === 'history') {
      const sortedHistory = [...history].sort((a, b) => {
        const aHasBooked = Object.values(a.status || {}).some(s => s === 'Booked');
        const bHasBooked = Object.values(b.status || {}).some(s => s === 'Booked');
        if (aHasBooked && !bHasBooked) return -1;
        if (!aHasBooked && bHasBooked) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      return (
        <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: 'var(--border-radius)' }}>
          <h3>Booking History & Attendance</h3>
          <div style={{ marginTop: '15px' }}>
            {history.length === 0 ? <p>No bookings found.</p> : sortedHistory.map(b => (
              <div key={b._id} style={{ background: '#2d2d2d', padding: '15px', borderRadius: '8px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                  <p style={{ margin: 0 }}><strong>Date: </strong> {b.date} {b.isGuest && <span style={{ color: 'var(--primary-color)' }}>(Guest)</span>}</p>
                  <span style={{ background: '#111', padding: '6px 12px', borderRadius: '6px', fontSize: '0.9rem' }}>
                    Total Cost: <strong style={{ color: 'var(--success-color)' }}>₹{b.price}</strong>
                  </span>
                </div>
                <ul style={{ paddingLeft: '20px', color: 'var(--text-secondary)', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...b.meals].sort((m1, m2) => {
                    const s1 = b.status?.[m1.split(' x')[0]] || 'Booked';
                    const s2 = b.status?.[m2.split(' x')[0]] || 'Booked';
                    if (s1 === 'Booked' && s2 !== 'Booked') return -1;
                    if (s1 !== 'Booked' && s2 === 'Booked') return 1;
                    return 0;
                  }).map(m => {
                    const baseName = m.split(' x')[0];
                    const status = b.status?.[baseName] || 'Booked';
                    const qtyMatch = m.match(/x\d+/);
                    const qtyStr = qtyMatch ? ` ${qtyMatch[0]}` : '';
                    const priceStr = b.itemPrices?.[baseName] ? `(₹${b.itemPrices[baseName]})` : '';

                    return (
                      <li key={m} style={{ background: '#222', padding: '8px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', listStyle: 'none' }}>
                        <div>
                          <span style={{ color: 'white' }}>{baseName}</span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: '5px' }}>{qtyStr} {priceStr}</span>
                        </div>
                        <span style={{
                          color: status === 'Completed' ? 'var(--success-color)' : 'orange',
                          fontWeight: 'bold', fontSize: '0.9rem',
                          background: status === 'Completed' ? '#2ed57322' : '#ffa50222',
                          padding: '2px 8px', borderRadius: '4px'
                        }}>
                          {status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (activeTab === 'complaints') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: 'var(--border-radius)' }}>
            <h3>Submit Feedback</h3>
            <form onSubmit={submitComplaint} style={{ marginTop: '15px' }}>
              <div className="form-group">
                <label>Topic (e.g. Cleaning, Water)</label>
                <select value={newComplaint.topic} onChange={e => setNewComplaint({ ...newComplaint, topic: e.target.value })} style={{ width: '100%', padding: '10px', background: 'var(--bg-color)', color: 'white' }} required>
                  <option value="">Select Topic</option>
                  <option value="Cleaning">Cleaning Issue</option>
                  <option value="Drinking Water">Drinking Water</option>
                  <option value="Seating">Seating Problem</option>
                  <option value="Food Quality">Food Quality/Feedback</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea placeholder="Describe the issue..." rows={4} style={{ width: '100%', padding: '10px', background: 'var(--bg-color)', color: 'white' }} value={newComplaint.description} onChange={e => setNewComplaint({ ...newComplaint, description: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Upload Image (Optional)</label>
                <input type="file" accept="image/*" onChange={handleImageChange} />
                {newComplaint.imageBase64 && <img src={newComplaint.imageBase64} style={{ maxWidth: '100px', marginTop: '10px' }} alt="Preview" />}
              </div>
              <button className="btn-primary" type="submit">Submit Feedback</button>
            </form>
          </div>
          <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: 'var(--border-radius)', maxHeight: '600px', overflowY: 'auto' }}>
            <h3>Community Feedbacks</h3>
            {complaints.map(cp => (
              <div key={cp._id} style={{ background: '#2d2d2d', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h4 style={{ color: 'var(--danger-color)' }}>{cp.topic}</h4>
                  <span style={{ color: cp.status === 'Resolved' ? 'var(--success-color)' : 'orange', fontSize: '0.8rem' }}>{cp.status}</span>
                </div>
                <p style={{ margin: '10px 0' }}>{cp.description}</p>
                {cp.imageBase64 && <img src={cp.imageBase64} style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '10px' }} alt="Complaint" />}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>By: {cp.studentName}</span>
                  <button onClick={() => likeComplaint(cp._id)} style={{ background: 'none', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                    👍 {cp.likes}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (activeTab === 'polls') {
      return (
        <div>
          <h3 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>🗳️ Food Polls</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {polls.length === 0 ? (
              <div style={{ background: 'var(--surface-color)', padding: '50px', borderRadius: '14px', textAlign: 'center', color: '#555' }}>
                <p style={{ fontSize: '2.5rem', margin: 0 }}>🗳️</p>
                <p style={{ marginTop: '12px' }}>No polls right now. Check back later!</p>
              </div>
            ) : polls.map(poll => {
              const userId = localStorage.getItem('userId');
              const hasVoted = poll.votedBy?.includes(userId);
              const myVotes = poll.studentVotes?.[userId] || [];
              const nowDt = new Date();
              const deadlineStr = poll.deadline || '';
              const deadlineDt = new Date(deadlineStr.replace(' ', 'T'));
              const isClosed = poll.status === 'closed' || nowDt > deadlineDt;
              const totalVotes = poll.options.reduce((a, o) => a + o.votes, 0);
              const topVotes = Math.max(...poll.options.map(o => o.votes));
              // canVote = true even if already voted (to allow changing)
              const canVote = !isClosed;
              const showResults = hasVoted || isClosed;

              return (
                <div key={poll._id} style={{
                  background: 'var(--surface-color)', borderRadius: '16px', overflow: 'hidden',
                  border: '1px solid #1e1e1e',
                  borderTop: `4px solid ${isClosed ? '#ff4757' : hasVoted ? '#1e90ff' : '#2ed573'}`,
                }}>
                  {/* Header */}
                  <div style={{ padding: '20px 22px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.3 }}>{poll.title}</h3>
                        {poll.description && <p style={{ color: '#888', fontSize: '0.85rem', margin: '5px 0 0' }}>{poll.description}</p>}
                      </div>
                      <span style={{
                        background: isClosed ? '#ff475718' : hasVoted ? '#1e90ff18' : '#2ed57318',
                        color: isClosed ? '#ff4757' : hasVoted ? '#1e90ff' : '#2ed573',
                        padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0
                      }}>
                        {isClosed ? '🔒 Closed' : hasVoted ? '✅ Voted' : '🟢 Active'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#555', marginTop: '10px' }}>
                      📅 {new Date(poll.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      &nbsp;|&nbsp;
                      <span style={{ color: isClosed ? '#ff4757' : '#f39c12' }}>⏰ Deadline: {deadlineStr.replace('T', ' ')}</span>
                      &nbsp;|&nbsp;
                      <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                    </p>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', background: '#333', color: '#ccc', padding: '3px 10px', borderRadius: '6px' }}>
                        🔗 {DOMAIN_LABELS[poll.domain] || 'General'}
                      </span>
                      {(() => {
                        const pollDomain = poll.domain || 'none';
                        const userBadge = profile.domainBadges?.[pollDomain] || profile.badge || 'none';
                        const weight = userBadge === 'diamond' ? 10 : userBadge === 'gold' ? 7 : userBadge === 'silver' ? 5 : 1;
                        if (weight === 1) return null;
                        return (
                          <span style={{ fontSize: '0.75rem', background: `${BADGE_META[userBadge].color}22`, color: BADGE_META[userBadge].color, padding: '3px 10px', borderRadius: '6px', fontWeight: 'bold', border: `1px solid ${BADGE_META[userBadge].color}44` }}>
                            ⚡ Your Vote: {weight}x ({userBadge})
                          </span>
                        );
                      })()}
                    </div>
                    {!isClosed && (
                      <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '10px' }}>
                        {poll.allowMultiple
                          ? (hasVoted ? '✅ Voted · Tap to add or remove options instantly' : '☑️ Tap any option to vote — tap again to remove')
                          : (hasVoted ? '✅ Voted · Tap another option to change' : '🔘 Tap an option to vote instantly')}
                      </p>
                    )}
                  </div>

                  {/* Options — NEVER reorder while poll is open, only sort by votes when closed */}
                  <div style={{ padding: '0 14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(isClosed ? [...poll.options].sort((a, b) => b.votes - a.votes) : poll.options).map(opt => {
                      const pct = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);
                      const isTop = opt.votes === topVotes && opt.votes > 0;
                      const isMineServer = myVotes.includes(opt.id); // server-recorded vote (single-select)
                      // For multi-select: use local pending state for immediate visual feedback
                      const effectiveSelected = poll.allowMultiple
                        ? (selectedOptions[poll._id] !== undefined ? selectedOptions[poll._id] : myVotes)
                        : myVotes;
                      const isChecked = effectiveSelected.includes(opt.id);
                      const isHighlighted = isChecked;

                      return (
                        <div
                          key={opt.id}
                          onClick={() => {
                            if (!canVote) return;
                            if (!poll.allowMultiple) {
                              if (isMineServer) return; // single-select: already this one, no-op
                              handleInstantVote(poll._id, [opt.id]);
                            } else {
                              // Multi-select: compute next selection and submit INSTANTLY
                              const base = selectedOptions[poll._id] !== undefined
                                ? selectedOptions[poll._id]
                                : myVotes;
                              const next = base.includes(opt.id)
                                ? base.filter(id => id !== opt.id)   // deselect this option
                                : [...base, opt.id];                  // select this option
                              if (next.length === 0) {
                                // All deselected — update local state only (can't submit empty vote)
                                setSelectedOptions(prev => ({ ...prev, [poll._id]: [] }));
                              } else {
                                handleInstantVote(poll._id, next); // instant submit!
                              }
                            }
                          }}
                          style={{
                            position: 'relative', overflow: 'hidden',
                            background: isHighlighted ? 'linear-gradient(90deg, #1e90ff12, #1e90ff06)' : '#111',
                            border: `1.5px solid ${isHighlighted ? '#1e90ff66' : '#252525'}`,
                            borderLeft: `3px solid ${isHighlighted ? '#1e90ff' : '#252525'}`,
                            borderRadius: '10px', padding: '12px 14px',
                            cursor: canVote ? 'pointer' : 'default',
                            transition: 'all 0.18s ease',
                            boxShadow: isHighlighted ? '0 0 0 1px #1e90ff22, inset 0 0 12px #1e90ff08' : 'none',
                          }}
                        >
                          {/* Background fill bar (visible after voting or closed) */}
                          {showResults && (
                            <div style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0,
                              width: `${pct}%`,
                              background: isHighlighted ? '#1e90ff0a' : isTop ? '#2ed5730a' : '#ffffff03',
                              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                              pointerEvents: 'none', borderRadius: '0 6px 6px 0'
                            }} />
                          )}

                          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                              {/* Selection indicator */}
                              <div style={{
                                width: '18px', height: '18px', flexShrink: 0,
                                borderRadius: poll.allowMultiple ? '5px' : '50%',
                                border: `2px solid ${isHighlighted ? '#1e90ff' : '#3a3a3a'}`,
                                background: isHighlighted ? '#1e90ff' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.18s ease',
                                boxShadow: isHighlighted ? '0 0 6px #1e90ff66' : 'none',
                              }}>
                                {isHighlighted && (
                                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                    <path d="M1 3L3.5 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <span style={{
                                  color: isHighlighted ? '#90c8ff' : isTop && isClosed ? '#2ed573' : '#d0d0d0',
                                  fontWeight: isHighlighted || (isTop && isClosed) ? '600' : '400',
                                  fontSize: '0.95rem',
                                  display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                }}>
                                  {opt.item}
                                </span>
                                <span style={{ color: '#555', fontSize: '0.78rem' }}>₹{opt.price}</span>
                              </div>
                            </div>

                            {/* Vote count — only shown after voting or closed */}
                            {showResults && (
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <span style={{
                                  color: isHighlighted ? '#1e90ff' : isTop && isClosed ? '#2ed573' : '#666',
                                  fontWeight: 'bold', fontSize: '0.95rem'
                                }}>
                                  {opt.votes}
                                </span>
                                <span style={{ color: '#3a3a3a', fontSize: '0.76rem', marginLeft: '3px' }}>
                                  vote{opt.votes !== 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {isClosed && (
                    <div style={{ padding: '12px 22px 16px', borderTop: '1px solid #1e1e1e', textAlign: 'center', color: '#ff4757', fontSize: '0.85rem' }}>
                      🔒 Voting closed — final results above.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (activeTab === 'booked') {
      return (
        <div>
          <div style={{ background: 'linear-gradient(135deg, #1a1a1a, #222)', padding: '20px 25px', borderRadius: '12px', marginBottom: '20px', borderLeft: '4px solid #2ed573' }}>
            <h3 style={{ margin: 0, fontSize: '1.3rem' }}>✅ Your Booked Meals</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '5px', fontSize: '0.9rem' }}>Show these 4-digit codes at the counter to verify your meal.</p>
          </div>

          {activeBookings.length === 0 ? (
            <div style={{ background: 'var(--surface-color)', padding: '40px', borderRadius: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: '2rem' }}>📦</p>
              <h4 style={{ marginTop: '10px' }}>No Upcoming Bookings</h4>
              <p style={{ color: 'var(--text-secondary)', marginTop: '5px' }}>Go to the Meal Booking tab to place an order.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '20px' }}>
              {activeBookings.map(b => (
                <div key={b._id} style={{ background: 'var(--surface-color)', borderRadius: '15px', padding: '20px', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                    <div>
                      <h4 style={{ color: '#2ed573', margin: 0 }}>Date: {new Date(b.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</h4>
                      <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>Booked on: {new Date(b.createdAt).toLocaleString()}</p>
                    </div>
                    <button onClick={() => handleCancelBooking(b._id)} style={{ padding: '8px 15px', background: '#ff475722', color: '#ff4757', border: '1.5px solid #ff475755', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.2s' }}>✕ Cancel Booking</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                    {Object.keys(b.codes || {}).map(meal => (
                      <div key={meal} style={{ background: '#111', padding: '15px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `3px solid ${MEAL_COLORS[meal] || 'var(--primary-color)'}` }}>
                        <div>
                          <span style={{ fontSize: '1.3rem', marginRight: '10px' }}>{MEAL_ICONS[meal]}</span>
                          <span style={{ fontWeight: 'bold', color: '#ccc' }}>{meal}</span>
                          {b.mealQty && b.mealQty[meal] > 1 && <span style={{ color: '#888', marginLeft: '8px', fontSize: '0.8rem' }}>x{b.mealQty[meal]}</span>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <label style={{ fontSize: '0.7rem', color: '#555', display: 'block', textTransform: 'uppercase' }}>Token Code</label>
                          <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#2ed573', letterSpacing: '2px' }}>{b.codes[meal]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '15px', textAlign: 'right', color: '#888', fontSize: '0.9rem' }}>
                    Total Cost: <strong style={{ color: 'white' }}>₹{b.price}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'profile') {
      return (
        <div style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: 'var(--border-radius)', maxWidth: '600px', margin: '0 auto' }}>
          <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span><FaUser /> My Profile</span>
            {profile.badge && profile.badge !== 'none' && <BadgeIcon badge={profile.badge} size={24} />}
          </h3>

          {/* Domain Badges Grid */}
          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <div style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>My Domain Badges</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {Object.entries(DOMAIN_LABELS).map(([key, label]) => {
                const badge = profile.domainBadges?.[key] ?? 'none';
                const meta = BADGE_META[badge];
                return (
                  <div key={key} style={{
                    background: '#111', borderRadius: '12px', padding: '12px',
                    border: badge !== 'none' ? `1px solid ${meta.color}44` : '1px solid #1e1e1e',
                    display: 'flex', alignItems: 'center', gap: '10px'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>{meta.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#555' }}>{label}</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: meta.color, textTransform: 'capitalize' }}>{badge}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Benefits summary */}
          <div style={{ background: 'linear-gradient(135deg, #1e1e1e, #111)', borderRadius: '12px', padding: '16px', border: '1px solid #2a2a2a', marginBottom: '20px', display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', marginBottom: '4px' }}>Top Badge</div>
              <div style={{ fontWeight: '900', fontSize: '1rem', textTransform: 'capitalize', color: BADGE_META[profile.badge || 'none']?.color ?? '#aaa' }}>
                {profile.badge === 'none' || !profile.badge ? 'No badge yet' : `${profile.badge} Tier`}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '3px' }}>{profile.totalBookings || 0} total bookings</div>
            </div>
            <div style={{ flex: 1, borderLeft: '1px solid #2a2a2a', paddingLeft: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginBottom: '6px' }}>
                <FaBolt style={{ color: '#f39c12' }} />
                <span>Voting Power: <strong>{profile.badge === 'diamond' ? '10x' : profile.badge === 'gold' ? '7x' : profile.badge === 'silver' ? '5x' : '1x'}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
                <FaCrown style={{ color: '#2ed573' }} />
                <span>Feedback: <strong>{(!profile.badge || profile.badge === 'none') ? 'Standard' : 'High Priority'}</strong></span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '30px', marginBottom: '20px' }}>
            {profile.photoBase64 ? (
              <img src={profile.photoBase64} alt="Profile" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary-color)' }} />
            ) : (
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: '#222', border: '3px dashed #444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '2rem' }}>👤</div>
            )}
          </div>

          <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="form-group" style={{ marginBottom: '0' }}>
              <label>Student Name</label>
              <input type="text" value={profile.name} disabled style={{ background: '#111', color: '#888' }} />
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: '0' }}>
                <label>Email ID</label>
                <input type="text" value={profile.email} disabled style={{ background: '#111', color: '#888' }} />
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: '0' }}>
                <label>Student ID</label>
                <input type="text" value={profile.studentId} disabled style={{ background: '#111', color: '#888' }} />
              </div>
            </div>

            <h4 style={{ marginTop: '10px', color: 'white' }}>Editable Information</h4>

            <div className="form-group" style={{ marginBottom: '0' }}>
              <label>Phone Number (Optional)</label>
              <input type="text" placeholder="+91 9876543210" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} style={{ background: '#181818', color: 'white' }} />
            </div>
            <div className="form-group" style={{ marginBottom: '0' }}>
              <label>Update Profile Photo</label>
              <input type="file" accept="image/*" onChange={handleProfileImageChange} />
            </div>
            <button type="submit" className="btn-primary" style={{ marginTop: '15px' }}>Save Profile Changes</button>
          </form>
        </div>
      );
    }
  };

  const navItems = [
    { id: 'profile', label: 'My Profile', icon: <FaUser /> },
    { id: 'menu', label: 'Meal Booking', icon: <FaUtensils /> },
    { id: 'booked', label: 'Booked Meals', icon: <FaClipboardList /> },
    { id: 'weekly', label: 'Weekly Menu', icon: <FaClipboardList /> },
    { id: 'history', label: 'History & Attend.', icon: <FaHistory /> },
    { id: 'complaints', label: 'Feedbacks', icon: <FaExclamationTriangle /> },
    { id: 'polls', label: 'Polls', icon: <FaChartBar /> },
  ];

  return (
    <div className="dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>

      {/* SIDEBAR */}
      <div className="sidebar" style={{ width: '260px', background: 'var(--surface-color)', padding: '25px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #222' }}>
        <h2 style={{ color: 'var(--primary-color)', marginBottom: '40px', fontWeight: '800' }}>Smart Mess</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1 }}>
          {navItems.map(item => (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
                background: activeTab === item.id ? 'var(--primary-color)' : 'transparent',
                color: activeTab === item.id ? 'white' : 'var(--text-secondary)',
                fontWeight: activeTab === item.id ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', borderTop: '1px solid #333', paddingTop: '20px' }}>
          <div onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--danger-color)', cursor: 'pointer', padding: '12px 16px' }}>
            <FaSignOutAlt />
            <span>Logout</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="main-content" style={{ flex: 1, padding: '40px', overflowY: 'auto', maxHeight: '100vh' }}>

        {/* BLOCKED BANNER */}
        {profile.isBlocked && (
          <div style={{
            background: 'linear-gradient(135deg, #c0392b, #e74c3c)', color: 'white',
            padding: '18px 25px', borderRadius: '12px', marginBottom: '20px',
            display: 'flex', alignItems: 'center', gap: '15px',
            boxShadow: '0 4px 20px rgba(231,76,60,0.4)', animation: 'pulse 2s infinite'
          }}>
            <span style={{ fontSize: '2rem' }}>🚫</span>
            <div>
              <strong style={{ fontSize: '1.1rem' }}>Your account has been blocked by the administrator</strong>
              {profile.blockReason && <p style={{ margin: '5px 0 0', opacity: 0.9, fontSize: '0.9rem' }}>Reason: {profile.blockReason}</p>}
              <p style={{ margin: '5px 0 0', opacity: 0.8, fontSize: '0.85rem' }}>All actions are disabled. Please contact the mess admin to resolve this.</p>
            </div>
          </div>
        )}

        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div>
            <h2 style={{ margin: 0 }}>Welcome back, <span style={{ color: 'var(--primary-color)' }}>{profile.name}</span></h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '5px' }}>Here is what's happening at the mess today.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {profile.badge && profile.badge !== 'none' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface-color)', padding: '12px 20px', borderRadius: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', border: '1px solid #333' }}>
                <BadgeIcon badge={profile.badge} size={20} />
                <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>{profile.badge} Tier</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'var(--surface-color)', padding: '12px 25px', borderRadius: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <FaWallet color="var(--primary-color)" size={20} />
              <span style={{ fontWeight: 'bold' }}>Wallet Balance: <span style={{ color: 'var(--success-color)' }}>₹{profile.walletBalance}</span></span>
            </div>
          </div>
        </header>

        <div>
          {renderTabContent()}
        </div>
      </div>

    </div>
  );
};

export default StudentDashboard;
