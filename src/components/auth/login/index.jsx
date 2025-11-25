import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/authContext';
import { doSignInWithGoogle } from '../../../firebase/auth';

const ROLE_ROUTE_MAP = {
  admin: "/adashboard",
  staff: "/sdashboard",
  kasama: "/sdashboard",
  student: "/dashboard",
};
const requiredDomain = "@g.msuiit.edu.ph";

const resolveRouteByRole = (role) => ROLE_ROUTE_MAP[role?.toLowerCase()] || "/dashboard";

const Login = () => {
  const navigate = useNavigate();
  const { userLoggedIn } = useAuth() || {}; // Safe destructure
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Get stored user safely
  const storedUser = (() => {
    try {
      const item = localStorage.getItem('user');
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  })();

  // Redirect if already logged in
  if (userLoggedIn && storedUser?.role) {
    return <Navigate to={resolveRouteByRole(storedUser.role)} replace />;
  }

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setErrorMessage('');

    try {
      const user = await doSignInWithGoogle();
      const role = user?.role || 'student';

      // Only students require domain restriction
      if (role === 'student' && !user.email?.endsWith(requiredDomain)) {
        setErrorMessage(`Students must log in with an institutional email: ${requiredDomain}`);
        setIsSigningIn(false);
        return;
      }

      // Store user info
      localStorage.setItem('token', 'mockToken123');
      localStorage.setItem('user', JSON.stringify(user));

      navigate(resolveRouteByRole(role));
    } catch (err) {
      console.error('Google login error:', err);
      const message = `${err?.message || ''}`.toLowerCase();
      const domainError =
        message.includes(requiredDomain.toLowerCase()) ||
        message.includes('institutional email') ||
        message.includes('g.msuiit');

      setErrorMessage(
        domainError
          ? `Login failed. Must use institutional email: ${requiredDomain}`
          : 'Something went wrong with Google Sign-In. Check pop-up settings.'
      );
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 md:p-8 font-inter">
      <div className="flex flex-col md:flex-row max-w-5xl w-full bg-white shadow-2xl rounded-2xl overflow-hidden">
        
        {/* Left Side */}
        <div className="md:w-5/12 p-8 md:p-14 text-white bg-[#8B0000] flex flex-col justify-between">
          <div>
            <h1 className="text-4xl font-extrabold mb-4 tracking-wider">SpeakUp</h1>
            <p className="text-2xl font-light mb-8 opacity-95 leading-snug">
              MSU-IIT Student-Centered Digital Complaint Resolution System
            </p>
            <p className="text-base leading-relaxed opacity-80 border-l-4 border-white pl-4 py-1">
              Ensuring efficient, transparent, and fair handling of student concerns through a dedicated digital platform.
            </p>
          </div>
          <div className="mt-12 pt-6 border-t border-white border-opacity-40">
            <h3 className="text-2xl font-semibold mb-2">Welcome Back!</h3>
            <p className="text-sm opacity-90 italic">
              The institutional key for access is your official {requiredDomain} account.
            </p>
          </div>
        </div>

        {/* Right Side */}
        <div className="md:w-7/12 p-8 md:p-14 flex flex-col justify-center items-center">
          <div className="w-full max-w-sm mx-auto text-center">
            <h2 className="text-2xl font-bold mb-3 text-gray-800">Do you want to speak up?</h2>
            <p className="text-gray-500 mb-6">Sign in below using your My.IIT account.</p>

            {/* Error */}
            {errorMessage && (
              <div className="mb-6 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm font-medium">
                {errorMessage}
              </div>
            )}

            {/* Google Sign-In */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
              className={`
                w-full flex items-center justify-center gap-x-3 py-3.5 px-6 border-2 border-gray-200
                rounded-full text-lg font-semibold text-gray-700 bg-white shadow-lg
                hover:shadow-xl hover:bg-gray-50 transition-all duration-300
                ${isSigningIn ? 'cursor-not-allowed opacity-70' : ''}
              `}
            >
              <svg className="w-6 h-6" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M43.611 20.083H42V20H24V28H35.844C34.789 31.42 32.22 34.025 28.71 35.107L28.98 35.341L35.253 40.098L35.485 40.237C39.696 36.657 42.417 31.023 43.611 24.083V20.083Z" fill="#4285F4"/>
                <path d="M24 44C31.571 44 38.082 41.523 43.611 36.083L35.485 40.237C33.28 41.742 30.638 42.667 27.79 42.667C22.028 42.667 17.067 38.648 15.342 33.723L15.027 33.829L8.68 38.52L8.53 38.654C12.352 42.484 17.886 44 24 44Z" fill="#34A853"/>
                <path d="M8.53 38.654C7.792 36.568 7.333 34.305 7.333 32C7.333 29.695 7.792 27.432 8.53 25.346L8.583 25.266L2.31 20.575L2.213 20.732C0.77 23.714 0 26.839 0 30C0 33.161 0.77 36.286 2.213 39.268L8.53 38.654Z" fill="#FBBC04"/>
                <path d="M24 11.333C27.067 11.333 30.077 12.378 32.553 14.654L38.401 8.805C35.035 5.568 29.878 4 24 4C17.886 4 12.352 5.516 8.53 9.346L15.342 14.277C17.067 19.202 22.028 23.221 27.79 23.221C29.695 23.221 31.621 22.84 33.398 22.12L33.684 22.007L35.844 28H43.611C41.765 24.646 38.381 21.905 34.464 20.083H24V11.333Z" fill="#EA4335"/>
              </svg>
              {isSigningIn ? 'Connecting...' : 'Continue with Google'}
            </button>

            {/* Registration */}
            <div className="text-center mt-8">
              <p className="text-gray-600 text-sm">
                Does't have an account yet?
                <Link to="/register" className="text-sm font-semibold ml-1 hover:text-red-700" style={{ color: "#8B0000" }}>
                  Register Here
                </Link>
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
