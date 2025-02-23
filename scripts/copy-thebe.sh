#!/bin/bash

# Create thebe directory if it doesn't exist
mkdir -p public/thebe

# Copy JupyterLite files
cp -R node_modules/@jupyterlite/server/lib/* public/thebe/
cp -R node_modules/@jupyterlite/server/style/* public/thebe/

# Copy service worker files
cp node_modules/thebe-lite/dist/lib/service-worker.js public/
cp node_modules/@jupyterlite/server/build/worker.js public/

# Copy Thebe core files
cp -R node_modules/thebe-core/dist/lib/* public/thebe/

# Copy Thebe Lite files - preserve the exact file structure
cp -R node_modules/thebe-lite/dist/lib/* public/thebe/

# Copy pyodide files if they exist
if [ -d "node_modules/pyodide" ]; then
  cp -R node_modules/pyodide/* public/thebe/
fi

# Verify the main files exist
if [ -f "public/thebe/thebe-lite.min.js" ]; then
  echo "thebe-lite.min.js copied successfully"
else
  echo "Error: thebe-lite.min.js not found!"
fi

if [ -f "public/service-worker.js" ]; then
  echo "service-worker.js copied successfully"
else
  echo "Error: service-worker.js not found!"
fi

echo "Thebe files copied successfully!" 
