import React, { useEffect, useMemo, useState, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import AdminSideBar from './components/AdminSideBar';
import AdminNavbar from './components/AdminNavBar';
import { db } from '../../firebase/firebase';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#f97316' },
  inProgress: { label: 'In Progress', color: '#3b82f6' },
  resolved: { label: 'Resolved', color: '#16a34a' },
  closed: { label: 'Closed', color: '#6b7280' },
};

const URGENCY_CONFIG = {
  high: { label: 'High', color: '#dc2626' },
  medium: { label: 'Medium', color: '#facc15' },
  low: { label: 'Low', color: '#22c55e' },
};

const normalizeStatus = (status = '') => {
  const value = status.toString().toLowerCase();
  if (value.includes('progress')) return 'inProgress';
  if (value.includes('pending')) return 'pending';
  if (value.includes('resolve')) return 'resolved';
  if (value.includes('close')) return 'closed';
  return 'pending';
};

const normalizeUrgency = (urgency = '') => {
  const value = urgency.toString().toLowerCase();
  if (value.includes('high')) return 'high';
  if (value.includes('medium')) return 'medium';
  if (value.includes('low')) return 'low';
  return null;
};

const normalizeCategory = (category = 'Uncategorized') =>
  category.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim() || 'Uncategorized';

const toDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getPeriodStart = (date, type) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  switch (type) {
    case 'week': {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      break;
    }
    case 'month':
      start.setDate(1);
      break;
    case 'year':
      start.setMonth(0, 1);
      break;
    default:
      break;
  }
  return start;
};

const formatPeriodLabel = (date, type) => {
  switch (type) {
    case 'week':
      return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    case 'month':
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    case 'year':
      return date.getFullYear().toString();
    default:
      return date.toLocaleDateString();
  }
};

const buildTimeSeries = (complaints, type, count) => {
  const template = [];
  const lookup = {};
  for (let i = count - 1; i >= 0; i -= 1) {
    const reference = new Date();
    reference.setHours(0, 0, 0, 0);
    if (type === 'week') {
      reference.setDate(reference.getDate() - i * 7);
    } else if (type === 'month') {
      reference.setMonth(reference.getMonth() - i, 1);
    } else if (type === 'year') {
      reference.setFullYear(reference.getFullYear() - i, 0, 1);
    }
    const start = getPeriodStart(reference, type);
    const key = `${type}:${start.toISOString()}`;
    const bucket = {
      key,
      label: formatPeriodLabel(start, type),
      value: 0,
    };
    template.push(bucket);
    lookup[key] = bucket;
  }
  complaints.forEach((complaint) => {
    const date = toDateValue(complaint.submissionDate);
    if (!date) return;
    const bucketStart = getPeriodStart(date, type);
    const bucketKey = `${type}:${bucketStart.toISOString()}`;
    if (lookup[bucketKey]) {
      lookup[bucketKey].value += 1;
    }
  });
  return template;
};

const sortSeriesDesc = (series) => [...series].sort((a, b) => b.value - a.value);

const TREND_VIEWS = [
  { key: 'week', label: 'Weekly', description: 'Last 6 weeks' },
  { key: 'month', label: 'Monthly', description: 'Last 6 months' },
  { key: 'year', label: 'Yearly', description: 'Last 5 years' },
];

const AdminAnalytics = () => {
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trendRange, setTrendRange] = useState('week');
  const [activeTrendPeriod, setActiveTrendPeriod] = useState(null);
  const printRef = useRef(null);

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'complaints'));
        const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setComplaints(docs);
        setError(null);
      } catch (err) {
        console.error('Error loading analytics data:', err);
        setError('Unable to load analytics right now. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  const statusCounts = useMemo(() => {
    return complaints.reduce(
      (acc, complaint) => {
        const key = normalizeStatus(complaint.status);
        acc[key] += 1;
        return acc;
      },
      { pending: 0, inProgress: 0, resolved: 0, closed: 0 }
    );
  }, [complaints]);

  const urgencyCounts = useMemo(() => {
    return complaints.reduce(
      (acc, complaint) => {
        const key = normalizeUrgency(complaint.urgency);
        if (key) acc[key] += 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 }
    );
  }, [complaints]);

  const categoryDistribution = useMemo(() => {
    const counts = complaints.reduce((acc, complaint) => {
      const category = normalizeCategory(complaint.category);
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [complaints]);

  const weeklyVolume = useMemo(() => {
    const days = [...Array(7)].map((_, idx) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - idx));
      return date;
    });
    const template = days.map((date) => ({
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      value: 0,
    }));
    const lookup = template.reduce((acc, day) => {
      acc[day.key] = day;
      return acc;
    }, {});
    complaints.forEach((complaint) => {
      const date = toDateValue(complaint.submissionDate);
      if (!date) return;
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString().slice(0, 10);
      if (lookup[key]) {
        lookup[key].value += 1;
      }
    });
    return template;
  }, [complaints]);

  const weeklyTrend = useMemo(() => buildTimeSeries(complaints, 'week', 6), [complaints]);
  const monthlyTrend = useMemo(() => buildTimeSeries(complaints, 'month', 6), [complaints]);
  const yearlyTrend = useMemo(() => buildTimeSeries(complaints, 'year', 5), [complaints]);

  const sortedTrendData = useMemo(
    () => ({
      weekly: sortSeriesDesc(weeklyTrend),
      monthly: sortSeriesDesc(monthlyTrend),
      yearly: sortSeriesDesc(yearlyTrend),
    }),
    [weeklyTrend, monthlyTrend, yearlyTrend]
  );

  const totalComplaints = complaints.length;
  const openComplaints = statusCounts.pending + statusCounts.inProgress;
  const resolvedThisWeek = weeklyVolume.slice(-7).reduce((sum, day) => sum + day.value, 0);
  const avgPerDay = weeklyVolume.length
    ? Math.round(weeklyVolume.reduce((sum, day) => sum + day.value, 0) / weeklyVolume.length)
    : 0;

  const selectedTrendSeries = useMemo(() => {
    switch (trendRange) {
      case 'month':
        return monthlyTrend;
      case 'year':
        return yearlyTrend;
      case 'week':
      default:
        return weeklyTrend;
    }
  }, [trendRange, weeklyTrend, monthlyTrend, yearlyTrend]);

  const selectedTrendSummary = useMemo(() => {
    switch (trendRange) {
      case 'month':
        return sortedTrendData.monthly;
      case 'year':
        return sortedTrendData.yearly;
      case 'week':
      default:
        return sortedTrendData.weekly;
    }
  }, [trendRange, sortedTrendData]);

  const maxStatusValue = Math.max(...Object.values(statusCounts), 1);
  const maxCategoryValue = Math.max(...categoryDistribution.map((category) => category.value), 1);
  const maxUrgencyValue = Math.max(...Object.values(urgencyCounts), 1);
  const maxTrendValue = Math.max(...selectedTrendSeries.map((day) => day.value), 1);
  const totalSelectedTrend = selectedTrendSeries.reduce((sum, period) => sum + period.value, 0);

  useEffect(() => {
    setActiveTrendPeriod(null);
  }, [trendRange, selectedTrendSeries]);

  const focusedTrendPeriod = useMemo(() => {
    if (!selectedTrendSeries.length) return null;
    return (
      selectedTrendSeries.find((period) => period.key === activeTrendPeriod) ||
      selectedTrendSeries[selectedTrendSeries.length - 1]
    );
  }, [activeTrendPeriod, selectedTrendSeries]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const element = printRef.current;
    if (!element) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Analytics Report - ${new Date().toLocaleDateString()}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 40px; background: white; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #dc2626; padding-bottom: 20px; }
            .header h1 { font-size: 32px; color: #111827; margin-bottom: 10px; }
            .header p { color: #6b7280; font-size: 14px; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
            .summary-card { border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; }
            .summary-card p { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 10px; }
            .summary-card h3 { font-size: 36px; color: #dc2626; margin-bottom: 5px; }
            .summary-card span { font-size: 11px; color: #9ca3af; }
            .section { margin-bottom: 40px; page-break-inside: avoid; }
            .section-title { font-size: 20px; color: #111827; margin-bottom: 10px; border-bottom: 2px solid #f3f4f6; padding-bottom: 10px; }
            .section-subtitle { font-size: 14px; color: #6b7280; margin-bottom: 20px; }
            .chart-container { background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .bar-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 200px; gap: 15px; }
            .bar-wrapper { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
            .bar { width: 60px; border-radius: 4px 4px 0 0; }
            .bar-value { font-weight: bold; margin-top: 10px; font-size: 18px; }
            .bar-label { font-size: 12px; color: #6b7280; margin-top: 5px; }
            .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .category-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
            .category-label { font-size: 14px; color: #374151; font-weight: 600; }
            .category-value { font-size: 16px; font-weight: bold; color: #111827; }
            .trend-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px; padding: 20px; background: #f9fafb; border-radius: 8px; }
            .trend-stat p { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
            .trend-stat h4 { font-size: 24px; color: #dc2626; }
            @media print {
              body { padding: 20px; }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          ${element.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
    <AdminSideBar />

    <main className="flex-1 m-5 lg:ml-0 p-8 pb-8 pl-8"> {/* <-- 1. Set main content left padding to pl-0 (or pl-4 if you want a tiny gap) */}
        <AdminNavbar />

        {/* 2. Change the inner div padding to only control vertical space, and set horizontal padding to 0 */}
        <div className="py-12 px-0 w-full max-w-full m-0 min-h-screen mb-5 print:p-8"> 
        {/* ... rest of your analytics component */}
          <style>{`
            @media print {
              .no-print { display: none !important; }
              .admin-container > *:not(.main-content) { display: none !important; }
              .main-content > *:not(.p-16) { display: none !important; }
            }
          `}</style>

          <header className="flex justify-between items-start mb-8 no-print">
            <div>
              <p className="text-sm font-bold text-black uppercase tracking-wider mb-2">Insights</p>
              <h1 className="text-4xl font-extrabold text-black mb-2 drop-shadow-md">Analytics Overview</h1>
              <p className="text-black/85 text-base">
                Real-time breakdown of complaint activity across the platform.
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <p className="text-sm text-black/80 whitespace-nowrap bg-gray-100/15 px-4 py-2 rounded-lg backdrop-blur-sm">
                Updated {new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-red-700 to-orange-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-gray-700 to-gray-800 text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
          </header>

          <div ref={printRef}>
            <div className="hidden print:block text-center mb-10 border-b-4 border-red-700 pb-5">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Analytics Report</h1>
              <p className="text-gray-600 text-sm">Generated on {new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>            </div>

            {error && (
              <div className="bg-gradient-to-br from-red-100 to-red-200 text-red-700 px-5 py-4 rounded-xl mb-8 text-sm font-medium no-print">
                {error}
              </div>
            )}

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {[
                { label: 'Total Complaints', value: totalComplaints, subtitle: 'All time' },
                { label: 'Active Queue', value: openComplaints, subtitle: 'Pending + In Progress' },
                { label: 'Weekly Volume', value: resolvedThisWeek, subtitle: 'Submissions (last 7 days)' },
                { label: 'Avg. per Day', value: avgPerDay, subtitle: 'Based on the last 7 days' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-8 transition-all duration-300 shadow-lg hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-700 to-orange-600"></div>
                  <p className="text-sm text-gray-500 mb-4 font-semibold uppercase tracking-wide">{item.label}</p>
                  <h3 className="text-5xl font-extrabold bg-gradient-to-br from-red-800 to-orange-600 bg-clip-text text-transparent mb-2">
                    {isLoading ? '...' : item.value}
                  </h3>
                  <span className="text-xs text-gray-400 font-medium">{item.subtitle}</span>
                </div>
              ))}
            </section>

            <section className="bg-white rounded-2xl p-10 mb-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <header className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-100">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Status Overview</h2>
                  <p className="text-gray-500 text-sm font-medium">Workload split across lifecycle stages</p>
                </div>
              </header>
              <div className="flex items-end justify-around h-80 gap-8 p-8 bg-gradient-to-b from-gray-50 to-white rounded-xl">
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <div key={key} className="flex-1 flex flex-col items-center h-full max-w-36">
                    <div
                      className="w-full max-w-24 rounded-t-xl transition-all duration-500 min-h-2 relative shadow-lg hover:shadow-2xl hover:-translate-y-2 hover:scale-105"
                      style={{
                        height: `${(statusCounts[key] / maxStatusValue) * 100}%`,
                        background: config.color,
                      }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl"></div>
                      </div>
                    <p className="mt-6 text-3xl font-extrabold text-gray-900">{statusCounts[key]}</p>
                    <p className="mt-2 text-sm font-semibold text-gray-600">{config.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <section className="bg-white rounded-2xl p-10 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <header className="mb-8 pb-6 border-b-2 border-gray-100">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Top Categories</h2>
                  <p className="text-gray-500 text-sm font-medium">Most frequently reported issues</p>
                </header>
                <div className="space-y-4">
                  {categoryDistribution.map((category, idx) => (
                    <div key={idx} className="group">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-semibold text-gray-700">{category.label}</span>
                        <span className="text-lg font-bold text-gray-900">{category.value}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-700 to-orange-600 rounded-full transition-all duration-700 group-hover:from-red-600 group-hover:to-orange-500"
                          style={{ width: `${(category.value / maxCategoryValue) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-2xl p-10 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <header className="mb-8 pb-6 border-b-2 border-gray-100">
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Urgency Breakdown</h2>
                  <p className="text-gray-500 text-sm font-medium">Priority distribution</p>
                </header>
                <div className="flex items-end justify-around h-64 gap-8 p-8 bg-gradient-to-b from-gray-50 to-white rounded-xl">
                  {Object.entries(URGENCY_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex-1 flex flex-col items-center h-full max-w-32">
                      <div
                        className="w-full max-w-20 rounded-t-xl transition-all duration-500 min-h-2 relative shadow-lg hover:shadow-2xl hover:-translate-y-2 hover:scale-105"
                        style={{
                          height: `${(urgencyCounts[key] / maxUrgencyValue) * 100}%`,
                          background: config.color,
                        }}
                      >
                        <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl"></div>
                      </div>
                      <p className="mt-6 text-3xl font-extrabold text-gray-900">{urgencyCounts[key]}</p>
                      <p className="mt-2 text-sm font-semibold text-gray-600">{config.label}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="bg-white rounded-2xl p-10 mb-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <header className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-100">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Submission Trends</h2>
                  <p className="text-gray-500 text-sm font-medium">
                    Historical complaint volume over time
                  </p>
                </div>
                <div className="flex gap-2 no-print">
                  {TREND_VIEWS.map((view) => (
                    <button
                      key={view.key}
                      onClick={() => setTrendRange(view.key)}
                      className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${
                        trendRange === view.key
                          ? 'bg-gradient-to-br from-red-700 to-orange-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
              </header>

              <div className="flex items-end justify-around h-80 gap-4 p-8 bg-gradient-to-b from-gray-50 to-white rounded-xl mb-6">
                {selectedTrendSeries.map((period) => (
                  <div
                    key={period.key}
                    className="flex-1 flex flex-col items-center h-full cursor-pointer group"
                    onClick={() => setActiveTrendPeriod(period.key)}
                  >
                    <div
                      className={`w-full rounded-t-xl transition-all duration-500 min-h-2 relative ${
                        activeTrendPeriod === period.key
                          ? 'bg-gradient-to-t from-red-700 to-orange-500 shadow-2xl scale-105'
                          : 'bg-gradient-to-t from-red-600 to-orange-600 shadow-lg group-hover:shadow-xl group-hover:-translate-y-2'
                      }`}
                      style={{
                        height: `${(period.value / maxTrendValue) * 100}%`,
                      }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl"></div>
                    </div>
                    <p className={`mt-4 text-2xl font-extrabold transition-colors ${
                      activeTrendPeriod === period.key ? 'text-red-700' : 'text-gray-900'
                    }`}>
                      {period.value}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-gray-500 text-center">{period.label}</p>
                  </div>
                ))}
              </div>

              {focusedTrendPeriod && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 mb-6">
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Period</p>
                      <h4 className="text-2xl font-bold text-gray-900">{focusedTrendPeriod.label}</h4>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">Submissions</p>
                      <h4 className="text-2xl font-bold text-red-700">{focusedTrendPeriod.value}</h4>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">% of Total</p>
                      <h4 className="text-2xl font-bold text-gray-900">
                        {totalSelectedTrend > 0
                          ? Math.round((focusedTrendPeriod.value / totalSelectedTrend) * 100)
                          : 0}%
                      </h4>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  {TREND_VIEWS.find((v) => v.key === trendRange)?.label} Summary
                </h3>
                <div className="space-y-3">
                  {selectedTrendSummary.slice(0, 3).map((period, idx) => (
                    <div key={period.key} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-orange-600'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-sm font-semibold text-gray-700">{period.label}</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">{period.value} complaints</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminAnalytics;