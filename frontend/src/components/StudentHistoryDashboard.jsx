import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff7b00'];

const categorizeMeal = (mealName) => {
  const name = mealName.toLowerCase();
  if (name.includes('egg')) return 'Eggs';
  if (name.includes('tea') || name.includes('milk')) return 'Tea/Milk';
  if (name.includes('lunch')) return 'Lunch';
  if (name.includes('dinner')) return 'Dinner';
  if (name.includes('tiffin')) return 'Tiffin';
  if (name.includes('snack')) return 'Snacks';
  return 'Other';
};

export default function StudentHistoryDashboard({ history }) {
  const [selectedDateFilter, setSelectedDateFilter] = useState('year'); // 'year', 'month', 'week'
  const [selectedDay, setSelectedDay] = useState(null);

  // Compute Aggregations
  const stats = useMemo(() => {
    let totalSpent = 0;
    const categoryCounts = { 'Tea/Milk': 0, 'Eggs': 0, 'Lunch': 0, 'Dinner': 0, 'Tiffin': 0, 'Snacks': 0, 'Other': 0 };
    const categorySpending = { 'Tea/Milk': 0, 'Eggs': 0, 'Lunch': 0, 'Dinner': 0, 'Tiffin': 0, 'Snacks': 0, 'Other': 0 };
    const dateMap = {}; // { 'YYYY-MM-DD': { bookings, mealsCount, cost } }

    // Process filtering first
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Normalize today for week calculation
    const todayNum = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon, 6=Sun
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - todayNum);
    startOfWeek.setHours(0, 0, 0, 0);

    const filteredHistory = history.filter(b => {
      const bDate = new Date(b.date);
      if (selectedDateFilter === 'year') {
        return bDate.getFullYear() === currentYear || (now - bDate < 365 * 24 * 60 * 60 * 1000);
      }
      if (selectedDateFilter === 'month') {
        return bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear;
      }
      if (selectedDateFilter === 'week') {
        return bDate >= startOfWeek;
      }
      return true;
    });

    filteredHistory.forEach(b => {
      totalSpent += b.price || 0;

      let dayMealsCount = 0;
      const dayCost = b.price || 0;

      b.meals.forEach(mealStr => {
        const baseName = mealStr.split(' x')[0];
        const category = categorizeMeal(baseName);

        let qty = 1;
        if (b.mealQty && b.mealQty[baseName]) {
          qty = b.mealQty[baseName];
        } else {
          const match = mealStr.match(/x(\d+)/);
          if (match) qty = parseInt(match[1]);
        }

        const pricePerUnit = (b.itemPrices && b.itemPrices[baseName]) ? b.itemPrices[baseName] : 0;

        // Count each individual item unit as a meal count, or treat one meal type as 1 count?
        // Let's treat quantities as actual consumption counts.
        categoryCounts[category] = (categoryCounts[category] || 0) + qty;
        categorySpending[category] = (categorySpending[category] || 0) + (pricePerUnit * qty);
        dayMealsCount += qty;
      });

      if (!dateMap[b.date]) {
        dateMap[b.date] = { date: b.date, bookings: [], mealsCount: 0, cost: 0 };
      }
      dateMap[b.date].bookings.push(b);
      dateMap[b.date].mealsCount += dayMealsCount;
      dateMap[b.date].cost += dayCost;
    });

    // Determine frequencies
    let mostFrequent = 'None';
    let maxCount = 0;
    let leastFrequent = 'None';
    let minCount = Infinity;

    Object.entries(categoryCounts).forEach(([cat, count]) => {
      if (cat === 'Other') return;
      if (count > maxCount) { maxCount = count; mostFrequent = cat; }
      if (count < minCount && count > 0) { minCount = count; leastFrequent = cat; }
    });

    const activeDays = Object.keys(dateMap).length;
    const avgMealsPerDay = activeDays > 0 ? (Object.values(categoryCounts).reduce((a, b) => a + b, 0) / activeDays).toFixed(1) : 0;

    return {
      totalSpent, categoryCounts, categorySpending, dateMap,
      activeDays, avgMealsPerDay, mostFrequent, leastFrequent
    };
  }, [history, selectedDateFilter]);

  // Generate Heatmap Grid (365 days / 52 weeks)
  const heatmapGrid = useMemo(() => {
    let daysToGenerate = 364; // roughly 52 weeks
    if (selectedDateFilter === 'month') daysToGenerate = 31;
    if (selectedDateFilter === 'week') daysToGenerate = 7;

    const today = new Date();
    const grid = [];

    // Iterate down to -7 to include the upcoming 7 days in the future
    for (let i = daysToGenerate; i >= -7; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const isoStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const dayData = stats.dateMap[isoStr] || { bookings: [], mealsCount: 0, cost: 0 };
      let intensity = 0;
      if (dayData.mealsCount > 0) intensity = 1;
      if (dayData.mealsCount >= 2) intensity = 2;
      if (dayData.mealsCount >= 4) intensity = 3;
      if (dayData.mealsCount >= 6) intensity = 4;

      grid.push({
        date: isoStr,
        dayOfWeek: d.getDay(),
        month: d.getMonth(),
        dayData,
        intensity
      });
    }
    return grid;
  }, [stats.dateMap, selectedDateFilter]);

  // Group by Month to create divisions
  const groupedByMonth = useMemo(() => {
    const months = [];
    let currentMonth = null;
    let currentMonthNum = null;

    heatmapGrid.forEach(day => {
      if (currentMonthNum !== day.month) {
        const mStr = new Date(day.date).toLocaleDateString('default', { month: 'short' });
        currentMonth = { name: mStr, year: new Date(day.date).getFullYear(), days: [] };
        months.push(currentMonth);
        currentMonthNum = day.month;
      }
      currentMonth.days.push(day);
    });
    return months;
  }, [heatmapGrid]);

  // Colors for heatmap
  const intensityColors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']; // GitHub style

  const pieData = Object.entries(stats.categoryCounts)
    .filter(([k, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div style={{ color: 'white', display: 'flex', flexDirection: 'column', gap: '25px', paddingBottom: '30px' }}>

      {/* Filters & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>Student History & Attendance</h2>
          <p style={{ margin: '5px 0 0 0', color: '#888' }}>Analyze your dining habits and track your expenses.</p>
        </div>
        <select
          value={selectedDateFilter}
          onChange={(e) => setSelectedDateFilter(e.target.value)}
          style={{ padding: '8px 16px', background: '#1a1a1a', color: 'white', border: '1px solid #333', borderRadius: '8px', outline: 'none' }}
        >
          <option value="year">Current Year View</option>
          <option value="month">Monthly View</option>
          <option value="week">Weekly View</option>
        </select>
      </div>

      {/* Quick Insights Smart Banner */}
      <div style={{ background: 'linear-gradient(90deg, rgba(38,166,65,0.1), rgba(0,0,0,0))', borderLeft: '4px solid #26a641', padding: '15px 20px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <span style={{ fontSize: '1.5rem' }}>💡</span>
        <div>
          {stats.mostFrequent !== 'None' ? (
            <p style={{ margin: 0 }}>You mostly book <strong>{stats.mostFrequent}</strong>! You have consumed meals on <strong>{stats.activeDays}</strong> different days, averaging <strong>{stats.avgMealsPerDay}</strong> items per day visited.</p>
          ) : (
            <p style={{ margin: 0 }}>No bookings recorded for this timeframe. Start booking meals to see insights!</p>
          )}
        </div>
      </div>

      {/* Top Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <div style={{ background: '#111', padding: '20px', borderRadius: '12px', border: '1px solid #222' }}>
          <p style={{ margin: '0 0 5px 0', color: '#888', fontSize: '0.9rem' }}>Total Spent</p>
          <h3 style={{ margin: 0, fontSize: '1.8rem', color: 'var(--success-color)' }}>₹{stats.totalSpent}</h3>
        </div>
        <div style={{ background: '#111', padding: '20px', borderRadius: '12px', border: '1px solid #222' }}>
          <p style={{ margin: '0 0 5px 0', color: '#888', fontSize: '0.9rem' }}>Total Days Present</p>
          <h3 style={{ margin: 0, fontSize: '1.8rem', color: 'white' }}>{stats.activeDays} Days</h3>
        </div>
        <div style={{ background: '#111', padding: '20px', borderRadius: '12px', border: '1px solid #222' }}>
          <p style={{ margin: '0 0 5px 0', color: '#888', fontSize: '0.9rem' }}>Most Booked Category</p>
          <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#ff7b00' }}>{stats.mostFrequent}</h3>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '25px', alignItems: 'start' }}>

        {/* Main Content Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

          {/* Heatmap Grid Section */}
          <div style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: '12px', border: '1px solid #222' }}>
            <h3 style={{ margin: '0 0 20px 0' }}>Activity Heatmap</h3>
            <div style={{ overflowX: 'auto', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '15px' }}>
                {groupedByMonth.map(month => (
                  <div key={`${month.name}-${month.year}`} style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.8rem', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>{month.name}</span>
                    <div style={{
                      display: 'grid',
                      gap: '4px',
                      gridTemplateRows: 'repeat(7, 14px)',
                      gridAutoFlow: 'column',
                      gridAutoColumns: '14px',
                    }}>
                      {month.days.map((day, idx) => (
                        <div
                          key={`${day.date}-${idx}`}
                          onClick={() => setSelectedDay(day)}
                          style={{
                            gridRow: day.dayOfWeek + 1,
                            width: '14px', height: '14px', borderRadius: '2px',
                            background: intensityColors[day.intensity],
                            cursor: 'pointer',
                            border: '1px solid rgba(255,255,255,0.05)'
                          }}
                          title={`${day.date}: ${day.dayData?.mealsCount || 0} meals`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Heatmap Legend */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '5px', marginTop: '15px', fontSize: '0.8rem', color: '#888' }}>
              <span>Less</span>
              {intensityColors.map((c, i) => (
                <div key={i} style={{ width: '12px', height: '12px', background: c, borderRadius: '2px' }} />
              ))}
              <span>More</span>
            </div>
          </div>

          {/* Detailed Breakdown Panels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: '20px' }}>
            {/* Spending Breakdown */}
            <div style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: '12px', border: '1px solid #222' }}>
              <h4 style={{ margin: '0 0 15px 0' }}>Spending Breakdown</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(stats.categorySpending).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => {
                  if (amount === 0) return null;
                  return (
                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #333' }}>
                      <span style={{ color: '#ccc' }}>{cat}</span>
                      <strong style={{ color: 'var(--success-color)' }}>₹{amount}</strong>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Meal Type Distribution */}
            <div style={{ background: 'var(--surface-color)', padding: '25px', borderRadius: '12px', border: '1px solid #222' }}>
              <h4 style={{ margin: '0 0 15px 0', textAlign: 'center' }}>Meal Distribution</h4>
              {pieData.length > 0 ? (
                <div style={{ width: '100%', height: '220px' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5}>
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: '#111', border: 'none', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#666', marginTop: '40px' }}>No data</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Centered Modal Overlay */}
      {selectedDay && (
        <div
          onClick={() => setSelectedDay(null)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, backdropFilter: 'blur(3px)'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface-color)', padding: '30px', borderRadius: '16px',
              border: '1px solid #333', width: '90%', maxWidth: '400px',
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.5rem' }}>Receipt</h3>
                <p style={{ margin: '5px 0 0 0', color: '#ccc', fontSize: '0.95rem' }}>
                  {new Date(selectedDay.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.2rem', cursor: 'pointer' }}
              >✖</button>
            </div>

            {!selectedDay.dayData || !selectedDay.dayData.bookings || selectedDay.dayData.bookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#666' }}>
                <p style={{ fontSize: '3rem', margin: '0 0 10px 0' }}>📭</p>
                <h4 style={{ margin: 0, color: '#aaa' }}>No Bookings</h4>
                <p style={{ fontSize: '0.9rem', marginTop: '5px' }}>You did not book any meals on this date.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {selectedDay.dayData.bookings.map((booking, bIdx) => (
                  <div key={bIdx} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '15px', border: '1px solid #222' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.85rem', color: '#888', fontWeight: 'bold' }}>
                        ORDER #{bIdx + 1} {booking.isGuest && <span style={{ color: 'var(--primary-color)' }}>(Guest)</span>}
                      </div>
                      {booking.isAutoBooked && (
                        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold' }}>⚡ Auto</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {booking.meals.map(m => {
                        const baseName = m.split(' x')[0];
                        const price = booking.itemPrices?.[baseName] || 0;
                        return (
                          <div key={m} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '8px 12px', borderRadius: '6px' }}>
                            <span style={{ color: '#eee', fontSize: '0.95rem' }}>{m}</span>
                            <span style={{ color: '#aaa', fontSize: '0.95rem' }}>₹{price}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', paddingTop: '12px', borderTop: '1px dashed #333' }}>
                      <span style={{ fontWeight: 'bold', color: '#fff' }}>Total</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>₹{booking.price}</span>
                    </div>
                  </div>
                ))}

                <div style={{ background: 'linear-gradient(135deg, #1f1f1f, #111)', borderRadius: '12px', padding: '20px', marginTop: '10px', textAlign: 'center', border: '1px solid #333' }}>
                  <p style={{ margin: '0 0 5px 0', color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Daily Grand Total</p>
                  <h2 style={{ margin: 0, color: 'var(--success-color)', fontSize: '2rem' }}>₹{selectedDay.dayData.cost}</h2>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedDay(null)}
              style={{ width: '100%', marginTop: '20px', padding: '12px', background: '#333', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
