// Add type declaration for window.define
declare global {
  interface Window {
    define?: any;
  }
}

// Save and restore define function to avoid conflicts with Monaco editor
export const withoutRequireJS = (fn: () => void) => {
  const oldDefine = window.define;
  window.define = undefined;
  try {
    fn();
  } finally {
    window.define = oldDefine;
  }
};

// Helper to safely execute scripts in HTML content
export const executeScripts = (container: HTMLElement) => {
  const scripts = container.querySelectorAll('script');
  scripts.forEach(oldScript => {
    if (!oldScript.parentNode) return;
    
    const newScript = document.createElement('script');
    // Copy all attributes
    Array.from(oldScript.attributes).forEach(attr => 
      newScript.setAttribute(attr.name, attr.value)
    );
    
    // If it has a src, just copy that
    if (oldScript.src) {
      withoutRequireJS(() => {
        newScript.src = oldScript.src;
      });
    } else {
      // For inline scripts, wrap the content in withoutRequireJS
      const originalContent = oldScript.textContent || '';
      newScript.textContent = `
        (function() {
          const oldDefine = window.define;
          window.define = undefined;
          try {
            ${originalContent}
          } finally {
            window.define = oldDefine;
          }
        })();
      `;
    }
    
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}; 