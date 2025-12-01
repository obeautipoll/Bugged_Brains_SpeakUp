import React, { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import AdminSideBar from "./components/AdminSideBar";
import AdminNavbar from "./components/AdminNavBar";
import { db, firebaseConfig } from "../../firebase/firebase";
import { getAuth, createUserWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";

// --- START: Role Constants & Secondary Auth Setup ---
const ROLE_OPTIONS = [
  { value: "staff", label: "Staff" },
  { value: "kasama", label: "KASAMA" },
];

const ALLOWED_ROLES = ROLE_OPTIONS.map((role) => role.value);

const getSecondaryStaffAuth = (() => {
  let cachedAuth = null;
  return () => {
    if (cachedAuth) return cachedAuth;
    const appName = "StaffCreationApp";
    const existingApp = getApps().find((application) => application.name === appName);
    const staffApp = existingApp || initializeApp(firebaseConfig, appName);
    cachedAuth = getAuth(staffApp);
    return cachedAuth;
  };
})();
// --- END: Role Constants & Secondary Auth Setup ---

// --- START: Helper Functions ---
const deleteAuthAccount = async (uid) => {
  if (!uid) {
    throw new Error("Missing target account.");
  }

  const apiKey = firebaseConfig?.apiKey;
  const projectId = firebaseConfig?.projectId;
  if (!apiKey || !projectId) {
    throw new Error("Authentication configuration is incomplete.");
  }

  const endpoint = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ localId: uid }),
  });

  if (response.ok) {
    return;
  }

  let details = null;
  try {
    details = await response.json();
  } catch {
    // ignore parse errors
  }

  if (details?.error?.message === "USER_NOT_FOUND") {
    return;
  }

  throw new Error(details?.error?.message || "Failed to remove authentication record.");
};

const formatDate = (value) => {
  if (!value) return "Not set";
  
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().toLocaleDateString();
    } catch {
      return "Invalid date";
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Invalid date" : parsed.toLocaleDateString();
};
// --- END: Helper Functions ---

// --- START: RegisteredAccountsTable Component ---
const RegisteredAccountsTable = ({
  accounts = [],
  isLoading = false,
  error = null,
}) => {
  const renderStatus = () => {
    if (isLoading) {
      return (
        <p className="text-sm text-gray-500">
          Loading registered users...
        </p>
      );
    }

    if (error) {
      return (
        <p className="text-sm text-red-600">
          {error}
        </p>
      );
    }

    return (
      <p className="text-sm text-gray-500">
        Total registered student accounts: <span className="font-bold text-green-600 text-lg">{accounts.length}</span>
      </p>
    );
  };

  const renderTableBody = () => {
    if (isLoading) {
      return (
        <tr>
          <td colSpan="4" className="px-6 py-5 text-center text-gray-600">
            Loading...
          </td>
        </tr>
      );
    }

    if (error) {
      return (
        <tr>
          <td colSpan="4" className="px-6 py-5 text-center text-red-600">
            {error}
          </td>
        </tr>
      );
    }

    if (accounts.length === 0) {
      return (
        <tr>
          <td colSpan="4" className="px-8 py-12 text-center">
            <div className="flex flex-col items-center bg-gradient-to-br from-white/95 to-green-50/95 backdrop-blur-sm rounded-[20px] border-2 border-dashed border-green-600/30 shadow-lg shadow-green-600/8 p-12">
              <span className="text-6xl mb-4 opacity-30">📋</span>
              <span className="text-gray-400 text-base italic">No registered accounts found.</span>
            </div>
          </td>
        </tr>
      );
    }

    return accounts.map((account) => (
      <tr key={account.id} className="border-b border-green-600/10 transition-all duration-250 bg-white/60 hover:bg-gradient-to-br hover:from-green-50/90 hover:to-green-100/90 hover:shadow-md hover:shadow-green-600/10">
        <td className="px-6 py-5 text-sm text-gray-500 font-semibold font-mono" title={account.id || 'No ID'}>
          {account.id ? `${account.id.substring(0, 8)}...` : 'N/A'}
        </td>
        <td className="px-6 py-5 text-sm text-gray-800 font-semibold">
          {account.email || 'No email'}
        </td>
        <td className="px-6 py-5 text-sm">
          <span
            className={`inline-block px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-md ${
              (account.role || 'unassigned').toLowerCase() === 'student'
                ? 'bg-gradient-to-br from-green-600 to-green-700 text-white'
                : 'bg-gradient-to-br from-gray-400 to-gray-500 text-white'
            }`}
          >
            {account.role || 'Unassigned'}
          </span>
        </td>
        <td className="px-6 py-5 text-sm text-gray-500">
          {formatDate(account.createdAt)}
        </td>
      </tr>
    ));
  };

  return (
    <div className="mt-12">
      <div className="mb-6">
        {renderStatus()}
      </div>

      <div className="bg-gradient-to-br from-white/98 to-green-50/98 backdrop-blur-sm rounded-[30px] shadow-lg shadow-green-600/12 border border-green-600/15 overflow-visible relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:rounded-t-[50px] before:bg-gradient-to-r before:from-green-800 before:via-green-400 before:to-green-500">
        <table className="w-full border-collapse">
          <thead className="bg-gradient-to-br from-green-600/8 to-green-200/5 border-b-2 border-green-600/20">
            <tr>
              <th className="px-6 py-5 text-left text-xs font-bold text-green-800 uppercase tracking-wider whitespace-nowrap">User ID</th>
              <th className="px-6 py-5 text-left text-xs font-bold text-green-800 uppercase tracking-wider whitespace-nowrap">Email</th>
              <th className="px-6 py-5 text-left text-xs font-bold text-green-800 uppercase tracking-wider whitespace-nowrap">Role</th>
              <th className="px-6 py-5 text-left text-xs font-bold text-green-800 uppercase tracking-wider whitespace-nowrap">Date Created</th>
            </tr>
          </thead>
          <tbody>{renderTableBody()}</tbody>
        </table>
      </div>
    </div>
  );
};
// --- END: RegisteredAccountsTable Component ---

const AdminUserManage = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    office: "",
    role: "staff",
    password: "",
    confirmPassword: "",
  });
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [formError, setFormError] = useState("");

  const [deletingUserId, setDeletingUserId] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(usersQuery);
        const fetched = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));
        setUsers(fetched);
        setError(null);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Unable to load user list right now.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    if (isCreateModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isCreateModalOpen]);

  const managedUsers = useMemo(
    () => users.filter((user) => ALLOWED_ROLES.includes((user.role || "").toLowerCase())),
    [users]
  );

  const registeredStudents = useMemo(
    () => users.filter((user) => (user.role || "").toLowerCase() === "student"),
    [users]
  );

  const handleRoleChange = async (userId, newRole) => {
    try {
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, role: newRole } : user))
      );
      await updateDoc(doc(db, "users", userId), { role: newRole });
    } catch (err) {
      console.error("Failed to update role:", err);
      setError("Unable to update role right now.");
    }
  };

  const handleDeleteUser = async (userId) => {
    const confirmed = window.confirm("Delete this staff profile? This action cannot be undone.");
    if (!confirmed) return;

    try {
      setDeletingUserId(userId);
      await deleteAuthAccount(userId);
      await deleteDoc(doc(db, "users", userId));
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (err) {
      console.error("Failed to delete user:", err);
      setError("Unable to delete user right now.");
    } finally {
      setDeletingUserId(null);
    }
  };

  const openCreateModal = () => {
    setCreateForm({
      fullName: "",
      email: "",
      office: "",
      role: "staff",
      password: "",
      confirmPassword: "",
    });
    setFormError("");
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (isSavingUser) return;
    setIsCreateModalOpen(false);
  };

  const handleCreateInputChange = (field, value) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateStaff = async () => {
    setFormError("");

    if (!createForm.fullName.trim() || !createForm.email.trim()) {
      setFormError("Full name and email are required.");
      return;
    }

    if (createForm.password.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }

    if (createForm.password !== createForm.confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setIsSavingUser(true);
    let secondaryAuthInstance = null;
    try {
      secondaryAuthInstance = getSecondaryStaffAuth();
      const normalizedEmail = createForm.email.trim().toLowerCase();

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuthInstance,
        normalizedEmail,
        createForm.password
      );

      const payload = {
        name: createForm.fullName.trim(),
        email: normalizedEmail,
        office: createForm.office.trim(),
        role: createForm.role,
        createdAt: new Date(),
      };

      await setDoc(doc(db, "users", userCredential.user.uid), payload);
      setUsers((prev) => [{ id: userCredential.user.uid, ...payload }, ...prev]);
      closeCreateModal();

    } catch (err) {
      console.error("Failed to create staff profile:", err);
      setFormError("Unable to create staff profile right now.");
    } finally {
      if (secondaryAuthInstance) {
        await firebaseSignOut(secondaryAuthInstance).catch(() => {});
      }
      setIsSavingUser(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans relative">
      <AdminSideBar />
      <AdminNavbar />

      <div className="flex-1 ml-0 mt-[90px] px-12 py-8 max-w-[1300px] relative z-[1]">
        <div className="flex justify-between items-start mb-4 gap-6 pb-2">
          <p className="text-sm text-gray-600 leading-relaxed flex-1 font-normal">
            Manage staff and KASAMA user access without requiring an authentication onboarding flow.
          </p>
        <button 
            className="px-6 py-3 bg-gradient-to-br from-[#8B1538] to-[#621313] text-white border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap shadow-md hover:translate-y-[-2px] hover:shadow-xl hover:shadow-[#8B1538]/25 hover:from-[#a01d47] hover:to-[#751818] active:translate-y-0"
            onClick={openCreateModal}
          >
            + Create Staff
          </button>
        </div>

        {error && (
          <p className="text-red-600 text-sm px-5 py-4 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-600 rounded-lg mb-6 shadow-sm font-medium">
            {error}
          </p>
        )}

        {/* --- STAFF/KASAMA MANAGEMENT TABLE --- */}
        <h4 className="text-base font-semibold text-gray-800 mb-3 mt-4">Staff & KASAMA Accounts</h4>
        {isLoading ? (
          <p className="text-gray-600">Loading users...</p>
        ) : managedUsers.length === 0 ? (
          <div className="text-center px-8 py-12 bg-white rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 text-sm shadow-sm">
            No staff or KASAMA accounts configured.
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-auto mb-8 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:from-[#8B1538] before:via-[#a94922] before:to-[#2563eb]">
            <table className="w-full border-collapse">
              <thead className="bg-gradient-to-br from-[#8B1538]/8 to-[#a94922]/6 border-b-2 border-[#8B1538]/15">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#621313] uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#621313] uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#621313] uppercase tracking-wider">Organization/Office</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#621313] uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-[#621313] uppercase tracking-wider">Date Added</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-[#621313] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {managedUsers.map((user) => (
                  <tr 
                    key={user.id} 
                    className="border-b border-gray-200/80 transition-all duration-250 bg-white hover:bg-gradient-to-br hover:from-slate-50/80 hover:to-slate-100/80 hover:shadow-sm last:border-b-0"
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium align-middle">
                      {user.name || "No name"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-normal align-middle">
                      {user.email || "No email"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium align-middle">
                      {user.office || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm align-middle">
                      <select
                        value={(user.role || "staff").toLowerCase()}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="px-4 py-2 text-xs text-gray-900 border-[1.5px] border-gray-300 rounded-lg bg-white cursor-pointer transition-all duration-200 min-w-[150px] font-medium shadow-sm hover:border-[#8B1538] hover:shadow-md focus:outline-none focus:border-[#8B1538] focus:shadow-[0_0_0_3px_rgba(139,21,56,0.1)]"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium align-middle">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right align-middle">
                      <button
                        className="px-5 py-2 border-none rounded-lg text-xs font-semibold cursor-pointer shadow-sm bg-white text-red-600 border-[1.5px] border-gray-300 transition-all duration-200 hover:bg-gradient-to-br hover:from-red-50 hover:to-red-100 hover:border-red-600 hover:shadow-md hover:shadow-red-600/15 hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={deletingUserId === user.id}
                      >
                        {deletingUserId === user.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* --- REGISTERED STUDENTS TABLE --- */}
        <section className="mt-4">
          <RegisteredAccountsTable
            accounts={registeredStudents}
            isLoading={isLoading}
            error={error}
          />
        </section>
      </div>

      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 flex justify-center items-start bg-black/60 backdrop-blur-sm z-[1000] overflow-hidden"
          onClick={closeCreateModal}
        >
          <div 
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-200 mt-4 p-8 relative before:content-[''] before:absolute before:top-0 before:left-0 before:w-full before:h-1.5 before:bg-gradient-to-r before:from-[#8B1538] before:to-[#2563eb] before:rounded-t-2xl before:pointer-events-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-xl font-bold text-gray-900 mb-0 tracking-tight">
              Create Staff Profile
            </h4>
            <p className="text-sm text-gray-600 mt-2 mb-6 leading-normal">
              Provide the staff member's contact information.
            </p>
            <div className="space-y-5">
              <label className="block">
                <span className="block mb-2 text-xs font-semibold text-gray-900">Full Name</span>
                <input
                  type="text"
                  value={createForm.fullName}
                  onChange={(e) => handleCreateInputChange("fullName", e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="w-full px-4 py-3 mt-2 text-sm border-[1.5px] border-gray-300 rounded-lg transition-all duration-200 bg-white shadow-sm hover:border-gray-400 focus:outline-none focus:border-[#8B1538] focus:shadow-[0_0_0_3px_rgba(139,21,56,0.1)]"
                />
              </label>
              <label className="block">
                <span className="block mb-2 text-xs font-semibold text-gray-900">Email</span>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => handleCreateInputChange("email", e.target.value)}
                  placeholder="staff@example.com"
                  className="w-full px-4 py-3 mt-2 text-sm border-[1.5px] border-gray-300 rounded-lg transition-all duration-200 bg-white shadow-sm hover:border-gray-400 focus:outline-none focus:border-[#8B1538] focus:shadow-[0_0_0_3px_rgba(139,21,56,0.1)]"
                />
              </label>
              <label className="block">
                <span className="block mb-2 text-xs font-semibold text-gray-900">Organization / Office</span>
                <input
                  type="text"
                  value={createForm.office}
                  onChange={(e) => handleCreateInputChange("office", e.target.value)}
                  placeholder="Enter organization or office"
                  className="w-full px-4 py-3 mt-2 text-sm border-[1.5px] border-gray-300 rounded-lg transition-all duration-200 bg-white shadow-sm hover:border-gray-400 focus:outline-none focus:border-[#8B1538] focus:shadow-[0_0_0_3px_rgba(139,21,56,0.1)]"
                />
              </label>
              <label className="block">
                <span className="block mb-2 text-xs font-semibold text-gray-900">Role</span>
                <select
                  value={createForm.role}
                  onChange={(e) => handleCreateInputChange("role", e.target.value)}
                  className="w-full px-4 py-3 mt-2 text-sm border-[1.5px] border-gray-300 rounded-lg transition-all duration-200 bg-white shadow-sm hover:border-gray-400 focus:outline-none focus:border-[#8B1538] focus:shadow-[0_0_0_3px_rgba(139,21,56,0.1)]"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block mb-2 text-xs font-semibold text-gray-900">Password</span>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => handleCreateInputChange("password", e.target.value)}
                  placeholder="Enter at least 6 characters"
                  className="w-full px-4 py-3 mt-2 text-sm border-[1.5px] border-gray-300 rounded-lg transition-all duration-200 bg-white shadow-sm hover:border-gray-400 focus:outline-none focus:border-[#8B1538] focus:shadow-[0_0_0_3px_rgba(139,21,56,0.1)]"
                />
              </label>
              <label className="block">
                <span className="block mb-2 text-xs font-semibold text-gray-900">Confirm Password</span>
                <input
                  type="password"
                  value={createForm.confirmPassword}
                  onChange={(e) => handleCreateInputChange("confirmPassword", e.target.value)}
                  placeholder="Re-enter the password"
                  className="w-full px-4 py-3 mt-2 text-sm border-[1.5px] border-gray-300 rounded-lg transition-all duration-200 bg-white shadow-sm hover:border-gray-400 focus:outline-none focus:border-[#8B1538] focus:shadow-[0_0_0_3px_rgba(139,21,56,0.1)]"
                />
              </label>
              {formError && (
                <p className="text-red-600 text-sm px-5 py-4 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-600 rounded-lg shadow-sm font-medium">
                  {formError}
                </p>
              )}
              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-gray-200">
                <button 
                  onClick={handleCreateStaff}
                  className="min-w-[100px] px-4 py-2 border-none rounded-lg text-xs font-semibold cursor-pointer shadow-sm bg-gradient-to-br from-green-700 to-green-600 text-white hover:shadow-md hover:shadow-green-700/25 hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
                  disabled={isSavingUser}
                >
                  {isSavingUser ? "Creating..." : "Create Staff"}
                </button>
                <button 
                  onClick={closeCreateModal}
                  className="min-w-[100px] px-4 py-2 border-none rounded-lg text-xs font-semibold cursor-pointer shadow-sm bg-slate-100 text-gray-900 border-[1.5px] border-gray-300 hover:bg-slate-200 hover:border-gray-400 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSavingUser}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManage;