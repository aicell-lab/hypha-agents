/* eslint-env worker */
/* global loadPyodide, globalThis, self */
/* eslint-disable no-restricted-globals */

// Explicitly declare self for web worker context
const _self = self;

const indexURL = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/';

// Import Pyodide dynamically
let pyodidePromise = import("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.mjs");

// Initialize outputs array and helper functions
let outputs = [];
let mountedFs = {};

// Send a status message to the main thread
function sendStatus(status, error = null) {
    if (error) {
        console.error(status, error);
        self.postMessage({ error: error.message || String(error) });
    } else {
        console.log(status);
        self.postMessage({ status });
    }
}

// Expose write function to self
self.write = function(type, content) {
    self.postMessage({ type, content });
    outputs.push({ type, content });
    return content.length;
};

// Expose other helper functions
self.logService = function(type, url, attrs) {
    outputs.push({type, content: url, attrs: attrs?.toJs({dict_converter : Object.fromEntries})});
    self.postMessage({ type, content: url, attrs: attrs?.toJs({dict_converter : Object.fromEntries}) });
};

self.show = function(type, url, attrs) {
    const turl = url.length > 32 ? url.slice(0, 32) + "..." : url;
    outputs.push({type, content: turl, attrs: attrs?.toJs({dict_converter : Object.fromEntries})});
    self.postMessage({ type, content: url, attrs: attrs?.toJs({dict_converter : Object.fromEntries}) });
};

// Initialize Pyodide
async function initializePyodide() {
    try {
        sendStatus("Loading Pyodide...");
        
        // Load Pyodide
        const { loadPyodide } = await pyodidePromise;
        self.pyodide = await loadPyodide({
            indexURL,
            stdout: (text) => self.write("stdout", text),
            stderr: (text) => self.write("stderr", text)
        });

        sendStatus("Loading required packages...");
        
        // Load required packages
        await self.pyodide.loadPackage(['micropip', 'numpy', 'pyodide-http', 'packaging', 'msgpack']);
        
        sendStatus("Initializing Python environment...");
        
        // Initialize Python environment
        await self.pyodide.runPythonAsync(`
            import sys
            import io
            import asyncio
            import micropip
            import numpy as np
            from pyodide.http import pyfetch
            
            async def run(source, io_context=None):
                try:
                    if io_context:
                        globals().update(io_context)
                    await exec(source, globals())
                except Exception as e:
                    import traceback
                    print(traceback.format_exc(), file=sys.stderr)
                    raise e
        `);

        sendStatus("Python environment ready");
        
        // Signal that the worker is ready
        self.postMessage({ loading: true });
        
    } catch (error) {
        sendStatus("Failed to initialize Pyodide", error);
    }
}

// Initialize Pyodide when the worker starts
console.log("Starting Pyodide initialization...");
initializePyodide().catch(error => {
    console.error("Fatal error during initialization:", error);
    self.postMessage({ error: error.message || String(error) });
});

// Handle messages from the main thread
self.onmessage = async (event) => {
    if (!self.pyodide) {
        self.postMessage({ executionError: "Pyodide not initialized" });
        return;
    }
    
    if(event.data.source){
        try{
            const { source, io_context } = event.data;
            self.pyodide.globals.set("source", source);
            self.pyodide.globals.set("io_context", io_context && self.pyodide.toPy(io_context));
            outputs = [];
            // sync native ==> browser
            await new Promise((resolve, _) => self.pyodide.FS.syncfs(true, resolve));
            await self.pyodide.runPythonAsync("await run(source, io_context)");
            // sync browser ==> native
            await new Promise((resolve, _) => self.pyodide.FS.syncfs(false, resolve));
            console.log("Execution done", outputs);
            self.postMessage({ executionDone: true, outputs });
            outputs = [];
        }
        catch(e){
            console.error("Execution Error", e);
            self.postMessage({ executionError: e.message });
        }
    }
    if(event.data.mount){
        try{
            const { mountPoint, dirHandle } = event.data.mount;
            if(mountedFs[mountPoint]){
                console.log("Unmounting native FS:", mountPoint);
                await self.pyodide.FS.unmount(mountPoint);
                delete mountedFs[mountPoint];
            }
            const nativefs = await self.pyodide.mountNativeFS(mountPoint, dirHandle);
            mountedFs[mountPoint] = nativefs;
            console.log("Native FS mounted:", mountPoint, nativefs);
            self.postMessage({ mounted: mountPoint });
        }
        catch(e){
            self.postMessage({ mountError: e.message });
        }
    }
}; 