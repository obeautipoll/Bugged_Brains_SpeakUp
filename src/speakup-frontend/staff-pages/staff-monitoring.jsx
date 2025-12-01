import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import StaffSideBar from "./components/StaffSideBar";
import StaffNavBar from "./components/StaffNavBar";
import { db } from "../../firebase/firebase";
import { collection, getDocs, orderBy, query, updateDoc, doc, arrayUnion, onSnapshot } from "firebase/firestore";
import { useAuth } from "../../contexts/authContext";

const AdminMonitorComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [activeTab, setActiveTab] = useState("details");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("view");

  // Filter states
  const [filters, setFilters] = useState({
    category: "all",
    status: "all",
    search: "",
  });

  

  // Form states
  const [feedback, setFeedback] = useState("");
  const [feedbackFiles, setFeedbackFiles] = useState([]);
  const [assignTo, setAssignTo] = useState("");
  const [assignMessage, setAssignMessage] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [noteModalComplaint, setNoteModalComplaint] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [staffRole, setStaffRole] = useState(null);
  const [staffEmail, setStaffEmail] = useState("");
  const { currentUser } = useAuth();
  const location = useLocation();
  const hasAppliedRouteSelection = useRef(false);
  const complaintUnsubRef = useRef(null);
  const VIEW_TABS = ["details", "feedback"];
  const MANAGE_TABS = ["details", "feedback", "notes", "status"];
  const TAB_LABELS = {
    details: "Details",
    feedback: "Feedback",
    notes: "Notes",
    status: "Status",
  };

  useEffect(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const normalizedRole = storedUser?.role?.toLowerCase() || "";
      if (normalizedRole === "staff" || normalizedRole === "kasama") {
        setStaffRole(normalizedRole);
      } else if (currentUser?.role && ["staff", "kasama"].includes(currentUser.role.toLowerCase())) {
        setStaffRole(currentUser.role.toLowerCase());
      } else {
        setStaffRole("");
      }

      const resolvedEmail =
        (storedUser?.email || currentUser?.email || "").trim().toLowerCase();
      setStaffEmail(resolvedEmail);
    } catch (error) {
      console.error("Error determining staff role/email:", error);
      setStaffRole("");
      setStaffEmail("");
    }
  }, [currentUser]);

  // 🔥 Fetch complaints from Firestore
  useEffect(() => {
    if (staffRole === null) return;
    const normalizedEmail = (staffEmail || "").trim().toLowerCase();
    if (!staffRole || !normalizedEmail) {
      setComplaints([]);
      setFilteredComplaints([]);
      return;
    }

    const fetchComplaints = async () => {
      try {
        const q = query(collection(db, "complaints"), orderBy("submissionDate", "desc"));
        const snapshot = await getDocs(q);

        const fetchedComplaints = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        let scopedComplaints = fetchedComplaints.filter(
          (complaint) => (complaint.assignedRole || "").toLowerCase() === staffRole
        );

        scopedComplaints = scopedComplaints.filter(
          (complaint) => (complaint.assignedTo || "").toLowerCase() === normalizedEmail
        );

        setComplaints(scopedComplaints);
        setFilteredComplaints(scopedComplaints);
      } catch (error) {
        console.error("??O Error fetching complaints:", error);
      }
    };

    fetchComplaints();
  }, [staffRole, staffEmail]);

  // 🔎 Filtering logic
  useEffect(() => {
    let filtered = complaints;

    if (filters.category !== "all") {
      filtered = filtered.filter((c) => c.category === filters.category);
    }

    if (filters.status !== "all") {
      filtered = filtered.filter((c) => 
            (c.status || "").toLowerCase() === filters.status.toLowerCase()
      );
    }

    if (filters.search) {
      filtered = filtered.filter(
        (c) =>
          (c.id && c.id.toLowerCase().includes(filters.search.toLowerCase())) ||
          (c.category && c.category.toLowerCase().includes(filters.search.toLowerCase())) ||
          (c.college && c.college.toLowerCase().includes(filters.search.toLowerCase()))
      );
    }

    setFilteredComplaints(filtered);
  }, [filters, complaints]);

  useEffect(() => {
    const allowedTabs = modalMode === "view" ? VIEW_TABS : MANAGE_TABS;
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [modalMode, activeTab]);

  // 📄 Modal logic
  const openModal = (complaint, mode = "view", defaultTab = "details") => {
    setSelectedComplaint(complaint);
    setShowModal(true);
    setModalMode(mode);
    setActiveTab(defaultTab);
    setFeedback("");
    setFeedbackFiles([]);
    setAssignTo(complaint.assignedTo || "");
    setAssignMessage("");
    setNewStatus(complaint.status || "pending");

    // Listen live to selected complaint updates (feedback/status) while modal is open
    try { complaintUnsubRef.current && complaintUnsubRef.current(); } catch {}
    complaintUnsubRef.current = onSnapshot(doc(db, "complaints", complaint.id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};
      setSelectedComplaint((prev) => (prev && prev.id === complaint.id ? { ...prev, ...data } : prev));
    });
  };

  const switchToManageMode = (defaultTab = "details") => {
    setModalMode("manage");
    setActiveTab(defaultTab);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedComplaint(null);
    setActiveTab("details");
    setModalMode("view");
    try { complaintUnsubRef.current && complaintUnsubRef.current(); } catch {}
    complaintUnsubRef.current = null;
  };

  // If navigated from notifications, open the target complaint and tab automatically
  useEffect(() => {
    if (hasAppliedRouteSelection.current) return;
    const state = location?.state || {};
    const targetId = state.complaintId;
    const focusTab = state.focusTab;
    if (!targetId) return;

    const target = complaints.find((c) => c.id === targetId);
    if (target) {
      if (focusTab === 'status') {
        setModalMode('manage');
        setActiveTab('status');
        openModal(target, 'manage', 'status');
      } else if (focusTab === 'feedback') {
        openModal(target, 'view', 'feedback');
      } else {
        openModal(target, 'view', 'details');
      }
      hasAppliedRouteSelection.current = true;
    }
  }, [location?.state, complaints]);

  

  // 💬 Feedback & Admin actions (same as before)
  const getAdminIdentifier = () => currentUser?.uid || currentUser?.email || "admin-user";

  const getAdminDisplayName = () => "Administrator"; // Do not expose email or personal name

  const getSharedNote = (complaint) =>
    (complaint?.adminNotes && complaint.adminNotes[0]) || null;

  const openNoteModal = (complaint) => {
    if (!currentUser) {
      alert("You must be logged in to manage notes.");
      return;
    }

    if (!staffRole) {
      alert("We cannot determine your role yet. Please try again shortly.");
      return;
    }

    const existingNote = getSharedNote(complaint);
    setNoteModalComplaint(complaint);
    setNoteInput(existingNote?.note || "");
    setNoteError("");
  };

  const closeNoteModal = () => {
    setNoteModalComplaint(null);
    setNoteInput("");
    setNoteError("");
    setIsSavingNote(false);
  };


  
  const handleSaveAdminNote = async () => {
    if (!noteModalComplaint || !currentUser) return;
    if (!staffRole) {
      setNoteError("Your staff role is not set. Please reload and try again.");
      return;
    }

    if (!noteInput.trim()) {
      setNoteError("Please enter a note before saving.");
      return;
    }

    setIsSavingNote(true);
    setNoteError("");

    try {
      const adminId = getAdminIdentifier();
      const adminName = getAdminDisplayName();

      const updatedNote = {
        adminId,
        adminName,
        adminRole: staffRole || "staff",
        note: noteInput.trim(),
        updatedAt: new Date().toISOString(),
      };

      const updatedNotes = [updatedNote];

      const complaintRef = doc(db, "complaints", noteModalComplaint.id);
      await updateDoc(complaintRef, { adminNotes: updatedNotes });

      setComplaints((prev) =>
        prev.map((complaint) =>
          complaint.id === noteModalComplaint.id
            ? { ...complaint, adminNotes: updatedNotes }
            : complaint
        )
      );

      if (selectedComplaint?.id === noteModalComplaint.id) {
        setSelectedComplaint((prev) =>
          prev ? { ...prev, adminNotes: updatedNotes } : prev
        );
      }

      closeNoteModal();
    } catch (error) {
      console.error("Error saving admin note:", error);
      setNoteError("Unable to save note right now. Please try again.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!selectedComplaint) return;
    const text = (feedback || "").trim();
    if (!text) {
      alert("Please enter feedback");
      return;
    }

    try {
      const adminId = getAdminIdentifier();
      const adminName = getAdminDisplayName();
      const newFb = {
        adminId,
        admin: adminName,
        adminRole: staffRole || "staff",
        adminEmail: currentUser?.email || "",
        feedback: text,
        date: new Date().toISOString(),
        files: (feedbackFiles || []).map((f) => f?.name || String(f)),
      };

      const ref = doc(db, "complaints", selectedComplaint.id);
      await updateDoc(ref, {
        feedbackHistory: arrayUnion(newFb),
        Feedback: text,
        feedbackUpdatedAt: new Date().toISOString(),
      });

      setComplaints((prev) => prev.map((c) => (
        c.id === selectedComplaint.id
          ? { ...c, feedbackHistory: [...(c.feedbackHistory || []), newFb], Feedback: text }
          : c
      )));
      setSelectedComplaint((prev) => prev ? { ...prev, feedbackHistory: [...(prev.feedbackHistory || []), newFb], Feedback: text } : prev);
      setFeedback("");
      setFeedbackFiles([]);
      alert("Feedback sent");
    } catch (e) {
      console.error("Failed to send feedback:", e);
      alert("Failed to send feedback. Please try again.");
    }
  };

  const handleFeedbackFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setFeedbackFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFeedbackFile = (indexToRemove) => {
    setFeedbackFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const openModalForStatusChange = (complaint) => {
    openModal(complaint, "manage", "status");
  };
  const handleAssignComplaint = () => {
    if (!assignTo) {
      alert("Please select who to assign to");
      return;
    }

    const updated = complaints.map((c) =>
      c.id === selectedComplaint.id
        ? { ...c, assignedTo: assignTo }
        : c
    );

    setComplaints(updated);
    setSelectedComplaint({ ...selectedComplaint, assignedTo: assignTo });
  };

const handleUpdateStatus = async (newStatus) => {
  if (!selectedComplaint || !newStatus || newStatus === selectedComplaint.status) return;

  // Add confirmation before update
  const confirmed = window.confirm(
    `Are you sure you want to change the status to "${newStatus}"?`
  );
  if (!confirmed) return; // If not confirmed, do nothing

  try {
    // Update the status in Firestore
    const complaintRef = doc(db, "complaints", selectedComplaint.id);
    await updateDoc(complaintRef, {
      status: newStatus,
      statusUpdatedAt: new Date().toISOString(),
      statusUpdatedBy: currentUser?.uid || currentUser?.email || "staff",
      statusUpdatedByRole: staffRole || "staff",
    });

    // Update the status in the UI (locally)
    const updatedComplaints = complaints.map((complaint) =>
      complaint.id === selectedComplaint.id
        ? { ...complaint, status: newStatus }
        : complaint
    );

    setComplaints(updatedComplaints);
    setSelectedComplaint({ ...selectedComplaint, status: newStatus });
    setNewStatus(newStatus);

  } catch (error) {
    console.error("❌ Error updating complaint status:", error);
  }
};

const getStatusClass = (status) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return "status-pending"; // CSS class for Pending status color
    case "in progress":
      return "status-in-progress"; // CSS class for In Progress status color
    case "resolved":
      return "status-resolved"; // CSS class for Resolved status color
    case "closed":
      return "status-closed"; // CSS class for Closed status color
    default:
      return "status-pending"; // Default to pending if no status is available
  }
};

  // 🧹 Utility helpers
  const formatDateTime = (date) => {
    if (!date) return "N/A";
    const d = date.toDate ? date.toDate() : new Date(date);
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

  const CATEGORY_FIELD_CONFIG = {
    academic: [
      { key: "courseTitle", label: "Course / Subject Title" },
      { key: "instructor", label: "Instructor" },
      { key: "concernDescription", label: "Concern Description" },
      { key: "impactExperience", label: "Academic Impact" },
      { key: "gradingFairness", label: "Grading Fairness" },
      { key: "lessonSatisfaction", label: "Lesson Satisfaction" },
      { key: "workloadStress", label: "Workload Stress Frequency" },
    ],
    "faculty-conduct": [
      { key: "departmentOffice", label: "Department / Office" },
      { key: "incidentDescription", label: "Incident Description" },
      { key: "incidentDate", label: "Date of Occurrence", format: formatDateTime },
      { key: "incidentFrequency", label: "Frequency" },
      { key: "additionalContext", label: "Additional Context" },
      { key: "respectLevel", label: "Respect Level" },
      { key: "professionalism", label: "Professionalism" },
      { key: "similarBehavior", label: "Similar Behavior Frequency" },
    ],
    facilities: [
      { key: "facilityLocation", label: "Location / Room" },
      { key: "observedDateTime", label: "Observed On", format: formatDateTime },
      { key: "facilityDescription", label: "Facility Issue" },
      { key: "facilitySatisfaction", label: "Facility Satisfaction" },
      { key: "facilityFrequency", label: "Issue Frequency" },
      { key: "facilitySafety", label: "Safety Concern Level" },
    ],
    "administrative-student-services": [
      { key: "officeInvolved", label: "Office / Service" },
      { key: "transactionDate", label: "Transaction Date", format: formatDateTime },
      { key: "concernFeedback", label: "Concern / Feedback" },
      { key: "additionalNotes", label: "Additional Notes" },
      { key: "serviceEfficiency", label: "Service Efficiency" },
      { key: "communicationSatisfaction", label: "Communication Satisfaction" },
      { key: "serviceAccessibility", label: "Service Accessibility" },
    ],
    other: [{ key: "otherDescription", label: "Concern Description" }],
  };

  const getCategorySpecificDetails = (complaint) => {
    if (!complaint) return [];

    const fields = CATEGORY_FIELD_CONFIG[complaint.category] || [];
    return fields
      .map(({ key, label, format }) => {
        const rawValue = complaint[key];
        if (rawValue === undefined || rawValue === null || rawValue === "") {
          return null;
        }
        const value = format ? format(rawValue) : rawValue;
        return { label, value };
      })
      .filter(Boolean);
  };

  const renderComplaintDetails = () => {
    if (!selectedComplaint) return null;

    const categoryDetails = getCategorySpecificDetails(selectedComplaint);

    const attachmentCandidates = [];
    if (Array.isArray(selectedComplaint.attachments) && selectedComplaint.attachments.length) {
      attachmentCandidates.push(...selectedComplaint.attachments);
    }
    if (selectedComplaint.attachment) {
      attachmentCandidates.push(selectedComplaint.attachment);
    }
    if (selectedComplaint.attachmentUrl) {
      attachmentCandidates.push(selectedComplaint.attachmentUrl);
    }
    if (selectedComplaint.attachmentURL) {
      attachmentCandidates.push(selectedComplaint.attachmentURL);
    }

    return (
      <>
        <div className="detail-section">
          <h4>{`${getCategoryLabel(selectedComplaint.category)} Details`}</h4>
          {categoryDetails.length > 0 ? (
            <div className="detail-grid">
              {categoryDetails.map((info) => (
                <div className="detail-item" key={info.label}>
                  <strong>{info.label}:</strong>
                  <span>{info.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p>No specific details were provided for this category.</p>
          )}
        </div>

        {attachmentCandidates.length > 0 && (
          <div className="detail-section">
            <h4>Attachments</h4>
            {attachmentCandidates.map((file, index) => {
              const label =
                typeof file === "string"
                  ? file
                  : file?.name || file?.fileName || `Attachment ${index + 1}`;
              const url = typeof file === "string" ? file : file?.url || file?.downloadURL;

              return (
                <div className="attachment-item" key={`${label}-${index}`}>
                  <span>dY"Z {label}</span>
                  {url && (
                    <a className="btn-link" href={url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  const formatNoteTimestamp = (value) => {
    if (!value) return "Just now";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";
    return date.toLocaleString();
  };

  const visibleTabs = modalMode === "view" ? VIEW_TABS : MANAGE_TABS;

return (
  <div className="flex min-h-screen">
      {/* Sidebar */}
      <StaffSideBar />

      {/* Main Content */}
      <main className="flex-1 transition-all duration-300 flex flex-col ml-0">
          <StaffNavBar />

      <div className="flex-1 mt-24 mx-8 mb-8 p-4 sm:p-6 lg:p-10">      
      {/* Filters */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md mb-6 sm:mb-8 flex flex-col sm:flex-row gap-4 sm:gap-5 mx-0 sm:mx-5">
        <div className="flex-1 min-w-[200px]">
          <label className="block font-semibold text-[#800000] mb-2 text-sm">Search:</label>
          <input
            type="text"
            placeholder="Search by ID ..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/10"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block font-semibold text-[#800000] mb-2 text-sm">Category:</label>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/10"
          >
            <option value="all">All</option>
            <option value="academic">Academic</option>
            <option value="faculty-conduct">Faculty Conduct</option>
            <option value="facilities">Facilities</option>
            <option value="administrative-student-services">Admin/Student Services</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block font-semibold text-[#800000] mb-2 text-sm">Status:</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/10"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gradient-to-r from-[#8B1538]/8 to-[#A94922]/6 border-b-2 border-[#8B1538]/15">
              <tr>
                <th className="px-4 sm:px-6 py-4 text-left font-bold text-xs sm:text-sm text-[#621313] uppercase tracking-wide">ID</th>
                <th className="px-4 sm:px-6 py-4 text-left font-bold text-xs sm:text-sm text-[#621313] uppercase tracking-wide">Category</th>
                <th className="px-4 sm:px-6 py-4 text-left font-bold text-xs sm:text-sm text-[#621313] uppercase tracking-wide">Status</th>
                <th className="px-4 sm:px-6 py-4 text-left font-bold text-xs sm:text-sm text-[#621313] uppercase tracking-wide hidden sm:table-cell">Date</th>
                <th className="px-4 sm:px-6 py-4 text-left font-bold text-xs sm:text-sm text-[#621313] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-gray-400 italic text-sm">
                    No complaints found
                  </td>
                </tr>
              ) : (
                filteredComplaints.map((c) => (
                  <tr key={c.id} className="hover:bg-red-50 transition-colors duration-200">
                    <td className="px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-800">{c.id}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-800">{getCategoryLabel(c.category)}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <span 
                        className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold capitalize cursor-pointer ${getStatusClass(c.status)}`}
                        onClick={() => openModalForStatusChange(c)}
                      >
                        {c.status || "Pending"}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-800 hidden sm:table-cell">{formatDateTime(c.submissionDate)}</td>
                    <td className="px-3 sm:px-4 py-3 sm:py-4">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          className="bg-[#1094d0] text-white border-none px-3 py-1.5 rounded-full cursor-pointer font-medium text-xs transition-all duration-300 hover:bg-[#A84700] hover:-translate-y-0.5 hover:shadow-lg"
                          onClick={() => openModal(c, "manage")}
                          title="View the full complaint details"
                        >
                          View
                        </button>
                        <button
                          className="bg-[#65b95e] text-white border-none px-3 py-1.5 rounded-full cursor-pointer font-medium text-xs transition-all duration-300 hover:bg-[#A84700] hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
                          onClick={() => openNoteModal(c)}
                          disabled={!currentUser}
                          title={
                            getSharedNote(c)
                              ? "Update the note for this assignment"
                              : "Add a note for this assignment"
                          }
                        >
                          {getSharedNote(c) ? "Update Note" : "Add Note"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Modal */}
      {showModal && selectedComplaint && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[1000] p-4 sm:p-5 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-[modalSlideIn_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 sm:px-8 py-5 sm:py-6 border-b-2 border-gray-200 flex justify-between items-start bg-gradient-to-r from-[#800000] to-[#600000] text-white rounded-t-2xl">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white m-0">Complaint #{selectedComplaint.id}</h3>
                <p className="text-xs opacity-90 mt-1">
                  {getCategoryLabel(selectedComplaint.category)}
                </p>
              </div>
              <button className="text-white w-8 h-8 cursor-pointer flex items-center justify-center transition-all duration-300 hover:bg-white/30 hover:rotate-90 hover:rounded-full border-none bg-transparent" onClick={closeModal}>
                <i className="fas fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="flex bg-gray-50 p-0 border-b-2 border-gray-300 overflow-x-auto">
              {visibleTabs.map((tabKey) => (
                <button
                  key={tabKey}
                  className={`flex-1 min-w-[100px] px-4 sm:px-5 py-3 sm:py-4 bg-transparent border-none cursor-pointer font-medium text-xs sm:text-sm transition-all duration-300 border-b-[3px] ${
                    activeTab === tabKey 
                      ? 'bg-white text-[#800000] border-[#800000] font-semibold' 
                      : 'text-gray-600 border-transparent hover:bg-gray-200 hover:text-[#800000]'
                  }`}
                  onClick={() => setActiveTab(tabKey)}
                >
                  {TAB_LABELS[tabKey]}
                </button>
              ))}
              {modalMode === "view" && (
                <button className="bg-[#800000] text-white border-none px-4 py-2.5 rounded-lg cursor-pointer font-normal text-sm transition-all duration-200 mt-4" onClick={() => switchToManageMode("details")}>
                  Manage Complaint
                </button>
              )}
            </div>

            <div className="px-6 sm:px-8 py-5 sm:pt-4 overflow-y-auto flex-1">
              {visibleTabs.includes("details") && activeTab === "details" && (
                <div>{renderComplaintDetails()}</div>
              )}

              {visibleTabs.includes("feedback") && activeTab === "feedback" && (
                <div>
                  <h4 className="text-[#800000] text-base sm:text-lg font-semibold m-0 mb-5 pb-2.5 border-b-2 border-gray-200">Feedback History</h4>
                  {!selectedComplaint.feedbackHistory || selectedComplaint.feedbackHistory.length === 0 ? (
                    <p className="text-center py-10 text-gray-400 italic bg-gray-50 rounded-lg">No feedback shared yet.</p>
                  ) : (
                    <div className="mb-6">
                      {selectedComplaint.feedbackHistory.map((item, index) => (
                        <div className="bg-gray-50 p-4 rounded-lg mb-3 border-l-4 border-[#800000]" key={`${item.date || index}-${index}`}>
                          <div className="flex justify-between items-center mb-2.5">
                            <strong className="text-[#800000] text-sm">Administrator</strong>
                            <span className="text-gray-400 text-xs">
                              {item.date ? formatDateTime(item.date) : "Just now"}
                            </span>
                          </div>
                          <p className="text-gray-800 text-sm m-0 leading-relaxed">{item.feedback}</p>
                          {item.files && item.files.length > 0 && (
                            <div className="flex gap-2 flex-wrap mt-2.5">
                              {item.files.map((file, fileIndex) => (
                                <span className="inline-block px-2.5 py-1 bg-white border border-gray-300 rounded text-xs text-gray-600" key={`${file}-${fileIndex}`}>
                                  {file.name || file}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-white p-5 sm:p-6 rounded-xl border-2 border-gray-200 mt-5">
                    <h4 className="text-[#800000] text-base sm:text-lg font-semibold m-0 mb-5 pb-2.5 border-b-2 border-gray-200">Send New Feedback</h4>
                    <textarea
                      rows="4"
                      placeholder="Write your feedback to the student..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="w-full px-4 sm:px-5 py-3 sm:py-4 border border-gray-400 rounded-xl text-sm sm:text-base text-gray-800 resize-vertical transition-all duration-300 shadow-sm mb-4 focus:outline-none focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/15"
                    ></textarea>

                    <div className="my-5">
                      <label className="inline-block px-5 py-2.5 bg-red-50 text-[#800000] border-2 border-dashed border-[#800000] rounded-lg cursor-pointer font-medium transition-all duration-300 hover:bg-[#800000] hover:text-white">
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={handleFeedbackFileChange}
                          className="hidden"
                        />
                        Attach Files
                      </label>
                      {feedbackFiles.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2.5">
                          {feedbackFiles.map((file, index) => (
                            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-xs" key={`${file.name || "file"}-${index}`}>
                              <span>{file.name || "Attachment"}</span>
                              <button type="button" onClick={() => handleRemoveFeedbackFile(index)} className="bg-[#800000] text-white border-none rounded-full w-5 h-5 cursor-pointer text-sm leading-none transition-all duration-200 hover:bg-[#600000] hover:scale-110">
                                <i className="fas fa-times"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button className="bg-[#800000] text-white border-none px-4 sm:px-5 py-2.5 rounded-lg cursor-pointer font-normal text-sm transition-all duration-200 mt-4 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#800000]/30 active:translate-y-0" onClick={handleSendFeedback}>
                      Send Feedback
                    </button>
                  </div>
                </div>
              )}

              {visibleTabs.includes("notes") && activeTab === "notes" && (
                <div>
                  <h4 className="text-[#800000] text-base sm:text-lg font-semibold m-0 mb-5 pb-2.5 border-b-2 border-gray-200">Shared Notes</h4>
                  {!selectedComplaint.adminNotes || selectedComplaint.adminNotes.length === 0 ? (
                    <p className="text-center py-10 text-gray-400 italic bg-gray-50 rounded-lg">No notes have been added.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {selectedComplaint.adminNotes.map((note, index) => (
                        <div className="bg-gray-50 border border-gray-300 rounded-xl px-3.5 py-3" key={`${note.adminId || "note"}-${index}`}>
                          <div className="flex justify-between items-center text-xs text-gray-600 mb-1.5">
                            <span className="font-medium">
                              {note.adminName || "Unknown"} -{" "}
                              {note.adminRole ? note.adminRole.toUpperCase() : "STAFF"}
                            </span>
                            <span className="text-gray-500">
                              {formatNoteTimestamp(note.updatedAt || note.createdAt)}
                            </span>
                          </div>
                          <p className="m-0 text-sm text-gray-800">{note.note}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="bg-[#800000] text-white border-none px-4 sm:px-5 py-2.5 rounded-lg cursor-pointer font-normal text-sm transition-all duration-200 mt-4 hover:bg-gray-400" onClick={() => openNoteModal(selectedComplaint)}>
                    {getSharedNote(selectedComplaint) ? "Update Note" : "Add Note"}
                  </button>
                </div>
              )}

              {visibleTabs.includes("status") && activeTab === "status" && (
                <div>
                  <h4 className="text-[#800000] text-base sm:text-lg font-semibold m-0 mb-5 pb-2.5 border-b-2 border-gray-200">Status Management</h4>

                  <div className="bg-red-50 p-5 rounded-lg mb-5 text-center">
                    <p className="m-0 mb-2.5 text-gray-600 font-medium">
                      <strong>Current Status:</strong>
                    </p>
                    <span className={`inline-block px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize ${getStatusClass(selectedComplaint.status)}`}>
                      {selectedComplaint.status || "Pending"}
                    </span>
                  </div>

                  <div className="bg-white p-5 sm:p-6 rounded-xl border-2 border-gray-200 mt-5">
                    <div className="mb-5">
                      <label className="block font-semibold text-[#800000] mb-2 text-sm">New Status:</label>
                      <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm transition-all duration-300 focus:outline-none focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/10">
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <button className="bg-[#800000] text-white border-none px-4 sm:px-5 py-2.5 rounded-lg cursor-pointer font-normal text-sm transition-all duration-200 mt-4 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#800000]/30 active:translate-y-0" onClick={() => handleUpdateStatus(newStatus)}>
                      Update Status
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {noteModalComplaint && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[1000] p-4 sm:p-5 backdrop-blur-sm" onClick={closeNoteModal}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl animate-[modalSlideIn_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 sm:px-8 py-5 sm:py-6 border-b-2 border-gray-200 flex justify-between items-start bg-gradient-to-r from-[#800000] to-[#600000] text-white rounded-t-2xl">
              <h3 className="text-lg sm:text-xl font-bold text-white m-0">
                {getSharedNote(noteModalComplaint) ? "Update" : "Add"} Note - {noteModalComplaint.id}
              </h3>
              <button className="text-white w-8 h-8 cursor-pointer flex items-center justify-center transition-all duration-300 hover:bg-white/30 hover:rotate-90 hover:rounded-full border-none bg-transparent text-2xl leading-none" onClick={closeNoteModal}>
                ×
              </button>
            </div>
            <div className="px-6 sm:px-8 py-5 sm:pt-4 overflow-y-auto flex-1">
              <textarea
                className="w-full min-h-[140px] border border-gray-400 rounded-xl px-3.5 py-3 text-sm resize-vertical transition-all duration-200 focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/12 focus:outline-none"
                placeholder="Write a quick update for this complaint..."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
              />
              {noteError && <p className="text-red-700 text-xs mt-2">{noteError}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 sm:px-8 py-5 sm:pb-8 border-t border-gray-200">
              <button className="bg-[#800000] text-white border-none px-4 sm:px-5 py-2.5 rounded-lg cursor-pointer font-normal text-sm transition-all duration-200 hover:bg-gray-400 disabled:opacity-70 disabled:cursor-not-allowed" onClick={closeNoteModal} disabled={isSavingNote}>
                Cancel
              </button>
              <button
                className="bg-[#800000] text-white border-none px-4 sm:px-5 py-2.5 rounded-lg cursor-pointer font-normal text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#800000]/30 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
                onClick={handleSaveAdminNote}
                disabled={isSavingNote}
              >
                {isSavingNote
                  ? "Saving..."
                  : getSharedNote(noteModalComplaint)
                  ? "Update Note"
                  : "Add Note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </main>
  </div>
);
}

export default AdminMonitorComplaints;

