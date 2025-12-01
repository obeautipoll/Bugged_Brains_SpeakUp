import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/authContext';
import { useAdminNotifications } from '../../../hooks/useAdminNotifications';
import { doSignOut } from "../../../firebase/auth";
import "@fortawesome/fontawesome-free/css/all.min.css";

const AdminNavbar = () => {
    const { currentUser, userRole } = useAuth(); 
    const location = useLocation();
    const navigate = useNavigate();
    const userName = currentUser ? currentUser.displayName || currentUser.email.split('@')[0] : "LoL";
    const userInitials = userName
        .split(' ') // Split the string by spaces (e.g., "Marhamah Ali" -> ["Marhamah", "Ali"])
        .map(n => n[0]) // Take the first letter of each word (e.g., ["M", "A"])
        .join('') // Join the letters together (e.g., "MA")
        .toUpperCase(); // Ensure they are uppercase
    const { unreadCount: unreadNotifications } = useAdminNotifications();

    // --- State for Dropdown and Modal ---
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    // Reference to the profile pill div to close the menu when clicking outside
    const menuRef = useRef(null);
    
    // --- Helper Functions ---

    // Determine the greeting based on time of day (Mock for display)
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    // Determine the page title based on the current URL path
    const getPageTitle = (path) => {
        // Strip leading/trailing slashes and normalize the path
        const normalizedPath = path.toLowerCase().replace(/^\/|\/$/g, '');
        
        switch (normalizedPath) {
            case "adashboard":
                return "Dashboard";
            case "amonitorcomplaints":
                return "Monitor Student Complaints";
            case "amanageusers":
                return "User Management";
            case "aanalytics":
                return "Reports & Analytics";
            case "anotifications":
                return "Notifications";
            case "asettings":
                return "Settings";
            case "login":
                return "Login"; // Should typically not see the navbar here, but included for completeness
            default:
                // Handle cases like nested routes (e.g., /history/123)
                if (normalizedPath.startsWith('adashboard/')) {
                    return "Complaint Details"; 
                }
                return "";
        }
    };

    // 1. Toggle the dropdown menu
    const handleProfileClick = () => {
        setIsDropdownOpen(prev => !prev);
    };

    // 2. Handle Logout
    const handleLogout = async () => {
        try {
            await doSignOut(); // Your Firebase sign-out function
            navigate('/adminlogin'); // Redirect to login page
        } catch (error) {
            console.error("Logout failed:", error);
            // Optionally show an error message
        }
    };
    
    // 3. Handle About Modal
    const handleOpenAboutModal = () => {
        setIsDropdownOpen(false); // Close dropdown first
        setIsAboutModalOpen(true); // Open the modal
    };

    // 4. Close modal
    const handleCloseAboutModal = () => {
        setIsAboutModalOpen(false);
    };
    
    // --- Outside Click Listener Effect ---
    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        }
        // Bind the event listener
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            // Unbind the event listener on cleanup
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuRef]);

    // Handler for the primary button click
    const handleFileComplaint = () => {
        navigate("/admin-monitoring"); 
    };

    // Handler for the notification bell
    const handleNotifications = () => {
        navigate("/anotifications"); 
    };

    // --- Render ---

    return (
        <>
            {/* Main Navbar */}
            <nav className="fixed top-0 left-0 lg:left-64 right-0 h-20 lg:h-[90px] z-[999] 
                bg-gradient-to-br from-white/95 to-orange-50/95 backdrop-blur-xl
                border-b-2 border-red-900/10 shadow-lg shadow-red-900/5
                transition-all duration-300 hover:shadow-xl hover:shadow-red-900/10 ml-1.5">
                
                <div className="h-full px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-4">
                    
                    {/* Left: Page Title Group */}
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-slate-500 tracking-wide
                            transition-colors duration-300 -mb-1">
                            {getGreeting()}, {userRole || "Admin"} {userName}!
                        </p>
                        <h1 className="text-xl sm:text-2xl lg:text-[1.875rem] font-extrabold 
                            bg-gradient-to-r from-red-900 via-red-600 to-red-500 
                            bg-clip-text text-transparent tracking-tight truncate
                            drop-shadow-sm leading-tight">
                            {getPageTitle(location.pathname)}
                        </h1>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
                        
                        {/* Notification Bell */}
                        <button 
                            onClick={handleNotifications}
                            className="relative w-11 h-11 sm:w-12 sm:h-12 lg:w-[50px] lg:h-[50px] rounded-full 
                                bg-gradient-to-br from-red-900/8 to-red-900/6
                                border-[1.5px] border-red-900/15 
                                flex items-center justify-center
                                text-red-900 text-lg sm:text-xl lg:text-[1.3rem]
                                transition-all duration-300 
                                hover:bg-red-900/15 hover:border-red-900/30 
                                hover:scale-110 hover:-translate-y-0.5
                                active:scale-95 active:translate-y-0
                                shadow-sm hover:shadow-md hover:shadow-red-900/20
                                group"
                            aria-label={`You have ${unreadNotifications} unread notifications`}>
                            <i className="fas fa-bell transition-transform duration-300 
                                group-hover:scale-110 group-hover:animate-[bellRing_0.5s_ease]"></i>
                            {unreadNotifications > 0 && (
                                <span className="absolute top-0.5 right-0.5 
                                    bg-gradient-to-br from-red-500 via-red-600 to-red-700
                                    text-white text-[0.67rem] font-semibold
                                    min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center
                                    shadow-lg shadow-red-500/50
                                    animate-[pulseGlow_2s_ease-in-out_infinite]
                                    ring-1 ring-white">
                                    {unreadNotifications}
                                </span>
                            )}
                        </button>

                        {/* User Profile Pill - Desktop */}
                        <div 
                            ref={menuRef}
                            onClick={handleProfileClick}
                            className="hidden sm:flex items-center gap-2 lg:gap-3.5 
                                px-3 lg:px-5 py-2 lg:py-2.5 rounded-full
                                bg-gradient-to-br from-red-900/6 to-red-900/4
                                border-[1.5px] border-red-900/12
                                transition-all duration-300 cursor-pointer
                                hover:bg-red-900/12 hover:border-red-900/25
                                hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-900/15
                                active:translate-y-0 active:scale-[0.98]
                                relative group shadow-sm">
                            
                            <div className="flex flex-col items-end gap-0 min-w-0">
                                <span className="text-sm lg:text-[0.975rem] font-semibold text-slate-800 
                                    truncate max-w-[100px] lg:max-w-[150px] leading-tight
                                    transition-colors duration-300 group-hover:text-red-900">
                                    {userName}
                                </span>
                                <span className="text-xs lg:text-[0.75rem] font-medium text-slate-500
                                    transition-colors duration-300 group-hover:text-red-900">
                                    {userRole || "Admin"}
                                </span>
                            </div>
                            
                            <div className="w-10 h-10 lg:w-[46px] lg:h-[46px] rounded-full
                                bg-gradient-to-br from-yellow-400 to-yellow-500
                                text-red-900 font-extrabold text-sm lg:text-[1.05rem]
                                flex items-center justify-center
                                border-[3px] border-white shadow-lg shadow-yellow-400/30
                                transition-all duration-300
                                group-hover:scale-110 group-hover:rotate-[5deg]
                                relative overflow-hidden">
                                <span className="relative z-10">{userInitials}</span>
                                <div className="absolute inset-[-3px] bg-gradient-to-br from-yellow-400 to-red-900 
                                    rounded-full opacity-0 group-hover:opacity-15 transition-opacity duration-300 -z-10"></div>
                            </div>
                            
                            <i className={`fas fa-caret-down text-[0.85rem] text-red-900 ml-1
                                transition-all duration-300 
                                ${isDropdownOpen ? 'rotate-180 text-red-600' : ''}`}></i>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="absolute top-[calc(100%+12px)] right-0 min-w-[220px]
                                    bg-white rounded-2xl shadow-2xl 
                                    border border-slate-100/50
                                    overflow-hidden
                                    animate-[slideDown_0.3s_ease-out]
                                    z-[100]
                                    py-2">
                                    
                                    {/* Arrow */}
                                    <div className="absolute -top-1.5 right-6 w-3 h-3 
                                        bg-white border-l border-t border-slate-100/50
                                        rotate-45 shadow-sm"></div>
                                    
                                    
                                    
                                    <div className="my-1 border-t border-slate-100/80"></div>
                                    
                                    <button 
                                        onClick={handleLogout}
                                        className="w-full px-5 py-3.5 flex items-center gap-3.5
                                            text-red-600 font-semibold text-[0.925rem]
                                            transition-all duration-200
                                            hover:bg-gradient-to-r hover:from-red-50 hover:to-red-50/50
                                            hover:text-red-900 hover:pl-6
                                            relative overflow-hidden group
                                            mt-1">
                                        <div className="absolute left-0 top-0 bottom-0 w-[3px] 
                                            bg-gradient-to-b from-red-600 to-red-900
                                            transform scale-y-0 group-hover:scale-y-100
                                            transition-transform duration-200 origin-top"></div>
                                        <i className="fas fa-sign-out-alt w-5 text-center
                                            group-hover:scale-110 group-hover:translate-x-1
                                            transition-all duration-200"></i>
                                        <span>Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <button 
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="sm:hidden w-11 h-11 rounded-full 
                                bg-gradient-to-br from-red-900/8 to-red-900/5
                                border-[1.5px] border-red-900/15 
                                flex items-center justify-center
                                text-red-900 text-lg
                                transition-all duration-300 
                                hover:bg-red-900/15 hover:border-red-900/30
                                active:scale-95">
                            <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-user-circle'} 
                                transition-transform duration-200 ${isMobileMenuOpen ? 'rotate-90' : ''}`}></i>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div className="sm:hidden fixed inset-0 z-[998] bg-black/20 backdrop-blur-sm
                    animate-[fadeIn_0.2s_ease-out]"
                    onClick={() => setIsMobileMenuOpen(false)}>
                    
                    <div className="absolute top-20 right-4 w-64
                        bg-white rounded-2xl shadow-2xl 
                        border border-slate-100
                        overflow-hidden
                        animate-[slideDown_0.3s_ease-out]"
                        onClick={(e) => e.stopPropagation()}>
                        
                        {/* User Info Header */}
                        <div className="p-4 bg-gradient-to-br from-red-900/5 to-red-900/10 
                            border-b border-red-900/10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full
                                    bg-gradient-to-br from-yellow-400 to-yellow-500
                                    text-red-900 font-bold text-base
                                    flex items-center justify-center
                                    border-3 border-white shadow-lg shadow-yellow-400/30">
                                    {userInitials}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-800 truncate">{userName}</p>
                                    <p className="text-xs text-slate-500">{userRole || "Admin"}</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Menu Items */}
                        <div className="py-2">
                           
                            <div className="my-1 border-t border-slate-100"></div>
                            
                            <button 
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    handleLogout();
                                }}
                                className="w-full px-5 py-3 flex items-center gap-3
                                    text-red-600 font-semibold text-sm
                                    transition-all duration-200
                                    hover:bg-red-50 hover:text-red-900
                                    active:bg-red-100">
                                <i className="fas fa-sign-out-alt w-5 text-center"></i>
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* About Modal */}
            {isAboutModalOpen && (
                <AboutInfoModal onClose={handleCloseAboutModal} />
            )}

            <style jsx>{`
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-12px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                
                @keyframes bellRing {
                    0%, 100% { transform: rotate(0deg); }
                    10%, 30%, 50%, 70%, 90% { transform: rotate(-10deg); }
                    20%, 40%, 60%, 80% { transform: rotate(10deg); }
                }

                @keyframes pulseGlow {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 2px 12px rgba(255, 68, 68, 0.5);
                    }
                    50% {
                        transform: scale(1.15);
                        box-shadow: 0 4px 20px rgba(255, 68, 68, 0.7);
                    }
                }
            `}</style>
        </>
    );
}

// About Info Modal Component
const AboutInfoModal = ({ onClose }) => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4
        backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]"
        onClick={onClose}>
        
        <div className="bg-white rounded-3xl p-6 sm:p-10 max-w-md sm:max-w-[500px] w-full
            shadow-2xl border border-slate-100
            relative overflow-hidden mt-0 sm:mt-[500px]
            animate-[scaleIn_0.3s_ease-out]"
            onClick={(e) => e.stopPropagation()}>
            
            {/* Decorative Top Bar */}
            <div className="absolute top-0 left-0 right-0 h-[5px]
                bg-gradient-to-r from-red-900 via-red-600 to-yellow-400"></div>
            
            <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-900 to-red-600
                    flex items-center justify-center text-2xl
                    shadow-lg shadow-red-900/30">
                    🔊
                </div>
                <h3 className="text-2xl sm:text-[1.75rem] font-bold 
                    bg-gradient-to-r from-red-900 via-red-600 to-red-500 
                    bg-clip-text text-transparent tracking-tight">
                    About SpeakUp
                </h3>
            </div>
            
            <p className="text-slate-600 leading-relaxed mb-8 text-base">
                MSU-IIT Complaint System. Version 1.0. Developed by [Your Group Name].
            </p>
            
            <button 
                onClick={onClose}
                className="w-full py-3.5 sm:py-4 px-6 rounded-xl
                    bg-gradient-to-r from-red-900 via-red-700 to-red-600
                    text-white font-semibold text-sm sm:text-[0.95rem]
                    shadow-lg shadow-red-900/30
                    transition-all duration-300
                    hover:shadow-xl hover:shadow-red-900/40
                    hover:-translate-y-1
                    active:translate-y-0 active:scale-[0.98]
                    relative overflow-hidden group">
                <span className="relative z-10 flex items-center justify-center gap-2">
                    Close
                    <i className="fas fa-times group-hover:rotate-90 transition-transform duration-300"></i>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-red-800 to-red-600
                    transform translate-y-full group-hover:translate-y-0
                    transition-transform duration-300"></div>
            </button>
        </div>
    </div>
);

export default AdminNavbar;