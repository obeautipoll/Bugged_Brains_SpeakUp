import React, { useEffect, useMemo, useRef, useState } from "react";
import SideBar from "./components/StaffSideBar";
import AdminNavbar from "./components/StaffNavBar";
import { useStaffNotifications } from "../../hooks/useStaffNotifications";
import { useNavigate } from "react-router-dom";

const LS_KEY = "staff_notifications_last_seen";

const getLastSeen = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

const setLastSeen = (ms) => {
  try {
    const prev = getLastSeen();
    const next = Math.max(prev || 0, Number(ms) || 0);
    localStorage.setItem(LS_KEY, String(next));
  } catch {}
};

const StaffNotifications = () => {
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();
  const { notifications: items, lastSeenAt, markAllSeen: markAllAsRead, markSeenUpTo: markItemRead, loading } = useStaffNotifications();

  // Persistently dismissed list
  const DISMISSED_KEY = "staff_notifications_dismissed";
  const [dismissed, setDismissed] = useState(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed)); } catch {}
  }, [dismissed]);
  const dismissedSet = useMemo(() => new Set(dismissed), [dismissed]);
  const [lastDeleted, setLastDeleted] = useState([]);
  const undoTimerRef = useRef(null);
  const handleUndoDelete = () => {
    if (!lastDeleted.length) return;
    if (undoTimerRef.current) { try { clearTimeout(undoTimerRef.current); } catch {} undoTimerRef.current = null; }
    setDismissed((prev) => prev.filter((id) => !lastDeleted.includes(id)));
    setLastDeleted([]);
  };
  useEffect(() => {
    if (undoTimerRef.current) { try { clearTimeout(undoTimerRef.current); } catch {} undoTimerRef.current = null; }
    if (lastDeleted.length > 0) {
      undoTimerRef.current = setTimeout(() => {
        setLastDeleted([]);
        undoTimerRef.current = null;
      }, 10000);
    }
    return () => {
      if (undoTimerRef.current) { try { clearTimeout(undoTimerRef.current); } catch {} undoTimerRef.current = null; }
    };
  }, [lastDeleted]);

  const filtered = useMemo(() => (activeTab === "unread" ? items.filter((n)=> n.date > lastSeenAt) : items), [items, activeTab, lastSeenAt]);
  const shown = useMemo(() => filtered.filter((n)=> !dismissedSet.has(n.id)), [filtered, dismissedSet]);

  const handleDeleteOne = (id) => {
    if (!window.confirm("Delete this notification?")) return;
    setDismissed((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setLastDeleted([id]);
  };
  const handleDeleteAll = () => {
    if (!window.confirm("Delete all notifications? This cannot be undone.")) return;
    const allIds = items.map((n)=> n.id);
    const toAdd = allIds.filter((id) => !dismissedSet.has(id));
    setDismissed((prev) => Array.from(new Set([...prev, ...allIds])));
    setLastDeleted(toAdd);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/30">
      <SideBar />

      <div className="flex-1 mt-0 p-12 transition-all duration-300  md:p-7  sm:mt-36 sm:px-4 sm:py-6 xs:ml-[60px] xs:px-3.5 xs:py-5">
        <AdminNavbar />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center m-0 px-8 mt-0 mb-4 gap-4 lg:gap-0 md:m-6 md:px-4 sm:m-4 sm:px-2">
          {/* 1. Tabs Container (Left Side) */}
          <div className="-mt-24 lg:-mt-24 md:-mt-20 sm:-mt-16 flex gap-1.5 bg-gradient-to-r from-white to-gray-50 p-1.5 rounded-2xl shadow-lg border border-gray-200/80 backdrop-blur-sm w-full lg:w-auto">
            <div
              className={`flex-1 lg:flex-none px-8 md:px-6 sm:px-4 py-2.5 sm:py-2 rounded-xl font-semibold text-sm sm:text-xs cursor-pointer transition-all duration-300 relative overflow-hidden ${
                activeTab === "all"
                  ? "bg-gradient-to-br from-[#8B0000] via-[#a01010] to-[#DC143C] text-white shadow-[0_4px_12px_rgba(139,0,0,0.3)] scale-[1.02]"
                  : "text-gray-600 hover:text-red-700 hover:bg-red-50/50 hover:scale-[1.01]"
              }`}
              onClick={() => setActiveTab("all")}
            >
              {activeTab === "all" && (
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 animate-shimmer"></span>
              )}
              <span className="relative flex items-center justify-center gap-2">
                <i className="fas fa-list text-xs"></i>
                All
              </span>
            </div>
            <div
              className={`flex-1 lg:flex-none px-8 md:px-6 sm:px-4 py-2.5 sm:py-2 rounded-xl font-semibold text-sm sm:text-xs cursor-pointer transition-all duration-300 relative overflow-hidden ${
                activeTab === "unread"
                  ? "bg-gradient-to-br from-[#8B0000] via-[#a01010] to-[#DC143C] text-white shadow-[0_4px_12px_rgba(139,0,0,0.3)] scale-[1.02]"
                  : "text-gray-600 hover:text-red-700 hover:bg-red-50/50 hover:scale-[1.01]"
              }`}
              onClick={() => setActiveTab("unread")}
            >
              {activeTab === "unread" && (
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 animate-shimmer"></span>
              )}
              <span className="relative flex items-center justify-center gap-2">
                <i className="fas fa-bell text-xs"></i>
                Unread
              </span>
            </div>
          </div>

          {/* 2. Actions Container (Right Side) */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 items-stretch sm:items-center w-full lg:w-auto">
            {/* Undo/Deleted Message */}
            <div className="text-gray-600 text-sm font-medium min-h-[40px] flex items-center order-3 sm:order-1">
              {lastDeleted.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center gap-2 animate-slideIn w-full sm:w-auto text-xs sm:text-sm">
                  <i className="fas fa-info-circle text-blue-600 text-xs"></i>
                  <span className="flex-1 sm:flex-none">Deleted {lastDeleted.length} notification{lastDeleted.length > 1 ? 's' : ''}.</span>
                  <button 
                    onClick={handleUndoDelete} 
                    className="ml-1 text-blue-700 bg-blue-100 hover:bg-blue-200 border-none px-3 py-1 rounded-md cursor-pointer font-semibold text-xs transition-all duration-200 hover:scale-105 whitespace-nowrap"
                  >
                    <i className="fas fa-undo text-xs mr-1"></i>
                    Undo
                  </button>
                </div>
              )}
            </div>

            {/* Mark All As Read Button */}
            <button
              className="bg-gradient-to-r from-[#800000] to-[#a00000] hover:from-[#a00000] hover:to-[#c00000] text-white border-none px-5 md:px-4 sm:px-3 py-2.5 sm:py-2 rounded-xl cursor-pointer font-medium text-sm sm:text-xs transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group order-1 sm:order-2"
              onClick={markAllAsRead}
            >
              <i className="fas fa-check-double text-xs group-hover:scale-110 transition-transform"></i>
              <span className="whitespace-nowrap">Mark all as read</span>
            </button>

            {/* Delete All Button */}
            <button
              className="bg-gradient-to-r from-[#b91c1c] to-[#dc2626] hover:from-[#dc2626] hover:to-[#ef4444] text-white border-none px-5 md:px-4 sm:px-3 py-2.5 sm:py-2 rounded-xl cursor-pointer font-medium text-sm sm:text-xs transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 group order-2 sm:order-3"
              onClick={handleDeleteAll}
              disabled={loading || items.length === 0}
            >
              <i className="fas fa-trash-alt text-xs group-hover:scale-110 transition-transform"></i>
              <span className="whitespace-nowrap">Delete all</span>
            </button>
          </div>
        </div>

        {/* Notification Container */}
        <div className="m-14 mt-3 flex flex-col gap-4 md:m-8 md:gap-3 sm:m-4 sm:gap-3 xs:m-2 xs:gap-2.5">
          {loading && (
            <div className="relative bg-gradient-to-r from-gray-50 via-white to-gray-50 rounded-2xl p-6 px-7 md:p-5 md:px-6 sm:p-4 sm:px-5 border-l-4 border-gray-300 shadow-lg transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer"></div>
              <p className="relative m-0 mb-3 text-base md:text-sm sm:text-xs text-gray-600 font-medium leading-relaxed pr-8 flex items-center gap-3">
                <i className="fas fa-spinner fa-spin text-gray-400"></i>
                Loading notifications…
              </p>
            </div>
          )}
          {!loading && shown.length === 0 && (
            <div className="text-center py-20 md:py-16 sm:py-12 px-8 md:px-6 sm:px-4">
              <div className="inline-block p-6 md:p-5 sm:p-4 bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-md border border-gray-200">
                <i className="fas fa-inbox text-5xl md:text-4xl sm:text-3xl text-gray-300 mb-4"></i>
                <p className="text-gray-400 text-lg md:text-base sm:text-sm font-medium">No notifications to display</p>
                <p className="text-gray-400 text-sm md:text-xs sm:text-xs mt-2">You're all caught up!</p>
              </div>
            </div>
          )}
          {!loading && shown.map((n, idx) => (
            <div
              key={n.id}
              className={`group relative bg-white rounded-2xl p-6 px-7 md:p-5 md:px-6 sm:p-4 sm:px-5 xs:p-3.5 xs:px-4 border-l-4 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer hover:translate-x-3 md:hover:translate-x-2 sm:hover:translate-x-1 hover:-translate-y-0.5 animate-[slideIn_0.4s_ease_forwards] sm:rounded-xl ${
                n.date > lastSeenAt
                  ? "bg-gradient-to-br from-[#FFFAF0] via-white to-[#FFF8F0] border-l-[#FFD700] shadow-[0_4px_20px_rgba(255,215,0,0.2)] hover:shadow-[0_8px_30px_rgba(255,215,0,0.3)]"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              style={{ 
                animationDelay: `${idx * 0.1}s`,
                borderLeftColor: n.date > lastSeenAt ? '#FFD700' : undefined
              }}
              onClick={() => {
                markItemRead(n.date);
                const focusTab = n.type === 'feedback' ? 'feedback' : (n.type === 'status' ? 'status' : 'details');
                navigate('/smonitorcomplaints', { state: { complaintId: n.complaintId, focusTab } });
              }}
            >
              {/* Unread indicator dot */}
              {n.date > lastSeenAt && (
                <div className="absolute top-6 right-6 md:top-5 md:right-5 sm:top-4 sm:right-4">
                  <span className="relative flex h-3 w-3 sm:h-2.5 sm:w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#DC143C] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 sm:h-2.5 sm:w-2.5 bg-gradient-to-br from-[#DC143C] to-[#FF4444] shadow-lg"></span>
                  </span>
                </div>
              )}
              
              {/* Delete button */}
              <button
                aria-label="Delete notification"
                onClick={(e) => { e.stopPropagation(); handleDeleteOne(n.id); }}
                className="absolute top-2 right-2 border-none bg-gray-100 hover:bg-red-100 p-2 sm:p-1.5 rounded-lg cursor-pointer text-gray-400 hover:text-red-600 transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110 sm:opacity-100"
              >
                <i className="fas fa-trash text-xs sm:text-[10px]"></i>
              </button>
              
              {/* Content icon */}
              <div className={`absolute left-3 sm:left-2 top-6 sm:top-5 w-1 h-12 sm:h-10 rounded-full ${
                n.date > lastSeenAt ? 'bg-gradient-to-b from-[#FFD700] to-[#FFA500]' : 'bg-gradient-to-b from-gray-300 to-gray-200'
              }`}></div>
              
              <p className={`m-0 mb-3 sm:mb-2 text-base md:text-sm sm:text-xs font-semibold leading-relaxed pr-10 md:pr-8 sm:pr-7 flex items-start gap-2 ${
                n.date > lastSeenAt ? "text-[#8B0000]" : "text-gray-700"
              }`}>
                <i className={`fas ${n.type === 'feedback' ? 'fa-comment-dots' : n.type === 'status' ? 'fa-info-circle' : 'fa-bell'} text-sm md:text-xs sm:text-[10px] mt-0.5 ${
                  n.date > lastSeenAt ? 'text-[#DC143C]' : 'text-gray-400'
                }`}></i>
                <span className="flex-1">
                  {n.title || "Notification"}
                  {n.category && (
                    <span className="ml-3 sm:ml-2 px-3 sm:px-2 py-1 sm:py-0.5 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 text-indigo-700 text-xs sm:text-[10px] font-medium inline-flex items-center gap-1.5 sm:gap-1 mt-1 sm:mt-0.5">
                      <i className="fas fa-tag text-[10px] sm:text-[8px]"></i>
                      {n.category}
                    </span>
                  )}
                </span>
              </p>
              
              <small className={`flex items-center gap-2 sm:gap-1.5 text-[0.85rem] md:text-xs sm:text-[0.7rem] font-medium ${
                n.date > lastSeenAt ? "text-[#DC143C]" : "text-gray-500"
              }`}>
                <i className="far fa-clock text-xs sm:text-[10px]"></i>
                {new Date(n.date).toLocaleString()}
              </small>
              
              {/* Hover effect overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl sm:rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
        
        body {
          font-family: 'Poppins', sans-serif;
        }
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default StaffNotifications;