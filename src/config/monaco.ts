import { loader } from '@monaco-editor/react';

// Configure Monaco to use local files
loader.config({
  paths: {
    vs: '/monaco-editor/vs'
  },
  'vs/nls': {
    availableLanguages: {
      '*': ''
    }
  }
}); 