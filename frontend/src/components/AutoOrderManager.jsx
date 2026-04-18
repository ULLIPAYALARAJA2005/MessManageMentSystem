import React, { useState, useEffect } from 'react';
import { FaSyncAlt, FaWallet, FaInfoCircle, FaSave, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import api from '../services/api';
import toast from 'react-hot-toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEALS = [
  { key: 'Morning Tea/Milk', label: 'Morning Tea/Milk' },
  { key: 'Morning Egg', label: '🥚 Morning Egg' },
  { key: 'Morning Banana', label: '🍌 Morning Banana' },
  { key: 'Tiffin', label: 'Tiffin' },
  { key: 'Lunch Veg', label: '🌱 Lunch Veg' },
  { key: 'Lunch Non-Veg', label: '🍗 Lunch Non-Veg' },
  { key: 'Lunch Egg', label: '🥚 Lunch Egg' },
  { key: 'Evening Tea/Milk', label: 'Evening Tea/Milk' },
  { key: 'Snacks', label: '🍿 Snacks' },
  { key: 'Dinner Veg', label: '🌱 Dinner Veg' },
  { key: 'Dinner Non-Veg', label: '🍗 Dinner Non-Veg' },
  { key: 'Dinner Egg', label: '🥚 Dinner Egg' },
];

// Rough base prices for preview purpose
const PREVIEW_PRICES = {
  'Morning Tea/Milk': 15,
  'Morning Egg': 8,
  'Morning Banana': 7,
  'Tiffin': 45,
  'Lunch Veg': 60,
  'Lunch Non-Veg': 60,
  'Lunch Egg': 12,
  'Evening Tea/Milk': 15,
  'Snacks': 20,
  'Dinner Veg': 60,
  'Dinner Non-Veg': 60,
  'Dinner Egg': 12,
};

const AutoOrderManager = () => {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [autoPay, setAutoPay] = useState(false);
  const [plan, setPlan] = useState({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/student/auto-order');
      if (res.data) {
        setEnabled(res.data.enabled || false);
        setAutoPay(res.data.autoPay || false);
        
        // Initialize plan with defaults if missing
        const loadedPlan = res.data.plan || {};
        const safePlan = {};
        DAYS.forEach(day => {
          safePlan[day] = {};
          MEALS.forEach(m => {
            safePlan[day][m.key] = loadedPlan[day]?.[m.key] || 0;
          });
        });
        setPlan(safePlan);
      }
    } catch (err) {
      toast.error('Failed to load auto-order settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (day) => {
    if (!enabled) return;
    setPlan(prev => {
      const currentDayPlan = prev[day] || {};
      const allSelected = MEALS.every(m => (currentDayPlan[m.key] || 0) > 0);
      const newQty = allSelected ? 0 : 1;
      
      const updatedDayPlan = {};
      MEALS.forEach(m => {
        updatedDayPlan[m.key] = newQty;
      });
      
      return {
        ...prev,
        [day]: updatedDayPlan
      };
    });
  };

  const handleQtyChange = (day, meal, val) => {
    let num = parseInt(val);
    if (isNaN(num) || num < 0) num = 0;
    if (num > 10) num = 10;
    
    setPlan(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
        [meal]: num
      }
    }));
  };

  const saveSettings = async () => {
    try {
      await api.post('/student/auto-order', {
        enabled,
        autoPay,
        plan
      });
      toast.success('Auto-order settings saved successfully!');
    } catch (err) {
      toast.error('Failed to save settings');
    }
  };

  // Calculate weekly estimate
  const estimatedWeeklyCost = DAYS.reduce((t_acc, day) => {
    let dayTotal = 0;
    if (plan[day]) {
      Object.keys(plan[day]).forEach(meal => {
        dayTotal += (plan[day][meal] || 0) * (PREVIEW_PRICES[meal] || 0);
      });
    }
    return t_acc + dayTotal;
  }, 0);

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', padding: '40px' }}>Loading Auto Delivery Settings...</div>;
  }

  return (
    <div style={{ color: '#f3f4f6' }}>
      
      {/* Header Section */}
      <div style={{ marginBottom: '30px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.6rem', margin: 0 }}>
            <FaSyncAlt color="var(--primary-color)" /> Auto Order Settings
          </h2>
          <p style={{ color: '#94a3b8', margin: '8px 0 0', maxWidth: '600px', lineHeight: 1.5 }}>
            Customize your weekly meal plan. The system will automatically place bookings for you every day according to this schedule.
          </p>
        </div>

        {/* Action Controls Card */}
        <div style={{ 
          background: '#16161a', 
          border: '1px solid rgba(255,255,255,0.06)', 
          borderRadius: '16px', 
          padding: '20px',
          minWidth: '320px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontWeight: '600' }}>Enable Auto-Booking</div>
            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: enabled ? 'var(--primary-color)' : '#333',
                transition: '.3s', borderRadius: '30px'
              }}>
                <span style={{
                  position: 'absolute', height: '20px', width: '20px', left: enabled ? '26px' : '3px', bottom: '3px',
                  backgroundColor: 'white', transition: '.3s', borderRadius: '50%'
                }} />
              </span>
            </label>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: enabled ? 1 : 0.5, transition: '0.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FaWallet color="#10b981" />
              <span style={{ fontWeight: '600' }}>Wallet Auto-Deduction</span>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
              <input type="checkbox" disabled={!enabled} checked={autoPay} onChange={e => setAutoPay(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{
                position: 'absolute', cursor: enabled ? 'pointer' : 'default', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: autoPay ? '#10b981' : '#333',
                transition: '.3s', borderRadius: '30px'
              }}>
                <span style={{
                  position: 'absolute', height: '20px', width: '20px', left: autoPay ? '26px' : '3px', bottom: '3px',
                  backgroundColor: 'white', transition: '.3s', borderRadius: '50%'
                }} />
              </span>
            </label>
          </div>
          {!autoPay && enabled && (
            <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#f59e0b', display: 'flex', gap: '5px' }}>
              <FaExclamationTriangle />
              <span>If disabled, you may have to pay manually at the counter, or bookings may be skipped depending on admin settings.</span>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '16px 0' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Est. Weekly Cost</span>
            <span style={{ fontWeight: '800', fontSize: '1.2rem', color: '#f3f4f6' }}>₹{estimatedWeeklyCost}</span>
          </div>
          
          <button 
            onClick={saveSettings}
            style={{ 
              width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, var(--primary-color), #ff6b35)',
              color: 'white', fontWeight: '700', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <FaSave /> Save Preferences
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{ 
        background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid #3b82f6', 
        padding: '12px 16px', borderRadius: '8px', marginBottom: '30px',
        display: 'flex', alignItems: 'center', gap: '12px'
      }}>
        <FaInfoCircle size={20} color="#3b82f6" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.88rem', color: '#bfdbfe' }}>
          <strong>How it works:</strong> The system runs every day early morning. If there's an enabled amount in today's column below, it will automatically book it using your wallet.
        </span>
      </div>

      {/* Weekly Matrix Table */}
      <div style={{ 
        background: '#16161a', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)',
        overflowX: 'auto', marginBottom: '40px'
      }}>
        <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '16px', textAlign: 'left', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Day</th>
              {MEALS.map(m => (
                <th key={m.key} style={{ padding: '16px 10px', textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: '600' }}>
                  {m.label}
                  <div style={{ fontWeight: '400', fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>~₹{PREVIEW_PRICES[m.key]}</div>
                </th>
              ))}
              <th style={{ padding: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600' }}>Quick Select</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dIdx) => (
              <tr key={day} style={{ borderBottom: dIdx < DAYS.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                <td style={{ padding: '16px', fontWeight: '600', color: '#e2e8f0' }}>
                  <span>{day}</span>
                </td>
                {MEALS.map(m => {
                  const qty = plan[day]?.[m.key] || 0;
                  const isActive = qty > 0;
                  
                  return (
                    <td key={m.key} style={{ padding: '10px', textAlign: 'center', background: isActive ? 'rgba(255,123,0,0.03)' : 'transparent' }}>
                      <input 
                        type="number" 
                        min="0" max="10"
                        value={qty}
                        onChange={e => handleQtyChange(day, m.key, e.target.value)}
                        disabled={!enabled}
                        style={{
                          width: '45px', height: '36px', textAlign: 'center',
                          background: isActive ? 'var(--primary-color)' : '#222',
                          color: isActive ? '#fff' : '#888',
                          border: isActive ? 'none' : '1px solid #333',
                          borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem',
                          outline: 'none', transition: '0.2s', cursor: enabled ? 'text' : 'not-allowed',
                          opacity: enabled ? 1 : 0.4
                        }}
                      />
                    </td>
                  );
                })}
                <td style={{ padding: '16px', textAlign: 'center', borderBottom: dIdx < DAYS.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                  <button 
                    onClick={() => handleSelectAll(day)}
                    disabled={!enabled}
                    style={{ 
                      background: 'rgba(255,123,0,0.1)', 
                      border: '1px solid rgba(255,123,0,0.2)', 
                      color: 'var(--primary-color)', 
                      padding: '6px 12px', 
                      borderRadius: '8px', 
                      fontSize: '0.75rem', 
                      cursor: enabled ? 'pointer' : 'not-allowed',
                      fontWeight: 'bold',
                      transition: '0.2s',
                      opacity: enabled ? 1 : 0.5
                    }}
                    onMouseOver={e => enabled && (e.currentTarget.style.background = 'rgba(255,123,0,0.2)')}
                    onMouseOut={e => enabled && (e.currentTarget.style.background = 'rgba(255,123,0,0.1)')}
                  >
                    {MEALS.every(m => (plan[day]?.[m.key] || 0) > 0) ? 'Deselect All' : 'Select All'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
    </div>
  );
};

export default AutoOrderManager;
