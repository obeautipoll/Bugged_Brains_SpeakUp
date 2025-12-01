import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { analyzeComplaintUrgency } from "../../../services/aiUrgencyService";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Eye, Calendar, Tag } from "lucide-react";

// --- Sub-Component: Priority Tag ---
const PriorityTag = ({ priority }) => {
  let colorClasses;

  switch ((priority || "").toLowerCase()) {
    case "critical":
      colorClasses = "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/50";
      break;
    case "high":
      colorClasses = "bg-gradient-to-r from-orange-500 to-orange-400 text-white shadow-lg shadow-orange-500/50";
      break;
    case "medium":
      colorClasses = "bg-gradient-to-r from-yellow-400 to-yellow-300 text-gray-800 shadow-lg shadow-yellow-400/50";
      break;
    default:
      colorClasses = "bg-gradient-to-r from-gray-300 to-gray-200 text-gray-700 shadow-md";
  }

  return (
    <span className={`px-3 py-1.5 text-xs font-bold rounded-full uppercase tracking-wide ${colorClasses}`}>
      {String(priority || "").toUpperCase()}
    </span>
  );
};

const UrgentComplaintsWidget = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAndAnalyzeComplaints = async () => {
      setLoading(true);

      try {
        const snapshot = await getDocs(collection(db, "complaints"));
        const complaintsArray = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();

          const text = 
            data.concernDescription?.toString() ||
            data.incidentDescription?.toString() ||
            data.facilityDescription?.toString() ||
            data.concernFeedback?.toString() ||
            data.otherDescription?.toString() ||
            data.additionalContext?.toString() ||
            data.additionalNotes?.toString() ||
            data.impactExperience?.toString() ||
            data.facilitySafety?.toString() ||
            "";

          const analysis = await analyzeComplaintUrgency(text);

          if (
            analysis &&
            (analysis.urgency === "High" || analysis.urgency === "Critical")
          ) {
            // Skip complaints that are already assigned
            if (data.assignedRole || data.assignedTo) {
              continue;
            }

            complaintsArray.push({
              id: docSnap.id,
              snippet: text.slice(0, 120),
              category: data.category,
              submissionDate: data.submissionDate,
              timeAgo: formatDateTime(data.submissionDate),
              priority: analysis.urgency,
              fullData: data
            });
          }
        }

        setComplaints(complaintsArray);
      } catch (err) {
        console.error("Error fetching/analyzing complaints:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAndAnalyzeComplaints();
  }, []);

  // helper to format Firestore timestamp (or Date)
  const formatDateTime = (date) => {
    if (!date) return "N/A";
    const d = date.toDate ? date.toDate() : date;
    return d.toLocaleString();
  };

  const handleViewDetails = (complaint) => {
    navigate("/amonitorcomplaints", {
      state: { complaintId: complaint.id, focusTab: "details" },
    });
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-100">
        <div className="flex items-center justify-center h-32 text-gray-500">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-800"></div>
            <span className="text-sm font-medium">Analyzing complaints...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Top Accent Bar */}
      <div className="h-1 bg-gradient-to-r from-red-800 via-red-600 to-orange-500"></div>
      
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2.5 rounded-xl">
              <AlertTriangle size={24} className="text-red-800" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Urgent Complaints Queue</h3>
              <p className="text-sm text-gray-500 mt-0.5">High priority items requiring immediate attention</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-red-500/30">
            <span className="text-2xl font-extrabold">{complaints.length}</span>
            <span className="text-sm font-semibold">New</span>
          </div>
        </div>
      </div>

      {/* Complaints List */}
      <div className="p-6">
        {complaints.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {complaints.map((complaint) => (
              <div 
                key={complaint.id} 
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-xl hover:border-red-200 group"
              >
                {/* Priority + Category */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <PriorityTag priority={complaint.priority} />
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Tag size={14} />
                    <span className="font-medium">{complaint.category || "Uncategorized"}</span>
                  </div>
                </div>

                {/* Content */}
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    <span className="text-red-800">ID: {complaint.id}</span>
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {complaint.snippet}...
                  </p>
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <Calendar size={14} />
                  <span>Filed: {formatDateTime(complaint.submissionDate)}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button 
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm shadow-lg shadow-blue-500/30"
                    onClick={() => handleViewDetails(complaint)}
                  >
                    <Eye size={16} />
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <div className="bg-gray-100 p-6 rounded-full mb-4">
              <AlertTriangle size={48} className="text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-500">All quiet!</p>
            <p className="text-sm text-gray-400">No urgent complaints found</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <a
          href="#"
          className="flex items-center justify-end gap-2 text-red-800 hover:text-red-600 font-semibold text-sm group"
          onClick={(e) => {
            e.preventDefault();
            navigate("/amonitorcomplaints");
          }}
        >
          <span>View Full Complaints Queue</span>
          <span className="group-hover:translate-x-1">→</span>
        </a>
      </div>
    </div>
  );
};

export default UrgentComplaintsWidget;