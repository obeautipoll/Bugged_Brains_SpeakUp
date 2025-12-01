import React, { useState, useEffect, useRef } from "react";
import SideBar from "./components/AdminSideBar";
import AdminNavbar from "./components/AdminNavBar";
import { db } from "../../firebase/firebase";
import { collection, getDocs, orderBy, query, updateDoc, doc, serverTimestamp, where } from "firebase/firestore";
import { useAuth } from "../../contexts/authContext";
import { useLocation, useNavigate } from "react-router-dom";
import { arrayUnion } from "firebase/firestore";

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
  const [newStatus, setNewStatus] = useState("pending");
  const [noteModalComplaint, setNoteModalComplaint] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [noteRole, setNoteRole] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const [roleEmails, setRoleEmails] = useState({ staff: "", kasama: "" });
  const [assignmentUsers, setAssignmentUsers] = useState([]);
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const hasAppliedRouteSelection = useRef(false);
  const MANAGE_TABS = ["details", "feedback", "notes", "assign", "status"];
  const TAB_LABELS = {
    details: "Details",
    feedback: "Feedback",
    notes: "Notes",
    assign: "Assign",
    status: "Status",
  };
  const STATUS_OPTIONS = ["pending", "in-progress", "resolved", "closed"];
  const normalizeStatusValue = (value = "") =>
    value.toString().trim().toLowerCase().replace(/\s+/g, "-");
  const formatStatusLabel = (value = "") => {
    const normalized = normalizeStatusValue(value);
    const labels = {
      pending: "Pending",
      "in-progress": "In Progress",
      resolved: "Resolved",
      closed: "Closed",
    };
    return labels[normalized] || (value ? String(value) : "Pending");
  };

  const getCurrentUserRole = () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      return (storedUser?.role || "admin").toLowerCase();
    } catch (error) {
      console.error("Failed to parse stored user role:", error);
      return "admin";
    }
  };

  // 🔥 Fetch complaints from Firestore
  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const q = query(collection(db, "complaints"), orderBy("submissionDate", "desc"));
        const snapshot = await getDocs(q);

        const fetchedComplaints = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setComplaints(fetchedComplaints);
        setFilteredComplaints(fetchedComplaints);

        try {
          const state = location?.state || {};
          if (!hasAppliedRouteSelection.current && state.complaintId && !selectedComplaint) {
            const found = fetchedComplaints.find((c) => c.id === state.complaintId);
            if (found) {
              if (state.focusTab === 'status') {
                openModal(found, 'manage', 'status');
              } else if (state.focusTab === 'feedback') {
                openModal(found, 'view', 'feedback');
              } else {
                openModal(found, 'view', 'details');
              }
            }
            hasAppliedRouteSelection.current = true;
            try { navigate('/amonitorcomplaints', { replace: true }); } catch {}
          }
        } catch {}
      } catch (error) {
        console.error("❌ Error fetching complaints:", error);
      }
    };

    fetchComplaints();
  }, []);

  useEffect(() => {
    if (getCurrentUserRole() !== "admin") return;
    const fetchRoleEmails = async () => {
      try {
        const roleQuery = query(collection(db, "users"), where("role", "in", ["staff", "kasama"]));
        const snapshot = await getDocs(roleQuery);
        const found = { staff: "", kasama: "" };
        const users = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const role = (data.role || "").toLowerCase();
          const email = (data.email || "").trim();
          if ((role === "staff" || role === "kasama") && email) {
            if (!found[role]) {
              found[role] = email;
            }
            users.push({
              id: docSnap.id,
              role,
              email,
              emailLower: email.toLowerCase(),
            });
          }
        });

        setRoleEmails(found);
        setAssignmentUsers(users);
      } catch (error) {
        console.error("Failed to fetch role emails:", error);
      }
    };

    fetchRoleEmails();
  }, []);

  // 🔎 Filtering logic
  useEffect(() => {
    let filtered = complaints;

    if (filters.category !== "all") {
      filtered = filtered.filter((c) => c.category === filters.category);
    }

    if (filters.status !== "all") {
      filtered = filtered.filter(
        (c) => normalizeStatusValue(c.status) === normalizeStatusValue(filters.status)
      );
    }

    if (filters.search) {
      filtered = filtered.filter(
        (c) =>
          (c.id && c.id.toLowerCase().includes(filters.search.toLowerCase())) ||
          (c.category && c.category.toLowerCase().includes(filters.search.toLowerCase()))
      );
    }

    setFilteredComplaints(filtered);
  }, [filters, complaints]);

  useEffect(() => {
    const allowedTabs = MANAGE_TABS;
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [modalMode, activeTab]);

  const openModal = (complaint, mode = "view", defaultTab = "details") => {
    setSelectedComplaint(complaint);
    setShowModal(true);
    setModalMode(mode);
    setActiveTab(defaultTab);
    setFeedback("");
    setFeedbackFiles([]);
    setAssignTo(getAssignmentValue(complaint.assignedRole, complaint.assignedTo));
    setAssignMessage("");
    setNewStatus(normalizeStatusValue(complaint.status || "pending"));
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
  };

  const getAdminIdentifier = () => currentUser?.uid || currentUser?.email || "admin-user";

  const getAdminDisplayName = () =>
    currentUser?.displayName || currentUser?.email || "Admin User";

  const getSharedNote = (complaint) =>
    (complaint?.adminNotes && complaint.adminNotes[0]) || null;

  const openNoteModal = (complaint) => {
    if (!currentUser) {
      alert("You must be logged in to manage notes.");
      return;
    }

    const existingNote = getSharedNote(complaint);
    setNoteModalComplaint(complaint);
    setNoteInput(existingNote?.note || "");
    setNoteError("");
    const roleSource = complaint.assignedRole || complaint.assignedTo || "admin";
    setNoteRole(roleSource);
  };

  const closeNoteModal = () => {
    setNoteModalComplaint(null);
    setNoteInput("");
    setNoteError("");
    setIsSavingNote(false);
  };

  const handleSaveAdminNote = async () => {
    if (!noteModalComplaint || !currentUser) return;

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
        adminRole: getCurrentUserRole(),
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

  const handleAssignSelectionChange = async (complaint, selectionValue) => {
    setAssignmentError("");
    const { role, email } = resolveAssignmentSelection(selectionValue);

    const applyLocalUpdate = (list) =>
      list.map((item) =>
        item.id === complaint.id ? { ...item, assignedRole: role, assignedTo: email } : item
      );

    setComplaints((prev) => applyLocalUpdate(prev));
    setFilteredComplaints((prev) => applyLocalUpdate(prev));
    if (selectedComplaint?.id === complaint.id) {
      setSelectedComplaint((prev) =>
        prev ? { ...prev, assignedRole: role, assignedTo: email } : prev
      );
      setAssignTo(getAssignmentValue(role, email));
    }

    try {
      await updateDoc(doc(db, "complaints", complaint.id), {
        assignedRole: role || "",
        assignedTo: email || "",
        assignmentUpdatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to update assignment:", error);
      setAssignmentError("Unable to update assignment right now.");
    }
  };

  const handleSendFeedback = async () => {
    if (!selectedComplaint) return;
    if (!feedback.trim()) {
      alert("Please enter feedback");
      return;
    }

    const role = getCurrentUserRole();
    const adminName = currentUser?.displayName || currentUser?.email || (role === 'kasama' ? 'KASAMA' : 'Admin User');

    const newFeedback = {
      feedback,
      admin: adminName,
      adminRole: role,
      adminEmail: currentUser?.email || "",
      date: new Date().toISOString(),
      files: feedbackFiles.map((f) => f.name),
    };

    const updatedFeedback = [...(selectedComplaint.feedbackHistory || []), newFeedback];

    const updated = complaints.map((c) =>
      c.id === selectedComplaint.id
        ? { ...c, feedbackHistory: updatedFeedback, Feedback: newFeedback.feedback }
        : c
    );

    setComplaints(updated);
    setFilteredComplaints((prev) =>
      prev.map((c) => (c.id === selectedComplaint.id ? { ...c, feedbackHistory: updatedFeedback, Feedback: newFeedback.feedback } : c))
    );
    setSelectedComplaint({
      ...selectedComplaint,
      feedbackHistory: updatedFeedback,
      Feedback: newFeedback.feedback,
    });

    try {
      await updateDoc(doc(db, "complaints", selectedComplaint.id), {
        feedbackHistory: updatedFeedback,
        Feedback: newFeedback.feedback,
        feedbackUpdatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to save feedback:", error);
      alert("Unable to save feedback right now. It may not appear to students.");
    }

    setFeedback("");
    setFeedbackFiles([]);
  };

  const handleFeedbackFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setFeedbackFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFeedbackFile = (indexToRemove) => {
    setFeedbackFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSendFeedbackPersist = async () => {
    if (!selectedComplaint) return;
    const text = (feedback || "").trim();
    if (!text) {
      alert("Please enter feedback");
      return;
    }

    try {
      const adminId = currentUser?.uid || currentUser?.email || "admin-user";
      const adminName = currentUser?.displayName || currentUser?.email || "Admin User";
      const role = getCurrentUserRole ? getCurrentUserRole() : "admin";

      const newFeedback = {
        adminId,
        admin: adminName,
        adminRole: role,
        adminEmail: currentUser?.email || "",
        feedback: text,
        date: new Date().toISOString(),
        files: (feedbackFiles || []).map((f) => f?.name || String(f)),
      };

      const ref = doc(db, "complaints", selectedComplaint.id);
      await updateDoc(ref, {
        feedbackHistory: arrayUnion(newFeedback),
        Feedback: text,
        feedbackUpdatedAt: new Date().toISOString(),
      });

      setComplaints((prev) =>
        prev.map((c) =>
          c.id === selectedComplaint.id
            ? { ...c, feedbackHistory: [...(c.feedbackHistory || []), newFeedback], Feedback: text }
            : c
        )
      );
      setSelectedComplaint((prev) =>
        prev ? { ...prev, feedbackHistory: [...(prev.feedbackHistory || []), newFeedback], Feedback: text } : prev
      );
      setFeedback("");
      setFeedbackFiles([]);
      alert("Feedback sent");
    } catch (e) {
      console.error("Failed to send feedback:", e);
      alert("Failed to send feedback. Please try again.");
    }
  };

  const openModalForStatusChange = (complaint) => {
    openModal(complaint, "manage", "status");
  };

  const handleAssignComplaint = async () => {
    if (!selectedComplaint) return;
    const { role, email } = resolveAssignmentSelection(assignTo);
    if (!role || !email) {
      setAssignmentError("Please select a staff or kasama email to assign.");
      return;
    }

    setAssignmentError("");
    const trimmedMessage = assignMessage.trim();

    const updatedComplaints = complaints.map((c) =>
      c.id === selectedComplaint.id
        ? { ...c, assignedRole: role, assignedTo: email, assignmentMessage: trimmedMessage }
        : c
    );

    setComplaints(updatedComplaints);
    setSelectedComplaint({
      ...selectedComplaint,
      assignedRole: role,
      assignedTo: email,
      assignmentMessage: trimmedMessage,
    });
    setAssignMessage("");

    try {
      await updateDoc(doc(db, "complaints", selectedComplaint.id), {
        assignedRole: role,
        assignedTo: email,
        assignmentMessage: trimmedMessage,
        assignmentUpdatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to update assignment details:", error);
      setAssignmentError("Unable to assign this complaint right now.");
    }
  };

  const handleUpdateStatus = async (nextStatusValue) => {
    if (!selectedComplaint || !nextStatusValue) return;

    const normalizedNext = normalizeStatusValue(nextStatusValue);
    const currentNormalized = normalizeStatusValue(selectedComplaint.status);
    if (!normalizedNext || normalizedNext === currentNormalized) return;

    const displayStatus = formatStatusLabel(normalizedNext);

    const confirmed = window.confirm(
      `Are you sure you want to change the status to "${displayStatus}"?`
    );
    if (!confirmed) return;

    try {
      const complaintRef = doc(db, "complaints", selectedComplaint.id);
      await updateDoc(complaintRef, {
        status: displayStatus,
        statusUpdatedAt: serverTimestamp(),
      });

      const updatedComplaints = complaints.map((complaint) =>
        complaint.id === selectedComplaint.id
          ? { ...complaint, status: displayStatus }
          : complaint
      );

      setComplaints(updatedComplaints);
      setSelectedComplaint({ ...selectedComplaint, status: displayStatus });
      setNewStatus(normalizedNext);

    } catch (error) {
      console.error("❌ Error updating complaint status:", error);
    }
  };

  const getStatusClass = (status) => {
    switch (normalizeStatusValue(status)) {
      case "pending":
        return "bg-amber-50 text-amber-600";
      case "in-progress":
        return "bg-blue-50 text-blue-600";
      case "resolved":
        return "bg-green-50 text-green-600";
      case "closed":
        return "bg-gray-100 text-gray-600";
      default:
        return "bg-amber-50 text-amber-600";
    }
  };

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
        <div className="mb-8 bg-gray-50 p-5 rounded-lg">
          <h4 className="text-[#800000] text-base font-semibold mb-4 pb-2 border-b-2 border-gray-200">
            {`${getCategoryLabel(selectedComplaint.category)} Details`}
          </h4>
          {categoryDetails.length > 0 ? (
            <div className="space-y-4">
              {categoryDetails.map((info) => (
                <div className="grid grid-cols-[200px_1fr] gap-4 items-start" key={info.label}>
                  <strong className="text-[#333] font-semibold text-[13px]">{info.label}:</strong>
                  <span className="text-[#666] text-xs">{info.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p>No specific details were provided for this category.</p>
          )}
        </div>

        {attachmentCandidates.length > 0 && (
          <div className="mb-8 bg-gray-50 p-5 rounded-lg">
            <h4 className="text-[#800000] text-base font-semibold mb-4 pb-2 border-b-2 border-gray-200">
              Attachments
            </h4>
            {attachmentCandidates.map((file, index) => {
              const label =
                typeof file === "string"
                  ? file
                  : file?.name || file?.fileName || `Attachment ${index + 1}`;
              const url = typeof file === "string" ? file : file?.url || file?.downloadURL;

              return (
                <div className="flex justify-between items-center p-4 bg-white rounded-lg border border-gray-200" key={`${label}-${index}`}>
                  <span>📎 {label}</span>
                  {url && (
                    <a className="text-[#800000] font-medium underline text-sm hover:text-[#600000]" href={url} target="_blank" rel="noreferrer">
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

  const visibleTabs = MANAGE_TABS;
  const getRoleLabel = (role) => (role === "kasama" ? "Kasama" : "Staff");
  const getAssignmentValue = (role, email) => {
    const normalizedRole = (role || "").toLowerCase();
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedRole || !normalizedEmail) return "";
    return `${normalizedRole}|${normalizedEmail}`;
  };
  const parseAssignmentValue = (value) => {
    if (!value) return { role: "", emailLower: "" };
    const [role, emailLower] = value.split("|");
    return {
      role: (role || "").toLowerCase(),
      emailLower: (emailLower || "").toLowerCase(),
    };
  };
  const resolveAssignmentSelection = (value) => {
    const parsed = parseAssignmentValue(value);
    if (!parsed.role || !parsed.emailLower) {
      return { role: "", email: "", emailLower: "" };
    }
    const matched = assignmentUsers.find(
      (user) => user.role === parsed.role && user.emailLower === parsed.emailLower
    );
    if (matched) {
      return { role: matched.role, email: matched.email, emailLower: matched.emailLower };
    }
    return { role: parsed.role, email: parsed.emailLower, emailLower: parsed.emailLower };
  };
  const getAssignmentLabel = (role, email) => {
    if (!role || !email) return "Unassigned";
    return `${getRoleLabel(role)}: ${email}`;
  };
  const getComplaintAssignmentValue = (complaint) =>
    getAssignmentValue(complaint.assignedRole, complaint.assignedTo);
  const getAssignmentLabelFromValue = (value) => {
    const { role, email } = resolveAssignmentSelection(value);
    return getAssignmentLabel(role, email);
  };
  const assignSelectionExists = assignmentUsers.some(
    (user) => getAssignmentValue(user.role, user.email) === assignTo
  );
  const getFeedbackSenderLabel = (entry) => {
    if (!entry) return "ADMIN";
    const roleKey = (entry.adminRole || "").toLowerCase();
    const roleLabel = roleKey ? roleKey.toUpperCase() : "ADMIN";
    let identifier = entry.adminEmail || "";

    if (
      !identifier &&
      getCurrentUserRole() === "admin" &&
      (roleKey === "staff" || roleKey === "kasama")
    ) {
      identifier = roleEmails[roleKey] || "";
    }

    if (!identifier) {
      identifier = entry.admin || "Unknown";
    }

    return `${roleLabel}: ${identifier}`;
  };

  const formatNoteTimestamp = (value) => {
    if (!value) return "Just now";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Just now";
    return date.toLocaleString();
  };

  return (
    <div className="flex min-h-screen p-5 mt-14">
      <SideBar />
      <AdminNavbar />

      <div className="flex-1 ml-0 p-5 mt-10 lg:px-10 min-h-screen">       

        {/* Filters */}
        <div className="bg-white p-6 rounded-xl shadow-md mb-8 flex gap-5 flex-wrap mx-5">
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold text-[#800000] mb-2 text-sm">Search:</label>
            <input
              type="text"
              placeholder="Search by ID..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/10"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold text-[#800000] mb-2 text-sm">Category:</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/10"
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
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/10"
            >
              <option value="all">All</option>
              {STATUS_OPTIONS.map((statusValue) => (
                <option key={statusValue} value={statusValue}>
                  {formatStatusLabel(statusValue)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden mb-8 relative">
          <table className="w-full border-collapse">
            <thead className="bg-gradient-to-r from-[#8B1538]/8 to-[#a94922]/6 border-b-2 border-[#8B1538]/15">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-[0.85rem] text-[#621313] uppercase tracking-wide">ID</th>
                <th className="px-6 py-4 text-left font-bold text-[0.85rem] text-[#621313] uppercase tracking-wide">Category</th>
                <th className="px-6 py-4 text-left font-bold text-[0.85rem] text-[#621313] uppercase tracking-wide">Status</th>
                <th className="px-6 py-4 text-left font-bold text-[0.85rem] text-[#621313] uppercase tracking-wide">Date</th>
                <th className="px-6 py-4 text-left font-bold text-[0.85rem] text-[#621313] uppercase tracking-wide">Assigned To</th>
                <th className="px-6 py-4 text-left font-bold text-[0.85rem] text-[#621313] uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-[#999] italic">
                    No complaints found
                  </td>
                </tr>
              ) : (
                filteredComplaints.map((c) => {
                  const assignmentValue = getComplaintAssignmentValue(c);
                  const assignmentOptionExists = assignmentUsers.some(
                    (user) => getAssignmentValue(user.role, user.email) === assignmentValue
                  );
                  return (
                    <tr key={c.id} className="hover:bg-[#fef5f5] transition-colors">
                      <td className="px-3 py-3.5 text-[13px] text-[#333] font-semibold">{c.id}</td>
                      <td className="px-3 py-3.5 text-[13px] text-[#333]">{getCategoryLabel(c.category)}</td>
                      <td className="px-3 py-3.5 text-[13px] text-[#333]">
                        <span
                          className={`inline-block px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize cursor-pointer ${getStatusClass(c.status)}`}
                          onClick={() => openModalForStatusChange(c)}
                        >
                          {formatStatusLabel(c.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-[13px] text-[#333]">{formatDateTime(c.submissionDate)}</td>
                      <td className="px-3 py-3.5 text-[13px] text-[#333]">
                        <select
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-[13px] bg-white text-[#111827] focus:outline-none focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/15"
                          value={assignmentValue}
                          onChange={(e) => handleAssignSelectionChange(c, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {!assignmentOptionExists && assignmentValue && (
                            <option value={assignmentValue}>
                              {getAssignmentLabel(c.assignedRole, c.assignedTo)}
                            </option>
                          )}
                          {assignmentUsers.map((user) => {
                            const optionValue = getAssignmentValue(user.role, user.email);
                            return (
                              <option key={user.id} value={optionValue}>
                                {getAssignmentLabel(user.role, user.email)}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                      <td className="px-3 py-3.5 text-[13px] text-[#333]">
                        <button
                          className="bg-[#65b95e] text-white border-none px-3 py-1.5 rounded-[18px] cursor-pointer font-medium text-xs transition-all hover:bg-[#A84700] hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ml-[15px]"
                          onClick={() => openNoteModal(c)}
                          disabled={!currentUser}
                          title={
                            getSharedNote(c)
                              ? "Update the note for this complaint"
                              : "Add a note for this complaint"
                          }
                        >
                          {getSharedNote(c) ? "Update Note" : "Add Note"}
                        </button>
                        <button
                          className="bg-[#1094d0] text-white border-none px-3 py-1.5 rounded-[18px] cursor-pointer font-medium text-xs transition-all hover:bg-[#A84700] hover:-translate-y-0.5 hover:shadow-lg ml-2.5"
                          onClick={() => openModal(c)}
                          title="View the full complaint details"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {assignmentError && (
          <p className="text-[#b91c1c] text-[13px] mt-2">
            {assignmentError}
          </p>
        )}

        {showModal && selectedComplaint && (
          <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[1000] p-5 backdrop-blur-sm" onClick={closeModal}>
            <div className="bg-white rounded-2xl w-full max-w-[900px] max-h-[90vh] flex flex-col shadow-2xl animate-[modalSlideIn_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
              <div className="px-[30px] py-[25px] border-b-2 border-gray-200 flex justify-between items-start bg-gradient-to-r from-[#800000] to-[#600000] text-white rounded-t-2xl">
                <div>
                  <h3 className="m-0 text-xl font-bold text-white">Complaint #{selectedComplaint.id}</h3>
                  <p className="text-xs mt-1 opacity-90">
                    {
                      getCategoryLabel(selectedComplaint.category)}
                  </p>
                </div>
                <button className="text-white w-[30px] h-[30px] cursor-pointer flex items-center justify-center transition-all hover:bg-white/30 hover:rotate-90 hover:rounded-[20px] border-none text-lg" onClick={closeModal}>
                  ×
                </button>
              </div>

              <div className="flex bg-[#fafafa] p-0 border-b-2 border-gray-200">
                {visibleTabs.map((tabKey) => (
                  <button
                    key={tabKey}
                    className={`flex-1 px-5 py-4 bg-transparent border-none cursor-pointer font-medium text-sm text-[#666] transition-all border-b-[3px] border-transparent hover:bg-gray-100 hover:text-[#800000] ${
                      activeTab === tabKey ? "bg-white text-[#800000] border-b-[#800000] font-semibold" : ""
                    }`}
                    onClick={() => setActiveTab(tabKey)}
                  >
                    {TAB_LABELS[tabKey]}
                  </button>
                ))}
                
              </div>

              <div className="px-[30px] py-5 overflow-y-auto flex-1">
                {visibleTabs.includes("details") && activeTab === "details" && (
                  <div>{renderComplaintDetails()}</div>
                )}

                {visibleTabs.includes("feedback") && activeTab === "feedback" && (
                  <div>
                    <h4 className="text-[#800000] text-lg font-semibold m-0 mb-5 pb-2.5 border-b-2 border-gray-200">Feedback History</h4>
                    {!selectedComplaint.feedbackHistory ||
                    selectedComplaint.feedbackHistory.length === 0 ? (
                      <p className="text-center py-10 text-[#999] italic bg-[#fafafa] rounded-lg">No feedback shared yet.</p>
                    ) : (
                      <div className="mb-6">
                        {selectedComplaint.feedbackHistory.map((item, index) => (
                          <div className="bg-[#fafafa] p-4 rounded-lg mb-3 border-l-4 border-[#800000]" key={`${item.date || index}-${index}`}>
                            <div className="flex justify-between items-center mb-2.5">
                              <strong className="text-[#800000] text-sm">{getFeedbackSenderLabel(item)}</strong>
                              <span className="text-[#999] text-xs">
                                {item.date ? formatDateTime(item.date) : "Just now"}
                              </span>
                            </div>
                            <p className="text-[#333] text-sm m-0 leading-relaxed">{item.feedback}</p>
                            {item.files && item.files.length > 0 && (
                              <div className="flex gap-2 flex-wrap mt-2.5">
                                {item.files.map((file, fileIndex) => (
                                  <span className="inline-block px-2.5 py-1 bg-white border border-gray-200 rounded text-xs text-[#666]" key={`${file}-${fileIndex}`}>
                                    {file.name || file}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-white p-6 rounded-xl border-2 border-gray-200 mt-5">
                      <h4 className="text-[#800000] text-lg font-semibold m-0 mb-5 pb-2.5 border-b-2 border-gray-200">Send New Feedback</h4>
                      <textarea
                        rows="4"
                        placeholder="Write your feedback to the student..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        className="w-full px-[18px] py-[15px] border border-[#d0d0d0] rounded-xl text-[15px] text-[#333] resize-vertical shadow-sm transition-all mb-[15px] focus:outline-none focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/15"
                      ></textarea>

                      <div className="my-5">
                        <label className="inline-block px-5 py-2.5 bg-[#fef5f5] text-[#800000] border-2 border-dashed border-[#800000] rounded-lg cursor-pointer font-medium transition-all hover:bg-[#800000] hover:text-white">
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            onChange={handleFeedbackFileChange}
                            className="hidden"
                          />
                          📎 Attach Files
                        </label>
                        {feedbackFiles.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2.5">
                            {feedbackFiles.map((file, index) => (
                              <div className="flex items-center gap-2 px-3 py-2 bg-[#fafafa] border border-gray-200 rounded-md text-[13px]" key={`${file.name}-${index}`}>
                                <span>{file.name}</span>
                                <button type="button" onClick={() => handleRemoveFeedbackFile(index)} className="bg-[#800000] text-white border-none rounded-full w-5 h-5 cursor-pointer text-sm leading-none transition-all hover:bg-[#600000] hover:scale-110">
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button className="bg-[#800000] text-white border-none px-[18px] py-2.5 rounded-lg cursor-pointer font-normal text-sm transition-all mt-4 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#800000]/30" onClick={handleSendFeedbackPersist}>
                        Send Feedback
                      </button>
                    </div>
                  </div>
                )}

                {visibleTabs.includes("notes") && activeTab === "notes" && (
                  <div>
                    <h4 className="text-[#800000] text-lg font-semibold m-0 mb-5 pb-2.5 border-b-2 border-gray-200">Admin Notes (Private)</h4>
                    {!selectedComplaint.adminNotes || selectedComplaint.adminNotes.length === 0 ? (
                      <p className="text-center py-10 text-[#999] italic bg-[#fafafa] rounded-lg">No notes have been added.</p>
                    ) : (
                      <div className="mb-6">
                        {selectedComplaint.adminNotes.map((note) => (
                          <div className="bg-[#f8fafc] border border-gray-300 rounded-xl px-3.5 py-3" key={`${note.adminId}-${note.updatedAt}`}>
                            <div className="flex justify-between items-center text-xs text-[#475569] mb-1.5">
                              <span className="font-medium">
                                {note.adminName || "Unknown"} -{" "}
                                {note.adminRole ? note.adminRole.toUpperCase() : "ADMIN"}
                              </span>
                              <span>{formatNoteTimestamp(note.updatedAt)}</span>
                            </div>
                            <p className="m-0 text-sm text-[#1f2937]">{note.note}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <button className="bg-[#800000] text-white border-none px-[18px] py-2.5 rounded-lg cursor-pointer font-normal text-sm transition-colors mt-4 hover:bg-[#d1d5db]" onClick={() => openNoteModal(selectedComplaint)}>
                      {getSharedNote(selectedComplaint) ? "Update Note" : "Add Note"}
                    </button>
                  </div>
                )}

                {visibleTabs.includes("assign") && activeTab === "assign" && (
                  <div>
                    <h4 className="text-[#800000] text-lg font-semibold m-0 mb-5 pb-2.5 border-b-2 border-gray-200">Assignment</h4>
                    <div className="bg-[#e8f5e9] p-4 rounded-lg mb-5 border-l-4 border-[#4CAF50]">
                      <p className="m-0 text-[#333] text-sm">
                        <strong>Assigned Role:</strong> {
                          selectedComplaint.assignedRole
                            ? selectedComplaint.assignedRole.toUpperCase()
                            : "Unassigned"
                        }
                      </p>
                      <p className="m-0 text-[#333] text-sm mt-2">
                        <strong>Assigned To:</strong> {selectedComplaint.assignedTo || "Not yet assigned"}
                      </p>
                    </div>

                    <div className="bg-white p-6 rounded-xl border-2 border-gray-200 mt-5">
                      <div className="mb-5">
                        <label className="block font-semibold text-[#800000] mb-2 text-sm">Assign To:</label>
                        <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/10">
                          <option value="">Unassigned</option>
                          {!assignSelectionExists && assignTo && (
                            <option value={assignTo}>{getAssignmentLabelFromValue(assignTo)}</option>
                          )}
                          {assignmentUsers.map((user) => {
                            const optionValue = getAssignmentValue(user.role, user.email);
                            return (
                              <option key={user.id} value={optionValue}>
                                {getAssignmentLabel(user.role, user.email)}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="mb-5">
                        <label className="block font-semibold text-[#800000] mb-2 text-sm">Message/Instructions:</label>
                        <textarea
                          rows="3"
                          placeholder="Add context for the assignee (optional)"
                          value={assignMessage}
                          onChange={(e) => setAssignMessage(e.target.value)}
                          className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm resize-vertical transition-all focus:outline-none focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/10"
                        ></textarea>
                      </div>

                      {assignmentError && <p className="text-[#b91c1c] text-[13px] mb-3">{assignmentError}</p>}

                      <button className="bg-[#800000] text-white border-none px-[18px] py-2.5 rounded-lg cursor-pointer font-normal text-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#800000]/30" onClick={handleAssignComplaint}>
                        {selectedComplaint.assignedTo ? "Reassign" : "Assign"} Complaint
                      </button>
                    </div>
                  </div>
                )}

                {visibleTabs.includes("status") && activeTab === "status" && (
                  <div>
                    <h4 className="text-[#800000] text-lg font-semibold m-0 mb-5 pb-2.5 border-b-2 border-gray-200">Status Management</h4>

                    <div className="bg-[#fef5f5] p-5 rounded-lg mb-5 text-center">
                      <p className="m-0 mb-2.5 text-[#666] font-medium">
                        <strong>Current Status:</strong>
                      </p>
                      <span className={`inline-block px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize ${getStatusClass(selectedComplaint.status)}`}>
                        {formatStatusLabel(selectedComplaint.status)}
                      </span>
                    </div>

                    <div className="bg-white p-6 rounded-xl border-2 border-gray-200 mt-5">
                      <div className="mb-5">
                        <label className="block font-semibold text-[#800000] mb-2 text-sm">New Status:</label>
                        <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all focus:outline-none focus:border-[#800000] focus:ring-4 focus:ring-[#800000]/10">
                          {STATUS_OPTIONS.map((statusValue) => (
                            <option key={statusValue} value={statusValue}>
                              {formatStatusLabel(statusValue)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button className="bg-[#800000] text-white border-none px-[18px] py-2.5 rounded-lg cursor-pointer font-normal text-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#800000]/30" onClick={() => handleUpdateStatus(newStatus)}>
                        Update Status
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {noteModalComplaint && (
          <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[1000] p-5 backdrop-blur-sm" onClick={closeNoteModal}>
            <div className="bg-white rounded-2xl w-full max-w-[520px] max-h-[90vh] flex flex-col shadow-2xl animate-[modalSlideIn_0.3s_ease]" onClick={(e) => e.stopPropagation()}>
              <div className="px-[30px] py-[25px] border-b-2 border-gray-200 flex justify-between items-start bg-gradient-to-r from-[#800000] to-[#600000] text-white rounded-t-2xl">
                <h3 className="m-0 text-xl font-bold text-white">
                  {getSharedNote(noteModalComplaint) ? "Update" : "Add"} Note - {noteModalComplaint.id}
                </h3>
                <button className="text-white w-[30px] h-[30px] cursor-pointer flex items-center justify-center transition-all hover:bg-white/30 hover:rotate-90 hover:rounded-[20px] border-none text-lg" onClick={closeNoteModal}>
                  ×
                </button>
              </div>
              <div className="px-[30px] py-5 overflow-y-auto flex-1">
                <p className="text-[#6b7280] text-xs mb-3">
                  Notes are shared with admins and the assigned role ({noteRole?.toUpperCase()}).
                </p>
                <textarea
                  className="w-full min-h-[140px] border border-[#d1d5db] rounded-xl px-3.5 py-3 text-sm resize-vertical transition-all focus:border-[#800000] focus:ring-[3px] focus:ring-[#800000]/12 focus:outline-none"
                  placeholder="Write a quick update for this complaint..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                />
                {noteError && <p className="text-[#b91c1c] text-[13px] mt-2">{noteError}</p>}
              </div>
              <div className="flex justify-end gap-3 px-[30px] py-5 border-t border-gray-200">
                <button className="bg-[#800000] text-white border-none px-[18px] py-2.5 rounded-lg cursor-pointer font-normal text-sm transition-colors hover:bg-[#d1d5db] disabled:opacity-70 disabled:cursor-not-allowed" onClick={closeNoteModal} disabled={isSavingNote}>
                  Cancel
                </button>
                <button
                  className="bg-[#800000] text-white border-none px-[18px] py-2.5 rounded-lg cursor-pointer font-normal text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
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
    </div>
  );
};

export default AdminMonitorComplaints;