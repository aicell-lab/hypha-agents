import React, { useEffect, useRef, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { useSearchParams } from 'react-router-dom';
import { HyphaYjsProvider } from '../providers/HyphaYjsProvider';
import { useHyphaStore } from '../store/hyphaStore';

const CollabTest: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const isGuest = searchParams.get('guest') === 'true';
  const editorRef = useRef<any>(null);
  const providerRef = useRef<HyphaYjsProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const yTextRef = useRef<Y.Text | null>(null);
  const [status, setStatus] = useState<string>('Connecting...');
  const hyphaServer = useHyphaStore(state => state.server);
  const [shareUrl, setShareUrl] = useState<string>('');

  useEffect(() => {
    if (!hyphaServer) return;

    console.log('[CollabTest] Initializing with:', {
      sessionId,
      isGuest,
      hasServer: !!hyphaServer
    });

    // Create Yjs document
    const doc = new Y.Doc();
    docRef.current = doc;
    const yText = doc.getText('monaco');
    yTextRef.current = yText;

    // Log initial document state
    console.log('[CollabTest] Created Yjs document:', {
      clientId: doc.clientID,
      text: yText.toString()
    });

    // Subscribe to document updates
    doc.on('update', (update: Uint8Array, origin: any) => {
      console.log('[CollabTest] Document updated:', {
        updateSize: update.byteLength,
        origin: origin === providerRef.current ? 'provider' : 'local',
        text: yText.toString()
      });
    });

    // Create HyphaYjsProvider with the session ID from URL or generate new one
    const provider = new HyphaYjsProvider(hyphaServer, doc, sessionId || undefined, {
      onStatusChange: (connected) => {
        console.log('[CollabTest] Connection status changed:', { connected });
        setStatus(connected ? 'Connected' : 'Disconnected');
      }
    });
    
    // Store provider reference
    providerRef.current = provider;

    // Generate shareable URL if we're the owner
    if (!isGuest && provider.getSessionId()) {
      const url = new URL(window.location.href);
      url.searchParams.set('session', provider.getSessionId());
      url.searchParams.set('guest', 'true');
      setShareUrl(url.toString());
      console.log('[CollabTest] Generated share URL:', url.toString());
    }

    // Clean up on unmount
    return () => {
      console.log('[CollabTest] Cleaning up...');
      provider.disconnect();
      doc.destroy();
      providerRef.current = null;
      docRef.current = null;
      yTextRef.current = null;
    };
  }, [hyphaServer, sessionId, isGuest]);

  const handleEditorDidMount = (editor: any) => {
    console.log('[CollabTest] Editor mounted');
    editorRef.current = editor;

    if (!providerRef.current || !docRef.current || !yTextRef.current) {
      console.error('[CollabTest] Provider, doc, or yText not initialized', {
        hasProvider: !!providerRef.current,
        hasDoc: !!docRef.current,
        hasYText: !!yTextRef.current
      });
      return;
    }

    // Create Monaco binding using the existing yText instance
    const binding = new MonacoBinding(
      yTextRef.current,
      editor.getModel(),
      new Set([editor]),
      null // We don't need awareness for this simple example
    );

    console.log('[CollabTest] Monaco binding created:', {
      initialText: yTextRef.current.toString(),
      modelValue: editor.getModel().getValue()
    });

    // Monitor editor changes
    editor.onDidChangeModelContent((event: any) => {
      console.log('[CollabTest] Editor content changed:', {
        changes: event.changes,
        currentValue: editor.getModel().getValue(),
        yjsValue: yTextRef.current?.toString()
      });
    });
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Status: {status}
          {isGuest ? ' (Guest)' : ' (Owner)'}
        </div>
        {shareUrl && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Share URL:</span>
            <input
              type="text"
              value={shareUrl}
              readOnly
              aria-label="Shareable collaboration URL"
              className="text-sm bg-gray-50 border border-gray-300 rounded px-2 py-1 w-96"
              onClick={(e) => {
                e.currentTarget.select();
                navigator.clipboard.writeText(shareUrl);
              }}
            />
          </div>
        )}
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Editor
          height="70vh"
          defaultLanguage="text"
          defaultValue="// Start typing here..."
          onMount={handleEditorDidMount}
          onChange={(value) => {
            console.log('[CollabTest] Editor onChange:', {
              value,
              yjsValue: yTextRef.current?.toString() || ''
            });
          }}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            folding: true
          }}
        />
      </div>
    </div>
  );
};

export default CollabTest; 