import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { monacoConfigured } from './config/monaco';  // Import Monaco configuration

// Verify Monaco configuration was loaded
if (monacoConfigured) {
  console.log('[Index] Monaco configuration loaded successfully');
}

// Log isolation status
console.log('[Index] App started. CrossOriginIsolated:', window.crossOriginIsolated);
debugger;
if (!window.crossOriginIsolated) {
  console.warn('[Index] Application is NOT cross-origin isolated. Pyodide/WebWorkers may fail in Safari.');
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
