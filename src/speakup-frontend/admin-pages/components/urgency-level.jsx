import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebase";
import { analyzeComplaintUrgency } from "../../../services/aiUrgencyService";
import { useNavigate } from "react-router-dom";
import "../../../styles/styles-admin/urgency.css";

// --- Sub-Component: Priority Tag ---
const PriorityTag = ({ priority }) => {
  let colorClasses;

  switch ((priority || "").toLowerCase()) {
    case "critical":
      colorClasses = "bg-red-600 text-white animate-pulse";
      break;
    case "high":
      colorClasses = "bg-orange-500 text-white";
      break;
    case "medium":
      colorClasses = "bg-yellow-400 text-gray-800";
      break;
    default:
      colorClasses = "bg-gray-300 text-gray-700";
  }

  return (
    <span className={`px-3 py-1 text-xs font-semibold rounded-full shadow-md ${colorClasses}`}>
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

            // ⛔ Skip complaints that are already assigned
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

  const getCategoryLabel = (category) => {
    const labels = {
      academic: "Academic",
      "faculty-conduct": "Faculty Conduct",
      facilities: "Facilities",
      "administrative-student-services": "Admin/Student Services",
      other: "Other",
    };
    return labels[category] || "N/A";
  };

  const handleViewDetails = (complaint) => {
    navigate("/amonitorcomplaints", {
      state: { complaintId: complaint.id, focusTab: "details" },
    });
  };

  if (loading) {
    return <div className="urgent-complaints-widget">Analyzing complaints... ⏳</div>;
  }

  return (
    <div className="urgent-complaints-widget">
      {/* Header */}
      <div className="widget-header">
        <h3 className="widget-title">🤖 Urgent Comwadplaints Queue</h3>
        <span className="new-count-badge">{complaints.length} New</span>
      </div>

      {/* Complaints List */}
      <div className="complaints-list">
        {complaints.length > 0 ? (
          complaints.map((complaint) => (
            <div key={complaint.id} className="complaint-card">
              {/* Priority + Category */}
              <div className="complaint-header">
                <PriorityTag priority={complaint.priority} />
                <span className="complaint-category">{complaint.category || "Uncategorized"}</span>
              </div>

              {/* Content */}
              <div className="complaint-content">
                <p className="complaint-id-snippet">
                  {complaint.id}: {complaint.snippet}
                </p>

                <div className="complaint-meta">
                  <span className="meta-time">📅 Filed: {formatDateTime(complaint.submissionDate)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="complaint-actions">
                <button className="action-btn btn-view" onClick={() => handleViewDetails(complaint)}>
                  View Details
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">All quiet! No urgent complaints found.</div>
        )}
      </div>

      {/* Footer */}
      <div className="widget-footer">
        <a
          href="#"
          className="view-all-link"
          onClick={(e) => {
            e.preventDefault();
            navigate("/amonitorcomplaints");
          }}
        >
          View Full Complaints Queue
        </a>
      </div>

    </div>
  );
};

export default UrgentComplaintsWidget;
