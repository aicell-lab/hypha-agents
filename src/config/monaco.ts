import { loader } from '@monaco-editor/react';
import { getBaseUrl } from '../utils/urlHelpers';

// Configure Monaco to use local files
const monacoPath = `${getBaseUrl()}/monaco-editor/vs`;
const baseUrl = getBaseUrl();

console.log('[Monaco Config] ============================================');
console.log('[Monaco Config] Configuring Monaco loader');
console.log('[Monaco Config] Base URL:', baseUrl);
console.log('[Monaco Config] Monaco path:', monacoPath);
console.log('[Monaco Config] Full loader path:', window.location.origin + monacoPath + '/loader.js');
console.log('[Monaco Config] PUBLIC_URL:', process.env.PUBLIC_URL);
console.log('[Monaco Config] ============================================');

loader.config({
  paths: {
    vs: monacoPath
  },
  'vs/nls': {
    availableLanguages: {
      '*': ''
    }
  }
});

console.log('[Monaco Config] Configuration applied. Monaco will load from:', monacoPath);

// Export something to prevent tree-shaking
export const monacoConfigured = true; 