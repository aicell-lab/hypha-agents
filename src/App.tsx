import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';

import ResourceGrid from './components/ResourceGrid';
import ResourceDetails from './components/ResourceDetails';
import About from './components/About';
import Upload from './components/Upload';
import MyArtifacts from './components/MyArtifacts';
import Edit from './components/Edit';
import './index.css'
import './github-markdown.css'
import Create from './components/Create';
import Chat from './components/chat/Chat';
import ChatPage from './pages/ChatPage';
import AgentLab from './pages/AgentLab';
import CollabTest from './pages/CollabTest';

// Create a wrapper component that uses Router hooks
const AppContent: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const hasResourceId = searchParams.has('id');
  const isChatRoute = location.pathname === '/chat';
  const isChatDetailRoute = location.pathname.startsWith('/chat/');
  const isAgentLabRoute = location.pathname === '/lab' || location.pathname === '/notebook';

  // Add state for Snackbar
  const [snackbarOpen, setSnackbarOpen] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState('');

  // Add search handlers
  const handleSearchChange = (value: string) => {
    // Implement search logic
  };

  const handleSearchConfirm = (value: string) => {
    // Implement search confirmation logic
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  // For chat routes, we need a different layout to handle scrolling properly
  if (isChatDetailRoute) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <Navbar className="flex-shrink-0" />
        <div className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/chat/:id" element={<ChatPage />} />
          </Routes>
        </div>
      </div>
    );
  }

  // For notebook route, don't show the Navbar
  if (isAgentLabRoute) {
    return (
      <div className="flex flex-col h-screen">
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
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<ResourceGrid />} />
          <Route path="/resources/:id" element={<ResourceDetails />} />
          <Route path="/about" element={<About />} />
          <Route path="/models" element={<ResourceGrid type="model" />} />
          <Route path="/applications" element={<ResourceGrid type="application" />} />
          <Route path="/notebooks" element={<ResourceGrid type="notebook" />} />
          <Route path="/datasets" element={<ResourceGrid type="dataset" />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/my-agents" element={<MyArtifacts />} />
          <Route path="/edit/:artifactId" element={<Edit />} />
          <Route path="/create" element={<Create />} />
          <Route path="/chat" element={
            <Chat 
              agentConfig={{
                name: "Code Interpreter",
                profile: "AI Assistant with Python execution capabilities",
                goal: "Help you with coding and data analysis tasks",
                model: "gpt-4-mini",
                stream: true
              }} 
            />
          } />
          <Route path="/collab-test" element={<CollabTest />} />
        </Routes>
      </main>
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
