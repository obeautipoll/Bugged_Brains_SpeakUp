import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doSignOut } from "../../../firebase/auth";

const StaffSideBar = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

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
        navigate("/sdashboard");
        break;
      case "monitor":
        navigate("/smonitorcomplaints");
        break;
      case "notifications":
        navigate("/snotifications");
        break;
      default:
        console.error("Unknown navigation page:", page);
    }
  };

  // Helper function to combine class names
  const linkClasses = (path) => {
    const currentPath = window.location.pathname;
    const isActive = currentPath === path;
    
    const activeColor = 'bg-white/10 text-white border-l-4 border-[#DAA520]';
    const iconActiveColor = 'text-[#DAA520]';
    const iconDefaultColor = 'text-[#DAA520]/80';
    const hoverColor = 'hover:bg-white/5';
    
    return {
      li: `relative py-3 px-6 mx-4 my-2 rounded-lg cursor-pointer flex items-center gap-3 text-sm font-medium text-white/85 transition-all duration-200 ease-in-out border border-transparent tracking-tight ${hoverColor} hover:text-white ${isActive ? activeColor : ''}`,
      icon: `text-xl w-5 text-center transition-colors duration-150 ease-in-out ${isActive ? iconActiveColor : iconDefaultColor}`,
    };
  };

  // Special classes for the logout button
  const logoutClasses = () => {
    return {
      li: `mt-auto py-3 px-6 mx-4 my-2 rounded-lg cursor-pointer flex items-center gap-3 text-sm font-medium text-white/90 transition-all duration-200 ease-in-out border border-white/10 bg-white/5 tracking-tight hover:text-white hover:border-[#FF4500] hover:bg-red-500/15 hover:border-l-4 hover:border-red-500 group`,
      icon: 'text-xl w-5 text-center transition-colors duration-150 ease-in-out text-[#FF7F7F] group-hover:text-[#FF4500]'
    };
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-[100] p-2 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-white hover:bg-black/70 transition-all"
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
        className={`fixed left-0 top-0 h-screen w-[260px] bg-gradient-to-b from-[#1A253F] to-[#0F1629] border-r border-[#DAA520]/15 shadow-2xl shadow-black/40 z-50 transition-transform duration-300 ease-in-out overflow-y-auto font-[Poppins] ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full py-7">

          <div className="px-6 pb-4 border-b border-[#DAA520]/20 mb-3 flex flex-col items-center">
            
            {/* Horizontal Logo and Title Wrapper */}
            <div className="flex items-center justify-center space-x-0 mb-0"> 
                
                {/* Logo Image */}
                <img 
                    src="/speakup_logo.png" 
                    alt="SpeakUp Logo" 
                    className="w-16 h-16 object-contain"
                    onError={(e) => { 
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
                <h1 className="text-xl font-semibold bg-gradient-to-br from-[#FFD700] via-[#FFFFE0] to-white bg-clip-text text-transparent">
                  SpeakUp
                </h1> 
            </div>
            
            {/* First Line of Descriptive Text */}
            <p className="text-xs text-white/70 mt-1 mb-0 font-normal tracking-wide text-center">
                MSU-IIT Complaint System
            </p>
            
            {/* Second Line of Descriptive Text (Role) */}
            <p className="text-xs text-white/70 mt-0 mb-0 font-normal tracking-wide text-center"> 
                Staff
            </p>

          </div>

          
          {/* Sidebar Links */}
          <ul className="list-none p-0 m-0 flex flex-col flex-1">
            {/* Dashboard Link */}
            <li 
              className={linkClasses("/sdashboard").li}
              onClick={() => handleNavigation("dashboard")}
            >
              <i className={`fa-solid fa-gauge ${linkClasses("/sdashboard").icon}`}></i> Dashboard
            </li>

            {/* Monitor Complaints Link */}
            <li 
              className={linkClasses("/smonitorcomplaints").li}
              onClick={() => handleNavigation("monitor")}
            >
              <i className={`fa-solid fa-file-lines ${linkClasses("/smonitorcomplaints").icon}`}></i> Monitor Complaints
            </li>


            {/* Notifications Link */}
            <li 
              className={linkClasses("/snotifications").li}
              onClick={() => handleNavigation("notifications")}
            >
              <i className={`fa-solid fa-bell ${linkClasses("/snotifications").icon}`}></i> Notifications
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

        {/* Custom Scrollbar Styling */}
        <style>
          {`
            nav::-webkit-scrollbar {
              width: 5px;
            }
            nav::-webkit-scrollbar-track {
              background: rgba(0, 0, 0, 0.2);
              border-radius: 10px;
            }
            nav::-webkit-scrollbar-thumb {
              background: linear-gradient(180deg, #DAA520, #B8860B);
              border-radius: 10px;
            }
            nav::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(180deg, #FFD700, #DAA520);
            }
          `}
        </style>
      </nav>

      {/* Spacer for main content on desktop */}
      <div className="hidden lg:block w-[260px] flex-shrink-0"></div>
    </>
  );
};

export default StaffSideBar;