import { loader } from '@monaco-editor/react';
import { getBaseUrl } from '../utils/urlHelpers';

// Configure Monaco to use local files
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