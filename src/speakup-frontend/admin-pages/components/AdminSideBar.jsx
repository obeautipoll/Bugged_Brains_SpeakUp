import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doSignOut } from "../../../firebase/auth";

const AdminSideBar = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState('admin'); // default to admin

  // Get user role from localStorage or context
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        setUserRole(userData.role?.toLowerCase() || 'admin');
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

  // Close sidebar on larger screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const clearSession = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const handleLogout = async () => {
    try {
      await doSignOut();
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      clearSession();
      navigate("/adminlogin", { replace: true });
    }
  };

  const handleNavigation = (page) => {
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }

    switch (page) {
      case "logout":
        handleLogout();
        break;
      case "dashboard":
        navigate("/adashboard");
        break;
      case "monitor":
        navigate("/amonitorcomplaints");
        break;
      case "users":
        navigate("/amanageusers");
        break;
      case "analytics":
        navigate("/aanalytics");
        break;
      case "notifications":
        navigate("/anotifications");
        break;
      default:
        console.error("Unknown navigation page:", page);
    }
  };

  // Role-based colors
  const roleColors = {
    admin: {
      gradient: 'from-[#5C0A0A] to-[#3D0606]',
      border: 'border-yellow-600/15',
      accent: 'yellow',
      accentRgb: '250, 204, 21'
    },
    staff: {
      gradient: 'from-[#0A1B5C] to-[#06183D]',
      border: 'border-blue-400/15',
      accent: 'blue',
      accentRgb: '96, 165, 250'
    },
    kasama: {
      gradient: 'from-[#0A1B5C] to-[#06183D]',
      border: 'border-blue-400/15',
      accent: 'blue',
      accentRgb: '96, 165, 250'
    }
  };

  const colors = roleColors[userRole] || roleColors.admin;
  
  // Check if user can see user management (only admin)
  const canManageUsers = userRole === 'admin';

  // Helper function to combine class names
  const linkClasses = (path) => {
    const currentPath = window.location.pathname;
    const isActive = currentPath === path;
    
    const activeColor = (userRole === 'staff' || userRole === 'kasama') ? 'bg-blue-500/10 text-white border-l-4 border-blue-400' : 'bg-yellow-600/10 text-white border-l-4 border-yellow-600';
    const iconActiveColor = (userRole === 'staff' || userRole === 'kasama') ? 'text-blue-400' : 'text-yellow-500';
    const iconDefaultColor = (userRole === 'staff' || userRole === 'kasama') ? 'text-blue-400/80' : 'text-yellow-600/80';
    const hoverColor = (userRole === 'staff' || userRole === 'kasama') ? 'hover:bg-blue-500/10' : 'hover:bg-yellow-600/10';
    
    return {
      li: `relative py-3 px-6 mx-4 my-2 rounded-lg cursor-pointer flex items-center gap-3 text-sm font-medium text-white/85 transition-all duration-200 ease-in-out border border-transparent tracking-tight ${hoverColor} hover:text-white ${isActive ? activeColor : ''}`,
      icon: `text-xl w-5 text-center transition-colors duration-150 ease-in-out ${isActive ? iconActiveColor : iconDefaultColor}`,
    };
  };

  // Special classes for the logout button
  const logoutClasses = () => {
    const borderColor = (userRole === 'staff' || userRole === 'kasama') ? 'border-blue-400/25' : 'border-yellow-600/25';
    const hoverBorder = (userRole === 'staff' || userRole === 'kasama') ? 'hover:border-red-500/50' : 'hover:border-red-500/50';
    
    return {
      li: `mt-auto py-3 px-6 mx-4 my-2 rounded-lg cursor-pointer flex items-center gap-3 text-sm font-medium text-white/90 transition-all duration-200 ease-in-out border ${borderColor} bg-black/15 tracking-tight hover:text-white ${hoverBorder} hover:bg-red-500/10 hover:border-l-4 hover:border-red-500/60 group`,
      icon: 'text-xl w-5 text-center transition-colors duration-150 ease-in-out text-red-400/85 group-hover:text-red-400'
    };
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-[100] p-2 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-white hover:bg-black/70 transition-all" // CHANGED z-[60] to z-[100]
        aria-label="Toggle sidebar"
      >
        <i className={`fa-solid ${isOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <nav 
        className={`fixed left-0 top-0 h-screen w-[260px] bg-gradient-to-b ${colors.gradient} border-r ${colors.border} shadow-2xl shadow-black/40 z-50 transition-transform duration-300 ease-in-out overflow-y-auto font-[Poppins] ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full py-7">

      <div className="px-6 pb-4 border-b border-opacity-20 mb-3 flex flex-col items-center" style={{ borderColor: `rgba(${colors.accentRgb}, 0.2)` }}>
        
        {/* === NEW: Horizontal Logo and Title Wrapper === */}
        <div className="flex items-center justify-center space-x-0 mb-0"> 
            
            {/* Logo Image (Reduced size for inline display) */}
            <img 
                src="/speakup_logo.png" 
                alt="SpeakUp Logo" 
                className="w-16 h-16 object-contain" // Smaller size (2rem x 2rem) for inline display

                onError={(e) => { 
                    // Fallback logic remains unchanged
                    if (e.target.src.endsWith('.png')) {
                        e.target.src = '/speakup_logo.svg';
                    } else if (e.target.src.endsWith('.svg')) {
                        e.target.src = '/speakup_logo.jpg';
                    } else {
                        e.target.style.display = 'none';
                    }
                }} 
            />
            
            {/* SpeakUp Title */}
            <h1 className="text-xl font-semibold text-white">SpeakUp</h1> 
        </div>
        
        {/* First Line of Descriptive Text */}
        <p className="text-xs text-white/70 mt-1 mb-0 font-normal tracking-wide text-center">
            My.IIT Complaint System
        </p>
        
        {/* Second Line of Descriptive Text (Role) */}
        <p className="text-xs text-white/70 mt-0 mb-0 font-normal tracking-wide text-center"> 
            {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
        </p>

    </div>

          
          {/* Sidebar Links */}
          <ul className="list-none p-0 m-0 flex flex-col flex-1">
            {/* Dashboard Link */}
            <li 
              className={linkClasses("/adashboard").li}
              onClick={() => handleNavigation("dashboard")}
            >
              <i className={`fa-solid fa-gauge ${linkClasses("/adashboard").icon}`}></i> Dashboard
            </li>

            {/* Monitor Complaints Link */}
            <li 
              className={linkClasses("/amonitorcomplaints").li}
              onClick={() => handleNavigation("monitor")}
            >
              <i className={`fa-solid fa-file-lines ${linkClasses("/amonitorcomplaints").icon}`}></i> Monitor Complaints
            </li>

            {/* User Management Link */}
            <li 
              className={linkClasses("/amanageusers").li}
              onClick={() => handleNavigation("users")}
            >
              <i className={`fa-solid fa-users ${linkClasses("/amanageusers").icon}`}></i> User Management
            </li>

            {/* Reports & Analytics Link */}
            <li 
              className={linkClasses("/aanalytics").li}
              onClick={() => handleNavigation("analytics")}
            >
              <i className={`fa-solid fa-chart-bar ${linkClasses("/aanalytics").icon}`}></i> Reports & Analytics
            </li>

            {/* Notifications Link */}
            <li 
              className={linkClasses("/anotifications").li}
              onClick={() => handleNavigation("notifications")}
            >
              <i className={`fa-solid fa-bell ${linkClasses("/anotifications").icon}`}></i> Notifications
            </li>

            {/* Logout Link */}
            <li
              className={logoutClasses().li}
              onClick={() => {
                const confirmLogout = window.confirm("Are you sure you want to log out?");
                if (confirmLogout) {
                  handleNavigation("logout");
                }
              }}
            >
              <i className={`fa-solid fa-right-from-bracket ${logoutClasses().icon}`}></i> Logout
            </li>
          </ul>
        </div>
      </nav>

      {/* Spacer for main content on desktop */}
      <div className="hidden lg:block w-[260px] flex-shrink-0"></div>
    </>
  );
};

export default AdminSideBar;