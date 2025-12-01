import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, FileText, Clock, TrendingUp, BarChart3, Users, Activity } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import AdminSideBar from './components/AdminSideBar';
import AdminNavbar from './components/AdminNavBar';
import UrgentComplaintsWidget from './components/urgency-level';
import '../../styles/styles-admin/admin.css';

// --- HELPER FUNCTIONS ---
const normalizeStatus = (status = '') => {
    const value = status.toString().toLowerCase().trim();
    if (value.includes('progress')) return 'inProgress';
    if (value.includes('pending')) return 'pending';
    if (value.includes('resolve') || value.includes('close')) return 'resolved';
    return 'pending';
};

// --- CHART COMPONENTS ---

// Line Chart: Submission Trend
const LineChartPlaceholder = ({ data }) => {
    const maxSubmissions = Math.max(...data.map(item => item.submissions), 1);
    
    return (
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-100 h-full">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-3">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Submission Trend</h3>
                    <p className="text-sm text-gray-500 mt-1">Last 30 Days Activity</p>
                </div>
                <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                    <TrendingUp size={18} className="text-green-600" />
                    <span className="text-sm font-semibold text-green-700">
                        Total: {data.reduce((sum, item) => sum + item.submissions, 0)}
                    </span>
                </div>
            </div>
            
            <div className="h-72 flex items-end justify-between gap-1 border-b-2 border-gray-200 pb-2">
                {data.slice(-7).map((item, index) => {
                    const heightPercent = (item.submissions / maxSubmissions) * 100;
                    return (
                        <div 
                            key={index} 
                            className="flex-1 group relative"
                        >
                            <div 
                                className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-lg hover:from-indigo-700 hover:to-indigo-500 cursor-pointer shadow-lg"
                                style={{ height: `${Math.max(heightPercent, 5)}%` }}
                            >
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-3 py-1 rounded text-xs whitespace-nowrap shadow-lg z-10">
                                    {item.submissions} submissions
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between mt-3 px-1">
                {data.slice(-7).map((item, index) => (
                    <span key={index} className="text-xs text-gray-400 flex-1 text-center">
                        D{30 - 6 + index}
                    </span>
                ))}
            </div>
        </div>
    );
};

// Donut Chart: Status Distribution
const DonutChartPlaceholder = ({ stats }) => {
    const total = stats.total || 1;
    const pendingPct = Math.round((stats.pending / total) * 100);
    const inProgressPct = Math.round((stats.inProgress / total) * 100);
    const resolvedPct = 100 - pendingPct - inProgressPct;

    const segments = [
        { label: 'Pending', count: stats.pending, color: 'bg-orange-500', percentage: pendingPct, dotColor: 'bg-orange-500' },
        { label: 'In Progress', count: stats.inProgress, color: 'bg-blue-500', percentage: inProgressPct, dotColor: 'bg-blue-500' },
        { label: 'Resolved', count: stats.resolved, color: 'bg-green-500', percentage: resolvedPct, dotColor: 'bg-green-500' },
    ];

    return (
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-100 h-full">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900">Status Distribution</h3>
                <p className="text-sm text-gray-500 mt-1">Current complaint breakdown</p>
            </div>
            
            <div className="flex items-center justify-center mb-6">
                <div className="relative w-40 h-40">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle 
                            cx="50" 
                            cy="50" 
                            r="40" 
                            fill="none" 
                            stroke="#f3f4f6" 
                            strokeWidth="12"
                        />
                        <circle 
                            cx="50" 
                            cy="50" 
                            r="40" 
                            fill="none" 
                            stroke="#f97316" 
                            strokeWidth="12"
                            strokeDasharray={`${pendingPct * 2.51} ${251 - pendingPct * 2.51}`}
                            strokeDashoffset="0"
                            transform="rotate(-90 50 50)"
                        />
                        <circle 
                            cx="50" 
                            cy="50" 
                            r="40" 
                            fill="none" 
                            stroke="#3b82f6" 
                            strokeWidth="12"
                            strokeDasharray={`${inProgressPct * 2.51} ${251 - inProgressPct * 2.51}`}
                            strokeDashoffset={`-${pendingPct * 2.51}`}
                            transform="rotate(-90 50 50)"
                        />
                        <circle 
                            cx="50" 
                            cy="50" 
                            r="40" 
                            fill="none" 
                            stroke="#22c55e" 
                            strokeWidth="12"
                            strokeDasharray={`${resolvedPct * 2.51} ${251 - resolvedPct * 2.51}`}
                            strokeDashoffset={`-${(pendingPct + inProgressPct) * 2.51}`}
                            transform="rotate(-90 50 50)"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <span className="text-3xl font-bold text-gray-900">{stats.total}</span>
                            <p className="text-xs text-gray-500">Total</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="space-y-3">
                {segments.map((seg) => (
                    <div key={seg.label} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 hover:shadow-md">
                        <div className="flex items-center gap-3">
                            <span className={`w-4 h-4 ${seg.dotColor} rounded-full shadow-sm`}></span>
                            <span className="text-sm font-medium text-gray-700">{seg.label}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-lg font-bold text-gray-900">{seg.count}</span>
                            <span className="text-xs text-gray-500 ml-1">({seg.percentage}%)</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Horizontal Bar Chart: Top Categories
const BarChartPlaceholder = ({ data }) => {
    const maxVal = Math.max(...data.map(item => item.value), 1);
    const colors = ['from-purple-600 to-purple-400', 'from-pink-600 to-pink-400', 'from-blue-600 to-blue-400', 'from-indigo-600 to-indigo-400', 'from-violet-600 to-violet-400'];
    
    return (
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-100 h-full ">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900">Top 5 Categories</h3>
                <p className="text-sm text-gray-500 mt-1">Most reported complaint types</p>
            </div>
            
            {data.length > 0 ? (
                <div className="space-y-4">
                    {data.slice(0, 5).map((item, index) => (
                        <div key={index} className="group">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-semibold text-gray-700 truncate max-w-[70%]">{item.label}</span>
                                <span className="text-lg font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">{item.value}</span>
                            </div>
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                <div
                                    className={`h-full bg-gradient-to-r ${colors[index]} rounded-full shadow-lg`}
                                    style={{ width: `${(item.value / maxVal) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <BarChart3 size={48} className="mb-3 opacity-50" />
                    <p className="text-sm">No category data available</p>
                </div>
            )}
        </div>
    );
};

// Average Resolution Time Card
const AvgResolutionTimeCard = ({ data, isLoading }) => (
    <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-xl p-6 border border-blue-100 hover:shadow-2xl">
        <div className="flex justify-between items-start mb-4">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Avg. Resolution Time</p>
            <div className="bg-blue-100 p-3 rounded-xl">
                <Clock size={24} className="text-blue-600" />
            </div>
        </div>
        <div>
            <h3 className="text-4xl font-extrabold text-gray-900 mb-2">
                {isLoading ? '...' : `${data.value || 'N/A'}`}
            </h3>
            {data.unit && <span className="text-lg text-gray-500 font-medium">{data.unit}</span>}
            <p className="text-sm text-gray-500 mt-3 flex items-center gap-1">
                <span className={`font-bold text-base ${data.change && data.change.startsWith('-') ? 'text-green-600' : 'text-red-600'}`}>
                    {data.change || '—'}
                </span>
                <span>vs. last period</span>
            </p>
        </div>
    </div>
);

// --- MAIN DASHBOARD COMPONENT ---
const AdminDashboard = () => {
    const [statusStats, setStatusStats] = useState({
        pending: 0, inProgress: 0, resolved: 0, total: 0,
    });
    const [trendData, setTrendData] = useState([]);
    const [categoryData, setCategoryData] = useState([]);
    const [avgResolutionTime, setAvgResolutionTime] = useState({ value: null, unit: 'days', change: null });
    const [isLoading, setIsLoading] = useState(true);
    const [statsError, setStatsError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const snapshot = await getDocs(collection(db, 'complaints'));
                const docs = snapshot.docs.map((doc) => doc.data() || {});
                
                // Status Counts
                const status = docs.reduce(
                    (acc, doc) => {
                        const key = normalizeStatus(doc.status);
                        acc[key] += 1;
                        acc.total += 1;
                        return acc;
                    },
                    { pending: 0, inProgress: 0, resolved: 0, total: 0 }
                );
                setStatusStats(status);

                // Category Distribution
                const categories = docs.reduce((acc, doc) => {
                    const cat = (doc.category || 'Uncategorized').trim();
                    acc[cat] = (acc[cat] || 0) + 1;
                    return acc;
                }, {});
                const topCategories = Object.entries(categories)
                    .map(([label, value]) => ({ label, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5);
                setCategoryData(topCategories);

                // Trend Data
                setTrendData(
                    [...Array(30)].map((_, i) => ({
                        day: `Day ${i + 1}`,
                        submissions: Math.floor(Math.random() * 10) + 1,
                    }))
                );

                // Average Resolution Time
                setAvgResolutionTime({ value: 2.5, unit: 'days', change: '-0.3 days' });

                setStatsError(null);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
                setStatsError('Unable to load dashboard data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const activeQueue = statusStats.pending + statusStats.inProgress;

    return (
        <div className="flex min-h-screen bg-gray-50">
            <AdminSideBar />

            <main className="flex-1 lg:ml-0 p-4 sm:p-6 lg:p-8">
                <AdminNavbar />
                
                {statsError && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6 shadow-sm" role="alert">
                        <div className="flex items-center">
                            <AlertTriangle size={20} className="mr-3" />
                            <div>
                                <p className="font-bold">Data Error!</p>
                                <p className="text-sm">{statsError}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* KPI ROW */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8 mt-20">
                    {/* Active Queue - Clean White Card with Maroon Accent */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-6 border-l-4 border-red-800 hover:shadow-2xl">
                        <div className="flex justify-between items-start w-full">
                            <div className="flex-1">
                                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Active Queue</p>
                                <h3 className="text-gray-900 text-5xl sm:text-6xl font-extrabold mb-3">
                                    {isLoading ? '...' : activeQueue}
                                </h3>
                                <div className="flex flex-wrap gap-3 text-sm">
                                    <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full border border-gray-200">
                                        {statusStats.pending} pending
                                    </span>
                                    <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full border border-gray-200">
                                        {statusStats.inProgress} in progress
                                    </span>
                                </div>
                            </div>
                            <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                                <Activity size={40} className="text-red-800 opacity-90" />
                            </div>
                        </div>
                    </div>

                    {/* Avg Resolution Time */}
                    <AvgResolutionTimeCard data={avgResolutionTime} isLoading={isLoading} />
                    
                    {/* Total Users */}
                    <div className="bg-gradient-to-br from-pink-50 to-white rounded-2xl shadow-xl p-6 border border-pink-100 hover:shadow-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Total Users</p>
                            <div className="bg-pink-100 p-3 rounded-xl">
                                <Users size={24} className="text-pink-600" />
                            </div>
                        </div>
                        <h3 className="text-4xl font-extrabold text-gray-900 mb-2">
                            {isLoading ? '...' : '500+'}
                        </h3>
                        <p className="text-sm text-gray-500 font-medium">Registered users</p>
                    </div>
                </div>
                
                {/* Urgent Complaints Widget - Full Width */}
                <div className="mb-6 lg:mb-8">
                    <UrgentComplaintsWidget />
                </div>

                {/* CHARTS ROW 1: Line Chart (2/3) + Donut Chart (1/3) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8 pb-5">
                    
                    <DonutChartPlaceholder stats={statusStats} />
                    <BarChartPlaceholder data={categoryData} />
                </div>

               
            </main>
        </div>
    );
};

export default AdminDashboard;