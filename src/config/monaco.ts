import { loader } from '@monaco-editor/react';
import { getBaseUrl } from '../utils/urlHelpers';

// Configure Monaco to use local files with dynamic base URL
loader.config({
  paths: {
    vs: `${getBaseUrl()}/monaco-editor/vs`
  },
  'vs/nls': {
    availableLanguages: {
      '*': ''
    }
  }
}); 