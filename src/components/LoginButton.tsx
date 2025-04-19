import { useState, useEffect, useCallback } from 'react';
import { useHyphaStore } from '../store/hyphaStore';
import { UserCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { RiLoginBoxLine } from 'react-icons/ri';
import { Link, useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Spinner } from './Spinner';

interface LoginButtonProps {
  className?: string;
}

interface LoginConfig {
  server_url: string;
  login_callback: (context: { login_url: string }) => void;
}

const serverUrl = "https://hypha.aicell.io";

// Move token logic outside of component
const getSavedToken = () => {
  const token = localStorage.getItem("token");
  if (token) {
    const tokenExpiry = localStorage.getItem("tokenExpiry");
    if (tokenExpiry && new Date(tokenExpiry) > new Date()) {
      return token;
    }
  }
  return null;
};

const REDIRECT_PATH_KEY = 'redirectPath'; // Define key for sessionStorage

export default function LoginButton({ className = '' }: LoginButtonProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { client, user, connect, setUser, server, isConnecting, isConnected } = useHyphaStore();
  const navigate = useNavigate();
  const location = useLocation(); // Get location

  // Add click outside handler to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdown = document.getElementById('user-dropdown');
      if (dropdown && !dropdown.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add logout handler
  const handleLogout = async () => {
    try {

      // Clear any auth tokens or user data from localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem(REDIRECT_PATH_KEY); // Clear redirect path on logout
      
      // Perform existing logout logic
      setUser(null);
      setIsDropdownOpen(false);
      
      // Optionally redirect to home page
      navigate('/');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const loginCallback = (context: { login_url: string }) => {
    window.open(context.login_url);
  };

  const login = async () => {    
    const config: LoginConfig = {
      server_url: serverUrl,
      login_callback: loginCallback,
    };

    try {
      if (!client) {
        throw new Error('Hypha client is not initialized');
      }
      const token = await client.login(config);
      localStorage.setItem("token", token);
      localStorage.setItem("tokenExpiry", new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString());
      return token;
    } catch (error) {
      console.error('Login failed:', error);
      return null;
    }
  };

  const handleLogin = useCallback(async () => {
    // Store the intended path BEFORE initiating login
    // Use location.hash which includes '#/...' for HashRouter
    if (location.hash && location.hash !== '#/') {
      sessionStorage.setItem(REDIRECT_PATH_KEY, location.hash);
      console.log(`[LoginButton] Stored redirect path: ${location.hash}`); // Debug log
    }

    setIsLoggingIn(true);
    
    try {
      let token = getSavedToken();
      
      if (!token) {
        token = await login();
        if (!token) {
          throw new Error('Failed to obtain token');
        }
      }
      await connect({
        server_url: serverUrl,
        token: token,
      });

      // Redirect after successful connect
      const redirectPath = sessionStorage.getItem(REDIRECT_PATH_KEY);
      if (redirectPath) {
        console.log(`[LoginButton] Redirecting to stored path: ${redirectPath}`); // Debug log
        sessionStorage.removeItem(REDIRECT_PATH_KEY);
        // Use navigate with the full hash path for HashRouter
        navigate(redirectPath.startsWith('#') ? redirectPath.substring(1) : redirectPath);
      }

    } catch (error) {
      console.error("Error during login:", error);
      localStorage.removeItem("token");
      localStorage.removeItem("tokenExpiry");
      sessionStorage.removeItem(REDIRECT_PATH_KEY); // Clear on error too
    } finally {
      setIsLoggingIn(false);
    }
  }, [connect, location.hash, navigate]); // Add location.hash and navigate to dependencies

  // Auto-login on component mount if token exists
  useEffect(() => {
    const autoLogin = async () => {
      const token = getSavedToken();
      // --- Add checks for connection state ---
      if (token && !isConnected && !isConnecting) {
      // -------------------------------------
        // Removed the `!user` check to ensure connection attempt happens
        // even if user state might be present but connection isn't fully ready.
        setIsLoggingIn(true); // Keep this to show visual feedback
        try {
          // Connect function now has its own internal guard, but this prevents unnecessary calls
          await connect({
            server_url: serverUrl,
            token: token,
          });

          // Redirect after successful auto-login connect
          const redirectPath = sessionStorage.getItem(REDIRECT_PATH_KEY);
          if (redirectPath) {
            console.log(`[LoginButton] Auto-login redirecting to stored path: ${redirectPath}`); // Debug log
            sessionStorage.removeItem(REDIRECT_PATH_KEY);
            // Use navigate with the full hash path for HashRouter
            navigate(redirectPath.startsWith('#') ? redirectPath.substring(1) : redirectPath);
          }
        } catch (error) {
          console.error("Auto-login failed:", error);
          localStorage.removeItem("token");
          localStorage.removeItem("tokenExpiry");
          sessionStorage.removeItem(REDIRECT_PATH_KEY); // Clear on error
        } finally {
          setIsLoggingIn(false);
        }
      }
    };
    
    autoLogin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect, isConnected, isConnecting]); // Update dependencies

  useEffect(() => {
    if (server) {
      setUser(server.config.user);
      console.log("Logged in as:", server.config.user);
    }
  }, [server, setUser]);

  return (
    <div className={className}>
      {user?.email ? (
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="text-gray-700 hover:text-gray-900 focus:outline-none"
            aria-label="User profile menu"
          >
            <UserCircleIcon className="h-6 w-6" />
          </button>
          
          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
              <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
                {user.email}
              </div>
              <Link
                to="/my-agents"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setIsDropdownOpen(false)}
              >
                My Agents
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      ) : (
        <button 
          onClick={handleLogin} 
          disabled={isLoggingIn}
          className="text-gray-700 hover:text-gray-900 px-4 py-2 rounded-md hover:bg-gray-50 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoggingIn ? (
            <>
              <Spinner className="w-4 h-4 mr-2" />
              Logging in...
            </>
          ) : (
            <>
              <RiLoginBoxLine className="mr-2" size={18} />
              Login
            </>
          )}
        </button>
      )}
    </div>
  );
} 