// Add type declaration for window.define
declare global {
  interface Window {
    define?: any;
    Plotly?: any;
  }
}

// Utility function for loading and initializing Plotly
export const ensurePlotlyLoaded = async (): Promise<void> => {
  if (typeof window === 'undefined' || window.Plotly) {
    return;
  }

  return new Promise((resolve) => {
    console.log('Loading Plotly library...');
    
    // Save any existing define function
    const oldDefine = window.define;
    window.define = undefined;

    const script = document.createElement('script');
    script.src = 'https://cdn.plot.ly/plotly-2.24.1.min.js';
    script.async = true;
    script.onload = () => {
      // Restore the original define function
      window.define = oldDefine;
      console.log('Plotly library loaded successfully');
      resolve();
    };
    document.head.appendChild(script);
  });
};

// Helper to check if code contains Plotly-related content
export const containsPlotly = (code: string): boolean => {
  return /plotly|px\.|fig\.show\(\)|fig = px\.|import plotly|display\(fig\)/i.test(code);
}; 