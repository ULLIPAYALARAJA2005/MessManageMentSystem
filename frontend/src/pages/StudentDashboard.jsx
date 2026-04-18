import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { FaUtensils, FaHistory, FaExclamationTriangle, FaChartBar, FaSignOutAlt, FaWallet, FaClipboardList, FaUser, FaCommentAlt, FaSyncAlt, FaThumbsUp, FaRegThumbsUp, FaTrash, FaUsers } from 'react-icons/fa';
import { socket } from '../socket';
import { QRCodeSVG } from 'qrcode.react';
import { BadgeIcon } from '../components/BadgeManager';
import { FaAward, FaCrown, FaBolt } from 'react-icons/fa';
import FeedbackForm from '../components/FeedbackForm';
import AutoOrderManager from '../components/AutoOrderManager';
import StudentHistoryDashboard from '../components/StudentHistoryDashboard';

const DOMAIN_LABELS = {
  morningTea: '🍵 Morning Tea / Milk',
  morningEgg: '🥚 Morning Egg',
  morningBanana: '🍌 Morning Banana',
  tiffin: '🥪 Tiffin',
  lunchVeg: '🌱 Lunch Veg',
  lunchNonVeg: '🍗 Lunch Non-Veg',
  lunchEgg: '🥚 Lunch Egg',
  eveningTea: '🍵 Evening Tea / Milk',
  snacks: '🍟 Snacks',
  dinnerVeg: '🌱 Dinner Veg',
  dinnerNonVeg: '🍗 Dinner Non-Veg',
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data
  const [menu, setMenu] = useState(null);
  const bookingOffset = 1; // Always book for Tomorrow
  const [selectedMeals, setSelectedMeals] = useState([]);
  const [mealQty, setMealQty] = useState({});
  const [isGuest, setIsGuest] = useState(false);
  const [history, setHistory] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [polls, setPolls] = useState([]);
  const [newComplaint, setNewComplaint] = useState({ topic: '', description: '', imageBase64: '' });
  const [weeklyMenu, setWeeklyMenu] = useState(null);
  const [activeBookings, setActiveBookings] = useState([]);
  const [activeFeedback, setActiveFeedback] = useState(null);
  const [hasFeedbackBadge, setHasFeedbackBadge] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [activeWeeklyDay, setActiveWeeklyDay] = useState(new Date().toLocaleDateString('en-US', { weekday: 'long' }));
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    toast.success('Logged out');
    navigate('/login');
  };

  useEffect(() => {
    // 1. Core Bootstrap Fast-Load
    fetchProfile();
    fetchActiveFeedback();
    fetchNotifications();

    setProfile(prev => ({ ...prev, _id: localStorage.getItem('userId') }));

    // 2. WebSockets (Live Data) - Replacing the heavy interval polling
    socket.on('menuUpdated', (data) => {
      if (data?.action === 'deleted') {
        // Check if the deleted date matches the student's booking date
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + bookingOffset);
        const bookingDateStr = formatDateLocal(targetDate);
        if (!data.date || data.date === bookingDateStr) {
          setMenu(null); // Immediately clear — no weekly fallback shown
          toast('Menu for tomorrow was removed by Admin', { icon: '🗑️' });
        }
      } else {
        toast('Menu was updated by Admin', { icon: '🍽️' });
        fetchMenu(bookingOffset);
        fetchWeeklyMenu();
      }
    });
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
    socket.on('feedbackCycleCreated', (cycle) => {
      setActiveFeedback({ ...cycle, hasSubmitted: false });
      setHasFeedbackBadge(true);
      toast('📝 New Feedback Available! Please submit your weekly feedback.', { icon: '📋', duration: 5000 });
    });
    socket.on('pollUpdated', (p) => setPolls(prev => prev.map(poll => poll._id === p._id ? p : poll)));
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
      socket.off('menuUpdated');
      socket.off('mealStatusUpdate');
      socket.off('walletUpdated');
      socket.off('complaintUpdated');
      socket.off('complaintAdded');
      socket.off('pollCreated');
      socket.off('voteUpdated');
      socket.off('pollDeleted');
      socket.off('feedbackCycleCreated');
      socket.off('studentBlocked');
      socket.off('studentUnblocked');
      socket.off('pollUpdated');
    };
  }, []);

  // 3. LAZY LOADING - Only fetch what the user asks for when they click a tab to dramatically reduce loading times
  useEffect(() => {
    if (activeTab === 'menu') fetchMenu(bookingOffset);
    else if (activeTab === 'history') fetchHistory();
    else if (activeTab === 'complaints') fetchComplaints();
    else if (activeTab === 'polls') fetchPolls();
    else if (activeTab === 'weekly') fetchWeeklyMenu();
    else if (activeTab === 'booked') fetchActiveBookings();
  }, [activeTab]);

  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchProfile = async () => {
    try { const { data } = await api.get('/student/me'); setProfile(data); } catch (err) { }
  };

  const fetchMenu = async (offset = 0) => {
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + offset);
      const dateStr = formatDateLocal(targetDate);
      const { data } = await api.get(`/admin/menu/${dateStr}`);
      setMenu(data);
    } catch (err) {
      setMenu(null); // Explicitly clear menu if not published
    }
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

  const fetchNotifications = async () => {
    try { const { data } = await api.get('/student/notifications'); setNotifications(data); } catch (err) { }
  };

  const fetchWeeklyMenu = async () => {
    try { const { data } = await api.get('/admin/weekly-menu'); setWeeklyMenu(data); } catch (err) { }
  };

  const fetchActiveBookings = async () => {
    try { const { data } = await api.get('/student/active-bookings'); setActiveBookings(data); } catch (err) { }
  };

  const fetchActiveFeedback = async () => {
    try {
      const { data } = await api.get('/feedback/active');
      setActiveFeedback(data);
      if (data && !data.hasSubmitted) setHasFeedbackBadge(true);
    } catch (err) { }
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
    'Morning Tea/Milk': '☕', 'Morning Egg': '🥚', 'Morning Banana': '🍌', 'Tiffin': '🥞',
    'Lunch Veg': '🌱', 'Lunch Non-Veg': '🍗', 'Lunch Egg': '🥚',
    'Evening Tea/Milk': '🍵', 'Snacks': '🍿',
    'Dinner Veg': '🌱', 'Dinner Non-Veg': '🍗', 'Dinner Egg': '🥚'
  };
  const MEAL_COLORS = {
    'Morning Tea/Milk': '#f39c12', 'Morning Egg': '#e74c3c', 'Morning Banana': '#ffeb3b', 'Tiffin': '#9b59b6',
    'Lunch Veg': '#4caf50', 'Lunch Non-Veg': '#ff7043', 'Lunch Egg': '#e74c3c',
    'Evening Tea/Milk': '#f39c12', 'Snacks': '#e67e22',
    'Dinner Veg': '#4caf50', 'Dinner Non-Veg': '#ff7043', 'Dinner Egg': '#e74c3c'
  };
  const MEAL_SECTIONS = [
    { label: '🌅 Morning', meals: ['Morning Tea/Milk', 'Morning Egg', 'Morning Banana'] },
    { label: '🍠 Tiffin', meals: ['Tiffin'] },
    { label: '☀️ Lunch', meals: ['Lunch Veg', 'Lunch Non-Veg', 'Lunch Egg'] },
    { label: '🌆 Evening', meals: ['Evening Tea/Milk', 'Snacks'] },
    { label: '🌙 Dinner', meals: ['Dinner Veg', 'Dinner Non-Veg', 'Dinner Egg'] },
  ];

  const handleBookMeals = async () => {
    if (profile.isBlocked) return toast.error('Access Denied – You are blocked by admin');
    if (selectedMeals.length === 0) return toast.error('Select at least one meal');
    const mealsWithQty = selectedMeals.map(m => isQuantityMeal(m) ? `${m} x${getQty(m)}` : m);
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + bookingOffset);
      const dateStr = formatDateLocal(targetDate);
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
      setShowFeedbackModal(false);
      fetchComplaints();
    } catch (err) { toast.error('Submit failed'); }
  };

  const deleteComplaint = async (id) => {
    if (!window.confirm('Are you sure you want to delete this community feedback?')) return;
    try {
      await api.delete(`/student/complaints/${id}`);
      toast.success('Feedback deleted!');
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const likeComplaint = async (id) => {
    const currentUserId = localStorage.getItem('userId');

    // Optimistic UI update: Instantly update the upvote button visually without waiting for network
    setComplaints(prev => prev.map(cp => {
      if (cp._id === id) {
        const hasLiked = cp.likedBy?.includes(currentUserId);
        const newLikedBy = hasLiked
          ? cp.likedBy.filter(uid => uid !== currentUserId)
          : [...(cp.likedBy || []), currentUserId];
        return {
          ...cp,
          likedBy: newLikedBy,
          likes: hasLiked ? Math.max(0, cp.likes - 1) : cp.likes + 1
        };
      }
      return cp;
    }));

    // Perform network sync purely in the background
    try {
      await api.put(`/student/complaints/${id}/like`);
      // No need to fetchComplaints() here since the UI is already explicitly updated!
    } catch (err) {
      // Fallback: Revert by fetching real state if API fails
      fetchComplaints();
    }
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
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + bookingOffset);
      const dateStrForCheck = formatDateLocal(targetDate);
      const dateLabel = targetDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
      const deadlineText = menu?.deadline
        ? (menu.deadline.includes('T') ? new Date(menu.deadline).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : menu.deadline)
        : '—';

      const existingBooking = history.find(b => b.date === dateStrForCheck);

      return (
        <div>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #1a1a1a, #222)', padding: '20px 25px', borderRadius: '12px', marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.3rem' }}>🍴 Tomorrow's Menu Booking</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '5px', fontSize: '0.9rem' }}>Booking for <strong style={{ color: 'var(--primary-color)' }}>{dateLabel}</strong> — Deadline: <strong>{deadlineText}</strong></p>
                {menu?.createdAt && (
                  <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid rgba(46, 204, 113, 0.2)' }}>
                    <span style={{ fontSize: '1rem' }}>📢</span> Admin recently updated this menu!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Already-booked banner — shown on top of menu, not replacing it */}
          {existingBooking && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              background: existingBooking.isAutoBooked
                ? 'linear-gradient(135deg, #10b98108, #04785708)'
                : 'linear-gradient(135deg, #1e3a2208, #0a2208)',
              border: `1.5px solid ${existingBooking.isAutoBooked ? '#10b98155' : '#2ed57355'}`,
              borderRadius: '12px', padding: '16px 20px', marginBottom: '20px'
            }}>
              <span style={{ fontSize: '2rem' }}>✅</span>
              <div>
                <div style={{ fontWeight: '800', fontSize: '1rem', color: '#e2e8f0' }}>
                  Meal Already Booked for {dateLabel}
                </div>
                {existingBooking.isAutoBooked ? (
                  <div style={{ fontSize: '0.82rem', color: '#10b981', marginTop: '3px' }}>
                    ⚡ Auto Delivery System reserved this meal automatically
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '3px' }}>
                    You manually booked this meal. View it in Booked Meals tab.
                  </div>
                )}
              </div>
            </div>
          )}

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
      const SECTIONS = [
        { label: '🌅 Early Morning', icon: '🍳', meals: ["Morning Tea/Milk", "Morning Egg", "Morning Banana"] },
        { label: '🥪 Morning Tiffin', icon: '🥪', meals: ["Tiffin"] },
        { label: '🍛 Balanced Lunch', icon: '🍗', meals: ["Lunch Veg", "Lunch Non-Veg", "Lunch Egg"] },
        { label: '🌆 Evening & Dinner', icon: '🍱', meals: ["Evening Tea/Milk", "Snacks", "Dinner Veg", "Dinner Non-Veg", "Dinner Egg"] }
      ];
      
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

      return (
        <div style={{ animation: 'uiFadeIn 0.4s ease-out' }}>
          <style>{`
            @keyframes uiFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            .day-btn { padding: 12px 20px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); color: var(--text-sec); cursor: pointer; transition: 0.2s; font-weight: 600; font-size: 0.9rem; }
            .day-btn.active { background: var(--primary-color); color: white; border-color: var(--primary-color); box-shadow: 0 4px 15px rgba(255,123,0,0.3); }
            .day-btn:hover:not(.active) { background: var(--border); color: var(--text); }
          `}</style>

          <div style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: '14px', marginBottom: '20px', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0 }}>📋 Standard Weekly Overview</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.9rem' }}>
              This is the default mess framework. For exact daily variants and booking, visit the <strong>Meal Booking</strong> tab.
            </p>
          </div>

          {/* DAY SELECTOR */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '25px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' }}>
            {DAYS.map(day => (
              <button key={day} onClick={() => setActiveWeeklyDay(day)} className={`day-btn ${activeWeeklyDay === day ? 'active' : ''}`}>
                {day} {day === today && '•'}
              </button>
            ))}
          </div>

          {!weeklyMenu ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-sec)' }}>Loading mess framework...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px' }}>
              {SECTIONS.map((section, sIdx) => {
                const dayData = weeklyMenu[activeWeeklyDay] || {};
                return (
                  <div key={sIdx} style={{ background: 'var(--surface-color)', borderRadius: '20px', padding: '20px', border: '1px solid var(--border)' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)', marginBottom: '15px', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{section.icon}</span> {section.label}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {section.meals.map(meal => {
                        const item = dayData[meal];
                        const hasName = item?.name && item.name.toLowerCase() !== 'not set';
                        return (
                          <div key={meal} style={{ 
                            background: 'var(--card)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ 
                                fontSize: '0.62rem', 
                                color: MEAL_COLORS[meal] || 'var(--text-sec)', 
                                textTransform: 'uppercase', 
                                fontWeight: 900, 
                                marginBottom: '4px',
                                letterSpacing: '0.4px'
                              }}>
                                {meal}
                              </p>
                              <span style={{ fontWeight: '600', fontSize: '0.92rem', color: hasName ? 'var(--text)' : 'var(--text-sec)', opacity: hasName ? 1 : 0.5 }}>
                                {hasName ? item.name : 'Not Scheduled'}
                              </span>
                            </div>
                            {item?.price > 0 && (
                              <div style={{ color: 'var(--success-color)', fontWeight: 'bold', fontSize: '1rem', background: 'rgba(46, 213, 115, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>
                                ₹{item.price}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    if (activeTab === 'history') {
      return (
        <StudentHistoryDashboard history={history} />
      );
    }
    if (activeTab === 'complaints') {
      const currentUserId = localStorage.getItem('userId');
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', maxWidth: '850px', margin: '0 auto', width: '100%' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-color)', padding: '25px 30px', borderRadius: '16px', border: '1px solid #1e1e1e', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.6rem', color: 'white' }}>Community Feedbacks</h3>
              <p style={{ margin: '0', color: '#888', fontSize: '0.95rem' }}>Upvote issues you agree with so admins prioritize them.</p>
            </div>
            <button
              onClick={() => setShowFeedbackModal(true)}
              className="btn-primary"
              style={{ background: 'var(--primary-color)', color: 'white', padding: '12px 24px', fontSize: '1.05rem', fontWeight: 'bold', border: 'none', borderRadius: '30px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(231,76,60,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FaCommentAlt /> Add Feedback
            </button>
          </div>

          {showFeedbackModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ background: '#131316', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '500px', border: '1px solid #2a2a2a', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', position: 'relative' }}>
                <button
                  onClick={() => setShowFeedbackModal(false)}
                  style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: '#666', fontSize: '1.5rem', cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseOver={(e) => e.currentTarget.style.color = 'white'}
                  onMouseOut={(e) => e.currentTarget.style.color = '#666'}
                >
                  ✕
                </button>
                <h3 style={{ margin: '0 0 25px 0', fontSize: '1.5rem', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FaExclamationTriangle style={{ color: 'var(--primary-color)' }} /> Submit New Feedback
                </h3>
                <form onSubmit={submitComplaint} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>Topic Category</label>
                    <select value={newComplaint.topic} onChange={e => setNewComplaint({ ...newComplaint, topic: e.target.value })} style={{ width: '100%', padding: '14px', background: '#08080a', color: 'white', border: '1px solid #333', borderRadius: '12px', cursor: 'pointer', fontSize: '1rem', outline: 'none' }} required>
                      <option value="">Select Topic</option>
                      <option value="Cleaning">🧹 Cleaning Issue</option>
                      <option value="Drinking Water">💧 Drinking Water</option>
                      <option value="Seating">🪑 Seating Problem</option>
                      <option value="Food Quality">🍲 Food Quality/Feedback</option>
                      <option value="Suggestion">💡 General Suggestion</option>
                      <option value="Other">📌 Other</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>Description</label>
                    <textarea placeholder="Describe the issue or provide detailed feedback..." rows={5} style={{ width: '100%', padding: '14px', background: '#08080a', color: 'white', border: '1px solid #333', borderRadius: '12px', resize: 'vertical', fontSize: '1rem', outline: 'none' }} value={newComplaint.description} onChange={e => setNewComplaint({ ...newComplaint, description: e.target.value })} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>Attach Photo (Optional)</label>
                    <input type="file" accept="image/*" onChange={handleImageChange} style={{ marginTop: '5px', width: '100%' }} />
                    {newComplaint.imageBase64 && (
                      <div style={{ marginTop: '15px', position: 'relative', display: 'inline-block' }}>
                        <img src={newComplaint.imageBase64} style={{ height: '100px', borderRadius: '12px', border: '1px solid #444', objectFit: 'cover' }} alt="Preview" />
                      </div>
                    )}
                  </div>
                  <button type="submit" style={{ marginTop: '10px', padding: '15px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(231,76,60,0.4)', transition: 'transform 0.1s' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>Post to Community</button>
                </form>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', paddingBottom: '40px' }}>
            {complaints.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', background: 'var(--surface-color)', borderRadius: '16px', border: '1px dashed #333' }}>
                <span style={{ fontSize: '3.5rem' }}>🍃</span>
                <h3 style={{ margin: '15px 0 5px 0', color: '#ccc' }}>All caught up!</h3>
                <p style={{ color: '#666', margin: 0 }}>No active feedbacks from the community right now.</p>
              </div>
            ) : (
              complaints.map(cp => {
                const hasLiked = cp.likedBy?.includes(currentUserId);
                let statusBg = '#333';
                let statusColor = '#888';
                if (cp.status === 'Resolved') { statusBg = 'rgba(46, 213, 115, 0.15)'; statusColor = '#2ed573'; }
                if (cp.status === 'Pending') { statusBg = 'rgba(255, 165, 2, 0.15)'; statusColor = '#ffa502'; }
                if (cp.status === 'In Progress') { statusBg = 'rgba(30, 144, 255, 0.15)'; statusColor = '#1e90ff'; }

                return (
                  <div key={cp._id} style={{ background: 'var(--surface-color)', padding: '30px', borderRadius: '16px', border: '1px solid #1e1e1e', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ background: '#111', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.4rem', color: 'var(--primary-color)', border: '1px solid #333' }}>
                          {cp.studentName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ display: 'block', fontSize: '1.1rem', color: '#ffffff' }}>{cp.studentName}</strong>
                          <span style={{ fontSize: '0.85rem', color: '#777' }}>{new Date(cp.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <span style={{ background: statusBg, color: statusColor, padding: '8px 16px', borderRadius: '25px', fontSize: '0.85rem', fontWeight: '700', border: `1px solid ${statusBg}` }}>
                        {cp.status}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 12px 0', fontSize: '1.3rem', color: 'white' }}>{cp.topic}</h4>
                    <p style={{ margin: '0 0 20px 0', color: '#ccc', lineHeight: '1.7', fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}>{cp.description}</p>

                    {cp.imageBase64 && (
                      <div style={{ marginBottom: '25px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333', display: 'flex', justifyContent: 'flex-start', background: '#050505' }}>
                        <img src={cp.imageBase64} style={{ width: '100%', maxHeight: '450px', objectFit: 'contain', display: 'block' }} alt="Feedback attachment" />
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #252525', paddingTop: '20px', marginTop: '10px' }}>
                      <button
                        onClick={() => likeComplaint(cp._id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          background: hasLiked ? 'var(--primary-color)' : 'transparent',
                          border: hasLiked ? '1px solid var(--primary-color)' : '1px solid #444',
                          color: hasLiked ? 'white' : '#aaa',
                          padding: '10px 24px', borderRadius: '30px', cursor: 'pointer',
                          fontWeight: '600', transition: 'all 0.2s', fontSize: '1rem',
                          boxShadow: hasLiked ? '0 4px 15px rgba(231,76,60,0.3)' : 'none'
                        }}
                        onMouseOver={(e) => { if (!hasLiked) { e.currentTarget.style.background = '#222'; e.currentTarget.style.color = '#fff' } }}
                        onMouseOut={(e) => { if (!hasLiked) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa' } }}
                      >
                        <span style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center' }}>
                          {hasLiked ? <FaThumbsUp /> : <FaRegThumbsUp />}
                        </span>
                        {cp.likes} {cp.likes === 1 ? 'Upvote' : 'Upvotes'}
                      </button>

                      {cp.studentId === currentUserId && (
                        <button
                          onClick={() => deleteComplaint(cp._id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'transparent', border: 'none',
                            color: '#ff4757', padding: '10px 15px', borderRadius: '30px',
                            cursor: 'pointer', fontSize: '0.95rem', opacity: 0.8,
                            transition: 'all 0.2s', fontWeight: 'bold'
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'rgba(255, 71, 87, 0.1)'; }}
                          onMouseOut={(e) => { e.currentTarget.style.opacity = 0.8; e.currentTarget.style.background = 'transparent'; }}
                        >
                          <FaTrash /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
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
                        🔗 {DOMAIN_LABELS[poll.domain] || (poll.domain === 'lunch' ? '🍱 Lunch' : poll.domain === 'dinner' ? '🍽️ Dinner' : 'General')}
                      </span>
                      {(() => {
                        const pollDomain = poll.domain || 'none';
                        let userBadge = 'none';
                        if (pollDomain !== 'none') {
                          const ranks = { none: 0, silver: 1, gold: 2, diamond: 3 };
                          let bestRank = 0;
                          for (const [d, b] of Object.entries(profile.domainBadges || {})) {
                            if (!pollDomain.toLowerCase().includes('egg') && d.toLowerCase().includes('egg')) continue;
                            if (d.toLowerCase().includes(pollDomain.toLowerCase()) || pollDomain.toLowerCase().includes(d.toLowerCase())) {
                              if ((ranks[b] || 0) > bestRank) { bestRank = ranks[b] || 0; userBadge = b; }
                            }
                          }
                          if (bestRank === 0) userBadge = profile.badge || 'none';
                        } else {
                          userBadge = profile.badge || 'none';
                        }

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

    if (activeTab === 'feedback') {
      return (
        <div>
          {!activeFeedback ? (
            <div style={{ background: 'var(--surface-color)', padding: '60px 40px', borderRadius: 14, textAlign: 'center' }}>
              <p style={{ fontSize: '2.5rem', marginBottom: 16 }}>📭</p>
              <h3 style={{ color: '#888' }}>No Active Feedback</h3>
              <p style={{ color: '#555', marginTop: 8, fontSize: '0.9rem' }}>No feedback cycle is active right now. Check back later!</p>
            </div>
          ) : (
            <FeedbackForm
              cycle={activeFeedback}
              onSubmitted={() => {
                setHasFeedbackBadge(false);
                fetchActiveFeedback();
              }}
            />
          )}
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
            <div className="responsive-grid">
              {activeBookings.map(b => (
                <div key={b._id} style={{ background: 'var(--surface-color)', borderRadius: '15px', padding: '20px', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                    <div>
                      <h4 style={{ color: '#2ed573', margin: 0 }}>Date: {new Date(b.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</h4>
                      <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>Booked on: {new Date(b.createdAt).toLocaleString()}</p>
                    </div>
                    <button onClick={() => handleCancelBooking(b._id)} style={{ padding: '8px 15px', background: '#ff475722', color: '#ff4757', border: '1.5px solid #ff475755', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', transition: '0.2s' }}>✕ Cancel Booking</button>
                  </div>

                  <div style={{ display: 'flex', gap: '20px', flexDirection: 'column' }}>

                    {/* Unified Daily QR Code */}
                    <div style={{ background: '#111', padding: '20px', borderRadius: '12px', display: 'flex', gap: '20px', alignItems: 'center', borderLeft: '4px solid var(--primary-color)' }}>
                      <div style={{ background: 'white', padding: '10px', borderRadius: '10px' }}>
                        <QRCodeSVG
                          value={JSON.stringify({
                            bookingId: b._id,
                            studentId: b.studentRollId || b.studentId,
                            date: b.date,
                            mealsBooked: Object.keys(b.codes || {}),
                            mealQty: b.mealQty || {}
                          })}
                          size={120}
                        />
                      </div>
                      <div>
                        <h4 style={{ color: 'white', margin: '0 0 10px', fontSize: '1.2rem' }}>📱 Daily Pass QR</h4>
                        <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>Scan this code at the counter during meal times. The system will automatically detect the current meal and provide your food.</p>
                      </div>
                    </div>

                    {/* Items List grouping purely for display */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
                      {MEAL_SECTIONS.map(section => {
                        const bookedItems = section.meals.filter(m => b.codes && b.codes[m]);
                        if (bookedItems.length === 0) return null;

                        return (
                          <div key={section.label} style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '10px', border: '1px solid #222' }}>
                            <h5 style={{ color: '#aaa', margin: '0 0 10px' }}>{section.label}</h5>
                            {bookedItems.map(meal => (
                              <div key={meal} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <div>
                                  <span style={{ marginRight: '5px' }}>{MEAL_ICONS[meal]}</span>
                                  <span style={{ color: '#fff' }}>{meal}</span>
                                  {b.mealQty && b.mealQty[meal] > 1 && <strong style={{ color: 'var(--primary-color)', marginLeft: '5px' }}>x{b.mealQty[meal]}</strong>}
                                </div>
                                <span style={{ color: b.status?.[meal] === 'Completed' ? 'var(--success-color)' : '#666', fontSize: '0.8rem' }}>
                                  {b.status?.[meal] === 'Completed' ? 'Done' : 'Pending'}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
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

          {/* Auto Order Summary */}
          {profile.autoConfig?.enabled && (
            <div style={{ background: 'linear-gradient(135deg, #10b98115, #04785715)', borderLeft: '4px solid #10b981', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <FaSyncAlt color="#10b981" />
                <h4 style={{ margin: 0, color: '#10b981' }}>Auto Delivery Active</h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#a7f3d0' }}>Your meals are automatically booked every morning.</p>

              {notifications.length > 0 && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.slice(0, 2).map((n) => (
                    <div key={n._id} style={{
                      fontSize: '0.8rem', padding: '8px 12px', borderRadius: '8px',
                      background: n.type === 'error' ? '#ef444420' : 'rgba(255,255,255,0.05)',
                      color: n.type === 'error' ? '#fca5a5' : '#e2e8f0',
                      borderLeft: `2px solid ${n.type === 'error' ? '#ef4444' : '#10b981'}`
                    }}>
                      {n.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

    if (activeTab === 'auto-order') {
      return <AutoOrderManager />;
    }
  };

  const navItems = [
    { id: 'profile', label: 'My Profile', icon: <FaUser /> },
    { id: 'menu', label: 'Meal Booking', icon: <FaUtensils /> },
    { id: 'auto-order', label: 'Auto Delivery', icon: <FaSyncAlt /> },
    { id: 'booked', label: 'Booked Meals', icon: <FaClipboardList /> },
    { id: 'weekly', label: 'Weekly Menu', icon: <FaClipboardList /> },
    { id: 'history', label: 'History & Attend.', icon: <FaHistory /> },
    { id: 'complaints', label: 'Complaints', icon: <FaExclamationTriangle /> },
    { id: 'polls', label: 'Polls', icon: <FaChartBar /> },
    { id: 'feedback', label: 'Weekly Feedback', icon: <FaCommentAlt />, badge: hasFeedbackBadge },
  ];

  return (
    <div className="dashboard-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0a', overflow: 'hidden' }}>
      
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

      {/* TOPMOST NAVIGATION BAR (Sticky) */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        zIndex: 100, flexShrink: 0,
        background: 'rgba(10, 10, 10, 0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        padding: '12px 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
        flexWrap: 'wrap', gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Hamburger Toggle */}
          <button 
            onClick={() => setSidebarOpen(true)}
            className="hamburger-btn"
            style={{ 
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
              color: 'var(--primary-color)', padding: '10px', borderRadius: '12px', 
              cursor: 'pointer', display: 'none', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem'
            }}
          >☰</button>
          <h2 className="admin-name-section" style={{ color: 'var(--primary-color)', margin: 0, fontWeight: '800', letterSpacing: '1px', fontSize: '1.3rem' }}>Smart Mess</h2>
          <div className="admin-name-section">
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '500' }}>Welcome, <span style={{ color: 'var(--primary-color)' }}>{profile.name}</span></h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '2px 0 0 0' }}>Here is what's happening at the mess today.</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
          {profile.badge && profile.badge !== 'none' && (
            <div className="admin-name-section" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <BadgeIcon badge={profile.badge} size={16} />
              <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px', color: '#eaeaea' }}>{profile.badge} Tier</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 15px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <FaWallet color="#10b981" size={16} />
            <span style={{ fontWeight: 'bold', fontSize: '0.82rem', color: '#eaeaea' }}><span className="admin-name-section">Balance:</span> <span style={{ color: '#10b981' }}>₹{profile.walletBalance}</span></span>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* SIDEBAR */}
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{
          width: '240px', minWidth: '240px', flexShrink: 0,
          background: 'var(--surface-color)', padding: '25px 20px',
          display: 'flex', flexDirection: 'column', borderRight: '1px solid #222',
          height: '100%', zIndex: 1000
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }} className="hamburger-btn">
             <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>Smart Mess</h3>
             <button onClick={() => setSidebarOpen(false)} className="sidebar-close-btn" style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.2rem', cursor: 'pointer', display: 'none' }}>✕</button>
          </div>
          <div className="no-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
            {navItems.map(item => (
              <div
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); if (item.id === 'feedback') setHasFeedbackBadge(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
                  background: activeTab === item.id ? 'var(--primary-color)' : 'transparent',
                  color: activeTab === item.id ? 'white' : 'var(--text-secondary)',
                  fontWeight: activeTab === item.id ? 'bold' : 'normal',
                  transition: 'all 0.2s', position: 'relative'
                }}
              >
                {item.icon}
                <span style={{ fontSize: '0.95rem', whiteSpace: 'nowrap' }}>{item.label}</span>
                {item.badge && (
                  <div style={{
                    position: 'absolute', top: 8, right: 10,
                    width: 9, height: 9, background: '#ff7b00',
                    borderRadius: '50%', animation: 'pulseOrb 1.5s infinite'
                  }} />
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid #333', paddingTop: '15px' }}>
            <div onClick={handleLogout} style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'rgba(255, 71, 87, 0.8)', cursor: 'pointer',
              padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255, 71, 87, 0.2)',
              transition: 'all 0.2s'
            }}>
              <FaSignOutAlt />
              <span>Logout</span>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="main-content" style={{ flex: 1, padding: '30px 40px', overflowY: 'auto' }}>

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

          <div>
            {renderTabContent()}
          </div>
        </div>
      </div>

    </div>
  );
};

export default StudentDashboard;
