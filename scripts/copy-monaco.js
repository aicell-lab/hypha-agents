const fs = require('fs-extra');
const path = require('path');

const monacoPath = path.join(__dirname, '../node_modules/monaco-editor/min');
const publicPath = path.join(__dirname, '../public/monaco-editor');

// Ensure the target directory exists
fs.ensureDirSync(publicPath);

// Copy the entire vs directory
fs.copySync(
  path.join(monacoPath, 'vs'),
  path.join(publicPath, 'vs'),
  { overwrite: true }
);

console.log('Monaco editor files copied successfully!'); 