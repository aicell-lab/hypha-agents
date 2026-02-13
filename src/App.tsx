import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';

import ResourceGrid from './components/ResourceGrid';
import ResourceDetails from './components/ResourceDetails';
import About from './components/About';
import MyArtifacts from './components/MyArtifacts';
import './index.css'
import './github-markdown.css'
import AgentLab from './pages/AgentLab';
import CollabTest from './pages/CollabTest';

// Create a wrapper component that uses Router hooks
const AppContent: React.FC = () => {
  const location = useLocation();
  const isAgentLabRoute = location.pathname === '/lab' || location.pathname === '/notebook';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isIsolationChecked, setIsIsolationChecked] = useState(false);
  const [isIsolated, setIsIsolated] = useState(true);

  useEffect(() => {
    // Check for Cross-Origin Isolation (required for Pyodide/SharedArrayBuffer in Safari)
    if (typeof window !== 'undefined') {
      const isolated = !!window.crossOriginIsolated;
      setIsIsolated(isolated);
      setIsIsolationChecked(true);
      if (!isolated) {
        console.warn('App is not cross-origin isolated. Pyodide kernel may fail in Safari/Firefox.');
      }
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };


  // Close sidebar on mobile when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // For agent lab route, don't show the Navbar and Sidebar
  if (isAgentLabRoute) {
    return (
      <div className="flex flex-col h-screen">
        {!isIsolated && isIsolationChecked && (
          <div className="bg-red-600 text-white px-4 py-2 text-center text-sm font-medium z-50">
            ⚠️ Browser Security Restriction: This app requires Cross-Origin Isolation (SharedArrayBuffer) to run the Python kernel. 
            Please refresh the page. If the issue persists, your browser or environment may not support the required security headers.
          </div>
        )}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <Routes>
            <Route path="/lab" element={<AgentLab />} />
            <Route path="/notebook" element={<Navigate to="/lab" replace />} />
          </Routes>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Navbar className="flex-shrink-0" />
      <div className="flex-1 flex overflow-hidden">

        <div className="flex-1 flex flex-col min-h-0 overflow-auto">
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<ResourceGrid />} />
              <Route path="/resources/:id" element={<ResourceDetails />} />
              <Route path="/about" element={<About />} />
              <Route path="/models" element={<ResourceGrid type="model" />} />
              <Route path="/applications" element={<ResourceGrid type="application" />} />
              <Route path="/notebooks" element={<ResourceGrid type="notebook" />} />
              <Route path="/datasets" element={<ResourceGrid type="dataset" />} />
              <Route path="/my-agents" element={<MyArtifacts />} />
              <Route path="/collab-test" element={<CollabTest />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
};

// Main App component that provides Router context
const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
