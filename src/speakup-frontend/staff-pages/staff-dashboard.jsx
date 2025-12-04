import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/authContext';
import { BarChart3, Users, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import StaffSideBar from './components/StaffSideBar';
import StaffNavBar from './components/StaffNavBar';
import UrgentComplaintsWidget from './components/urgency-level';

const StaffDashboard = () => {
  const { currentUser } = useAuth();
  const [roleLabel, setRoleLabel] = useState('Staff Role');
  const [staffRole, setStaffRole] = useState(null);
  const [staffEmail, setStaffEmail] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(null);

  useEffect(() => {
    try {
      const storedUserRaw = localStorage.getItem('user');
      const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;

      if (storedUser?.role) {
        setRoleLabel(storedUser.role);
        setStaffRole(storedUser.role.toLowerCase());
      } else if (currentUser?.role) {
        setRoleLabel(currentUser.role);
        setStaffRole(currentUser.role.toLowerCase());
      } else {
        setRoleLabel('Staff Role');
        setStaffRole('');
      }

      const resolvedEmail = (storedUser?.email || currentUser?.email || '')
        .trim()
        .toLowerCase();
      setStaffEmail(resolvedEmail);
    } catch (error) {
      console.error('Failed to parse stored user for role/email:', error);
      setRoleLabel('Staff Role');
      setStaffRole('');
      setStaffEmail('');
    }
  }, [currentUser]);

  useEffect(() => {
    if (staffRole === null || staffEmail === null) return;

    const fetchComplaintStats = async () => {
      setIsLoadingStats(true);

      const normalizedEmail = staffEmail.trim().toLowerCase();
      if (!normalizedEmail) {
        setStats({ total: 0, pending: 0, inProgress: 0, resolved: 0 });
        setStatsError('No staff email found. Please re-login.');
        setIsLoadingStats(false);
        return;
      }

      try {
        const snapshot = await getDocs(collection(db, 'complaints'));

        const filteredDocs = snapshot.docs.filter((doc) => {
          const data = doc.data() || {};
          const assignedRole = (data.assignedRole || '').toLowerCase().trim();
          const assignedTo = (data.assignedTo || '').toLowerCase().trim();
          

          if (staffRole) {
            return assignedRole === staffRole && assignedTo === normalizedEmail;
          }
          return assignedTo === normalizedEmail;
        });

        const counts = filteredDocs.reduce(
          (acc, doc) => {
            const data = doc.data() || {};
            const status = (data.status || '').toString().toLowerCase().trim();

            acc.total += 1;

            switch (status) {
              case 'pending':
                acc.pending += 1;
                break;
              case 'in-progress':
              case 'in progress':
                acc.inProgress += 1;
                break;
              case 'resolved':
              case 'closed':
                acc.resolved += 1;
                break;
              default:
                break;
            }

            return acc;
          },
          { total: 0, pending: 0, inProgress: 0, resolved: 0 }
        );

        setStats(counts);
        setStatsError(null);
      } catch (error) {
        console.error('Error fetching complaint stats:', error);
        setStats({ total: 0, pending: 0, inProgress: 0, resolved: 0 });
        setStatsError('Unable to load complaint stats right now.');
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchComplaintStats();
  }, [staffRole, staffEmail]);

  const formatStatValue = (value) => (isLoadingStats ? '...' : value);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <StaffSideBar />

      {/* Main Content */}
      <main className="flex-1 flex-1 p-4 mt-10 lg:mt-[90px] md:p-6 lg:p-12 transition-all duration-300transition-all duration-300 flex flex-col">
        <StaffNavBar />

        {/* Analytics Cards */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-6 p-4 sm:p-6 lg:p-10 pt-24 sm:mt-0">
          {/* Total Complaints Card */}
          <div className="bg-white p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.1)] flex items-center gap-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
            <div className="w-[60px] h-[60px] rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-[#800000] to-[#993333]">
              <FileText size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-3xl font-bold text-[#333333] mb-1">
                {formatStatValue(stats.total)}
              </h3>
              <p className="text-[#6c757d] text-sm">Total Complaints</p>
            </div>
          </div>

          {/* Pending Card */}
          <div className="bg-white p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.1)] flex items-center gap-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
            <div className="w-[60px] h-[60px] rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-[#ff6b6b] to-[#ff8787]">
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-3xl font-bold text-[#333333] mb-1">
                {formatStatValue(stats.pending)}
              </h3>
              <p className="text-[#6c757d] text-sm">Pending</p>
            </div>
          </div>

          {/* In Progress Card */}
          <div className="bg-white p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.1)] flex items-center gap-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
            <div className="w-[60px] h-[60px] rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-[#E6C200] to-[#FFD700]">
              <BarChart3 size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-3xl font-bold text-[#333333] mb-1">
                {formatStatValue(stats.inProgress)}
              </h3>
              <p className="text-[#6c757d] text-sm">In Progress</p>
            </div>
          </div>

          {/* Resolved Card */}
          <div className="bg-white p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.1)] flex items-center gap-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
            <div className="w-[60px] h-[60px] rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-[#28a745] to-[#34d058]">
              <CheckCircle size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-3xl font-bold text-[#333333] mb-1">
                {formatStatValue(stats.resolved)}
              </h3>
              <p className="text-[#6c757d] text-sm">Resolved & Closed</p>
            </div>
          </div>
        </div>

        {statsError && (
          <p className="text-[#b91c1c] mt-2 px-8">
            {statsError}
          </p>
        )}

        <div className="block w-full min-w-0">
          <UrgentComplaintsWidget
            staffRole={staffRole}
            staffEmail={staffEmail}
          />

        </div>
      </main>
    </div>
  );
};

export default StaffDashboard;