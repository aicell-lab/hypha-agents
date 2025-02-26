import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';

import ResourceGrid from './components/ResourceGrid';
import ResourceDetails from './components/ResourceDetails';
import Snackbar from './components/Snackbar';
import About from './components/About';
import Footer from './components/Footer';
import Upload from './components/Upload';
import MyArtifacts from './components/MyArtifacts';
import Edit from './components/Edit';
import './index.css'
import './github-markdown.css'
import { HyphaProvider } from './HyphaContext';
import Create from './components/Create';
import Chat from './components/chat/Chat';
import ChatPage from './pages/ChatPage';
import NotebookPage from './pages/NotebookPage';
import { VoiceModeProvider } from './components/chat/VoiceModeProvider';

// Create a wrapper component that uses Router hooks
const AppContent: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const hasResourceId = searchParams.has('id');
  const isChatRoute = location.pathname === '/chat';

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

  return (
    <div className="flex flex-col h-screen">
      <Navbar className="flex-shrink-0" />
      <main className="flex-1 flex flex-col min-h-0">
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
          <Route path="/chat/:id" element={<ChatPage />} />
          <Route path="/notebook" element={<NotebookPage />} />
        </Routes>
      </main>
    </div>
  );
};

// Main App component that provides Router context
const App: React.FC = () => {
  return (
    <VoiceModeProvider>
      <HyphaProvider>
        <HashRouter>
          <AppContent />
        </HashRouter>
      </HyphaProvider>
    </VoiceModeProvider>
  );
};

export default App;
