import React, { useEffect, useMemo, useRef, useState } from "react";
import AdminSideBar from "./components/AdminSideBar";
import AdminNavbar from "./components/AdminNavBar";
import { useAdminNotifications } from "../../hooks/useAdminNotifications";
import { useNavigate } from "react-router-dom";

const AdminNotifications = () => {
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();
  const { notifications, loading, lastSeenAt, markAllSeen, markSeenUpTo } = useAdminNotifications();

  // Persistently dismissed list
  const DISMISSED_KEY = "admin_notifications_dismissed";
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

  const filtered = useMemo(() => (activeTab === "unread" ? notifications.filter((n) => n.date > lastSeenAt) : notifications), [notifications, activeTab, lastSeenAt]);
  const shown = useMemo(() => filtered.filter((n)=> !dismissedSet.has(n.id)), [filtered, dismissedSet]);

  const handleDeleteOne = (id) => {
    if (!window.confirm("Delete this notification?")) return;
    setDismissed((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setLastDeleted([id]);
  };
  const handleDeleteAll = () => {
    if (!window.confirm("Delete all notifications? This cannot be undone.")) return;
    const allIds = notifications.map((n)=> n.id);
    const toAdd = allIds.filter((id) => !dismissedSet.has(id));
    setDismissed((prev) => Array.from(new Set([...prev, ...allIds])));
    setLastDeleted(toAdd);
  };

  return (
    <>
      <AdminSideBar />
      
      {/* Main content with proper spacing for sidebar */}
      <div className="min-h-screen lg:ml-[260px]">
        <div className="p-4 sm:p-8">
          <AdminNavbar />

          <div className="max-w-4xl mt-24 mx-auto">
            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-gray-200 p-1 rounded-lg w-fit">
              <button
                className={`px-5 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === "all"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => setActiveTab("all")}
              >
                All
              </button>
              <button
                className={`px-5 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === "unread"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => setActiveTab("unread")}
              >
                Unread
              </button>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 justify-between items-start sm:items-center mb-4">
              <div className="text-gray-600 text-xs sm:text-sm">
                {lastDeleted.length > 0 && (
                  <>
                    Deleted {lastDeleted.length} notification{lastDeleted.length > 1 ? 's' : ''}.
                    <button
                      onClick={handleUndoDelete}
                      className="ml-2 text-blue-600 hover:text-blue-700 font-medium underline"
                    >
                      Undo
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-[#8B0000] text-white text-xs sm:text-sm rounded-md hover:bg-[#991b1b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  onClick={markAllSeen}
                  disabled={loading}
                >
                  Mark all as read
                </button>
                <button
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-red-700 text-white text-xs sm:text-sm rounded-md hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  onClick={handleDeleteAll}
                  disabled={loading || notifications.length === 0}
                >
                  Delete all
                </button>
              </div>
            </div>

            {/* Notifications Container */}
            <div className="space-y-4">
              {loading && (
                <div className="p-6 bg-white rounded-lg shadow border border-gray-100">
                  <p className="text-gray-500 text-center">Loading notifications…</p>
                </div>
              )}
              
              {!loading && shown.length === 0 && (
                <div className="text-center py-16 bg-white rounded-lg shadow border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">No notifications</h3>
                  <p className="text-sm text-gray-500">You're all caught up!</p>
                </div>
              )}

              {!loading && shown.map((n) => (
                <div
                  key={n.id}
                  className={`relative p-3 sm:p-4 rounded-lg shadow transition-all cursor-pointer border-l-4 ${
                    n.date > lastSeenAt
                      ? "bg-red-50 border-l-[#8B0000] font-semibold hover:shadow-md"
                      : "bg-white border-l-gray-300 opacity-80"
                  }`}
                  onClick={() => {
                    markSeenUpTo(n.date);
                    const focusTab = n.type === 'feedback' ? 'feedback' : (n.type === 'status' ? 'status' : 'details');
                    navigate('/amonitorcomplaints', { state: { complaintId: n.complaintId, focusTab } });
                  }}
                >
                  {/* Delete Button */}
                  <button
                    aria-label="Delete notification"
                    onClick={(e) => { e.stopPropagation(); handleDeleteOne(n.id); }}
                    className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <i className="fas fa-trash text-xs"></i>
                  </button>

                  {/* Unread Dot */}
                  {n.date > lastSeenAt && (
                    <div className="absolute top-2 right-9 w-2 h-2 bg-[#8B0000] rounded-full animate-pulse"></div>
                  )}

                  {/* Content */}
                  <div className="pr-7">
                    <p className="text-sm sm:text-base mb-1.5 flex flex-wrap items-center gap-2">
                      <span className={n.date > lastSeenAt ? "text-gray-900" : "text-gray-700"}>
                        {n.title}
                      </span>
                      {n.category && (
                        <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 text-xs font-medium">
                          {n.category}
                        </span>
                      )}
                    </p>
                    <small className="text-xs text-gray-500 flex items-center gap-1">
                      <i className="far fa-clock"></i>
                      {new Date(n.date).toLocaleString()}
                    </small>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            {!loading && shown.length > 0 && (
              <div className="mt-10 pt-4 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-400">
                  Notifications are displayed in chronological order
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminNotifications;