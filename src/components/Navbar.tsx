import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LoginButton from './LoginButton';
import { BiCube } from 'react-icons/bi';
import { BsDatabase, BsCollection } from 'react-icons/bs';
import { HiOutlineBeaker } from 'react-icons/hi';
import { IoDocumentTextOutline, IoCloudUploadOutline } from 'react-icons/io5';
import { AiOutlineInfoCircle } from 'react-icons/ai';
import { RiLoginBoxLine } from 'react-icons/ri';
import { useHyphaStore } from '../store/hyphaStore';

const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useHyphaStore();

  const isActivePath = (path: string): boolean => {
    return location.pathname.startsWith(path);
  };

  const navLinkClasses = (path: string): string => {
    const baseClasses = "flex items-center px-3 py-2";
    const activeClasses = "text-blue-600 font-medium";
    const inactiveClasses = "text-gray-700 hover:text-gray-900";
    
    return `${baseClasses} ${isActivePath(path) ? activeClasses : inactiveClasses}`;
  };

  const mobileNavLinkClasses = (path: string): string => {
    const baseClasses = "flex items-center px-3 py-2 rounded-md hover:bg-gray-50";
    const activeClasses = "text-blue-600 font-medium bg-blue-50";
    const inactiveClasses = "text-gray-700 hover:text-gray-900";
    
    return `${baseClasses} ${isActivePath(path) ? activeClasses : inactiveClasses}`;
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left section with logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <div className="flex items-center text-2xl font-bold text-blue-600">
                <BiCube className="mr-2" size={24} />
                Elia Platform
              </div>
            </Link>
          </div>

          {/* Center section with navigation - now empty */}
          <div className="hidden md:flex items-center space-x-4">
          </div>

          {/* Right section with auth buttons */}
          <div className="flex items-center space-x-4">
            {/* Move Upload and Login buttons to desktop-only view */}
            <div className="hidden md:flex items-center space-x-4">
              <Link
                to="/about"
                className="hover:bg-gray-50 px-4 py-2 rounded-md flex items-center"
              >
                <AiOutlineInfoCircle className="mr-2" size={18} />
                About
              </Link>
              
              {location.pathname !== '/create' && (
                <Link
                  to="/create"
                  className="hover:bg-gray-50 px-4 py-2 rounded-md flex items-center"
                >
                  <IoCloudUploadOutline className="mr-2" size={18} />
                  Create
                </Link>
              )}
              {user?.email && location.pathname !== '/my-agents' && (
                <Link
                  to="/my-agents"
                  className="hover:bg-gray-50 px-4 py-2 rounded-md flex items-center"
                >
                  <BsCollection className="mr-2" size={18} />
                  My Agents
                </Link>
              )}
              <LoginButton />
            </div>
            
            {/* Mobile menu button */}
            <button 
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
          <div className="px-2 pt-2 pb-3 space-y-1">
            {user?.email && (
              <Link 
                to="/my-agents" 
                className={mobileNavLinkClasses("/my-agents")}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <BsCollection className="mr-2" size={18} />
                My Agents
              </Link>
            )}
            <Link 
              to="/create" 
              className={mobileNavLinkClasses("/create")}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <IoCloudUploadOutline className="mr-2" size={18} />
              + Create
            </Link>
            <Link 
              to="/about" 
              className={mobileNavLinkClasses("/about")}
            >
              <AiOutlineInfoCircle className="mr-2" size={18} />
              About
            </Link>

            {/* Add divider */}
            <div className="border-t border-gray-200 my-2"></div>

            {/* Add Upload and Login buttons to mobile menu */}
            {location.pathname !== '/create' && (
              <Link 
                to="/create" 
                className={mobileNavLinkClasses("/create")}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <IoCloudUploadOutline className="mr-2" size={18} />
                + Create
              </Link>
            )}
            <div className="px-3 py-2">
              <LoginButton />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 