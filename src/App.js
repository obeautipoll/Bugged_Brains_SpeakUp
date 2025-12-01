import { useRoutes, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/authContext";
import { NotificationsProvider } from "./contexts/notificationsContext";


// Auth components
import Login from "./components/auth/login";
import AdminLogin from "./components/auth/adminLogin"; // <-- Add this
import Register from "./components/auth/register";

// Layout and page components
import Header from "./components/header";

// Student Pages
import Dashboard from "./speakup-frontend/student-pages/Dashboard";
import FileComplaint from "./speakup-frontend/student-pages/ComplaintForm";
import Notifications from "./speakup-frontend/student-pages/Notifications";
import ComplaintHistory from "./speakup-frontend/student-pages/ComplaintHistory";

// Admin Pages
import AdminDashboard from "./speakup-frontend/admin-pages/admin-dashboard";
import AdminUserManage from "./speakup-frontend/admin-pages/admin-userManage";
import AdminMonitorComplaints from "./speakup-frontend/admin-pages/admin-monitoring";
import AdminAnalytics from "./speakup-frontend/admin-pages/admin-analytics";
import AdminNotifications from "./speakup-frontend/admin-pages/admin-notifications";

// Staff / KASAMA Pages
import StaffDashboard from "./speakup-frontend/staff-pages/staff-dashboard";
import StaffMonitorComplaints from "./speakup-frontend/staff-pages/staff-monitoring";
import StaffNotifications from "./speakup-frontend/staff-pages/staff-notification";

const roleMatches = (userRole, required) => {
  if (!required) return true;
  const roles = Array.isArray(required) ? required : [required];
  return roles.map((role) => role.toLowerCase()).includes((userRole || "").toLowerCase());
};

const ROLE_ROUTE_MAP = {
  admin: "/adashboard",
  staff: "/sdashboard",
  kasama: "/sdashboard",
  student: "/dashboard",
};

const resolveRouteByRole = (role) => ROLE_ROUTE_MAP[role?.toLowerCase()] || "/dashboard";


const PrivateRoute = ({ element, requiredRole }) => {
  const user = JSON.parse(localStorage.getItem("user"));
  const role = user?.role?.toLowerCase();

  if (!user) {
    // redirect admins/staff to admin login, students to student login
    return <Navigate to={role && ["admin", "staff", "kasama"].includes(role) ? "/adminlogin" : "/login"} replace />;
  }

  if (!roleMatches(role, requiredRole)) {
    // optional: redirect to their default dashboard
    return <Navigate to={resolveRouteByRole(role)} replace />;
  }

  return element;
};


function App() {
  const resolveDefaultRoute = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser?.role) return "/login";

    const role = storedUser.role.toLowerCase();
    switch (role) {
      case "admin":
        return "/adashboard";
      case "staff":
      case "kasama":
        return "/sdashboard";
      case "student":
        return "/dashboard";
      default:
        return "/login";
    }
  } catch (error) {
    console.error("Failed to parse stored user:", error);
    return "/login";
  }
};

  const defaultRoute = resolveDefaultRoute();

  const routesArray = [
    { path: "/", element: <Navigate to={defaultRoute} replace /> },
    { path: "/login", element: <Login /> },
    { path: "/adminlogin", element: <AdminLogin /> },
    { path: "/register", element: <Register /> },
    {
      path: "/dashboard",
      element: <PrivateRoute element={<Dashboard />} requiredRole="student" />,
    },
    {
      path: "/file-complaint",
      element: <PrivateRoute element={<FileComplaint />} requiredRole="student" />,
    },
    {
      path: "/notifications",
      element: <PrivateRoute element={<Notifications />} requiredRole="student" />,
    },
    {
      path: "/history",
      element: <PrivateRoute element={<ComplaintHistory />} requiredRole="student" />,
    },
    {
      path: "/adashboard",
      element: <PrivateRoute element={<AdminDashboard />} requiredRole="admin" />,
    },
    {
      path: "/amanageusers",
      element: <PrivateRoute element={<AdminUserManage />} requiredRole="admin" />,
    },
    {
      path: "/aanalytics",
      element: <PrivateRoute element={<AdminAnalytics />} requiredRole="admin" />,
    },
    {
      path: "/amonitorcomplaints",
      element: <PrivateRoute element={<AdminMonitorComplaints />} requiredRole="admin" />,
    },
    {
       path: "/anotifications",
      element: <PrivateRoute element={<AdminNotifications />} requiredRole="admin" />,
    },
    {
      path: "/sdashboard",
      element: <PrivateRoute element={<StaffDashboard />} requiredRole={["staff", "kasama"]} />,
    },
    {
      path: "/smonitorcomplaints",
      element: <PrivateRoute element={<StaffMonitorComplaints />} requiredRole={["staff", "kasama"]} />,
    },
    {
      path: "/snotifications",
      element: <PrivateRoute element={<StaffNotifications />} requiredRole={["staff", "kasama"]} />,
    },
    { path: "*", element: <Navigate to={defaultRoute} replace /> },
  ];

  const routesElement = useRoutes(routesArray);

  return (
    <AuthProvider>
      <NotificationsProvider>
        <Header />
        <div className="w-full h-screen flex flex-col">{routesElement}</div>
      </NotificationsProvider>
    </AuthProvider>
  );
}

export default App;
