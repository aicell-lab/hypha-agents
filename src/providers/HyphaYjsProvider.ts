import * as Y from 'yjs';
import { Observable } from 'lib0/observable';
import { v4 as uuidv4 } from 'uuid';

/**
 * Custom Yjs provider that uses Hypha's event bus for communication
 */
export class HyphaYjsProvider extends Observable<'update'> {
  public readonly doc: Y.Doc;
  private connected: boolean;
  private readonly sessionId: string;
  private readonly syncEventName: string;
  private readonly server: any; // hypha server instance
  private readonly onStatusChange: (connected: boolean) => void;

  /**
   * Creates a new HyphaYjsProvider
   * 
   * @param server The Hypha server instance
   * @param doc The Yjs document to sync
   * @param sessionId Optional session ID, will generate a new one if not provided
   * @param options Additional options
   */
  constructor(
    server: any,
    doc: Y.Doc,
    sessionId: string = uuidv4(),
    options: {
      onStatusChange?: (connected: boolean) => void;
    } = {}
  ) {
    super();

    this.doc = doc;
    this.server = server;
    this.sessionId = sessionId;
    this.connected = false;
    this.onStatusChange = options.onStatusChange || (() => {});

    // Event name for this session
    this.syncEventName = `yjs-sync-${this.sessionId}`;

    console.log('[HyphaYjsProvider] Initialized with:', {
      sessionId: this.sessionId,
      syncEventName: this.syncEventName,
      clientId: this.doc.clientID
    });

    // Bind event handlers
    this.handleSyncEvent = this.handleSyncEvent.bind(this);

    // Set up document update handler
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      console.log('[HyphaYjsProvider] Document update detected:', {
        updateSize: update.byteLength,
        origin: origin === this ? 'self' : 'other',
        clientId: this.doc.clientID,
        sessionId: this.sessionId
      });
      
      // Ignore updates applied by this provider
      if (origin !== this) {
        // This update was produced either locally or by another provider
        console.log('[HyphaYjsProvider] Broadcasting update to other clients');
        this.emit('update', [update]);
        this.broadcastDocUpdate(update);
      }
    });

    // Listen to update events from this provider
    this.on('update', (update: Uint8Array) => {
      console.log('[HyphaYjsProvider] Received update event:', {
        updateSize: update.byteLength,
        clientId: this.doc.clientID,
        sessionId: this.sessionId
      });
      Y.applyUpdate(this.doc, update, this);
    });

    // Initialize connection
    this.connect();
  }

  /**
   * Connect to the collaboration session
   */
  public connect(): void {
    if (this.connected) {
      console.log(`[HyphaYjsProvider] Already connected to session: ${this.sessionId}`);
      return;
    }

    console.log(`[HyphaYjsProvider] Attempting to connect to session:`, {
      sessionId: this.sessionId,
      syncEventName: this.syncEventName,
      clientId: this.doc.clientID
    });

    try {
      // Check if server has the "on" and "emit" methods 
      if (typeof this.server.on !== 'function' || typeof this.server.emit !== 'function') {
        console.error('[HyphaYjsProvider] Server does not have required methods', {
          hasOn: typeof this.server.on === 'function',
          hasEmit: typeof this.server.emit === 'function',
          server: this.server
        });
        throw new Error('Server does not have required on/emit methods');
      }

      // Register event listeners for sync events
      console.log(`[HyphaYjsProvider] Setting up event listener for:`, {
        syncEventName: this.syncEventName,
        sessionId: this.sessionId
      });
      this.server.on(this.syncEventName, this.handleSyncEvent);
      
      // Send initial sync step
      const initialUpdate = Y.encodeStateAsUpdate(this.doc);
      console.log(`[HyphaYjsProvider] Broadcasting initial state:`, {
        updateSize: initialUpdate.byteLength,
        sessionId: this.sessionId,
        clientId: this.doc.clientID
      });
      this.broadcastDocUpdate(initialUpdate);

      // Mark as connected
      this.connected = true;
      this.onStatusChange(true);

      console.log(`[HyphaYjsProvider] Connected successfully:`, {
        sessionId: this.sessionId,
        clientId: this.doc.clientID
      });
    } catch (error) {
      console.error('[HyphaYjsProvider] Failed to connect:', error);
      this.onStatusChange(false);
    }
  }

  /**
   * Disconnect from the collaboration session
   */
  public disconnect(): void {
    if (!this.connected) {
      return;
    }

    console.log(`[HyphaYjsProvider] Starting disconnect for session: ${this.sessionId}`);
    
    try {
      // First mark as disconnected to prevent new events
      this.connected = false;
      
      // Clean up server event listeners
      if (this.server && typeof this.server.off === 'function') {
        console.log(`[HyphaYjsProvider] Removing event listener for: ${this.syncEventName}`);
        this.server.off(this.syncEventName, this.handleSyncEvent);
      }
      
      // Clean up doc event listeners
      if (this.doc) {
        console.log('[HyphaYjsProvider] Removing doc update listener');
        this.doc.off('update', this.broadcastDocUpdate);
      }
      
      // Notify status change
      this.onStatusChange(false);
      
      console.log(`[HyphaYjsProvider] Successfully disconnected from session: ${this.sessionId}`);
    } catch (error) {
      console.error('[HyphaYjsProvider] Error during disconnect:', error);
      // Still mark as disconnected even if there was an error
      this.connected = false;
      this.onStatusChange(false);
    }
  }

  /**
   * Broadcast document updates to other clients
   */
  private broadcastDocUpdate(update: Uint8Array): void {
    if (!this.connected) {
      console.log('[HyphaYjsProvider] Not broadcasting - provider disconnected');
      return;
    }
    
    try {
      console.log('[HyphaYjsProvider] Broadcasting update:', {
        updateSize: update.byteLength,
        syncEventName: this.syncEventName,
        sessionId: this.sessionId,
        clientId: this.doc.clientID
      });

      // Send the Uint8Array directly with type in a single argument
      this.server.emit({
        type: this.syncEventName,
        to: "*",
        update: update,
        clientId: this.doc.clientID,
        sessionId: this.sessionId  // Add sessionId to payload for debugging
      });
    } catch (error) {
      console.error('[HyphaYjsProvider] Failed to broadcast doc update:', error);
    }
  }

  /**
   * Handle incoming sync events from other clients
   */
  private handleSyncEvent(data: any): void {
    console.log('[HyphaYjsProvider] Received sync event:', {
      receivedClientId: data.clientId,
      ownClientId: this.doc.clientID,
      receivedSessionId: data.sessionId,
      ownSessionId: this.sessionId,
      updateSize: data.update?.byteLength,
      connected: this.connected
    });

    if (!this.connected) {
      console.log('[HyphaYjsProvider] Ignoring sync event - provider disconnected');
      return;
    }

    try {
      // Skip our own updates
      if (data.clientId === this.doc.clientID) {
        console.log('[HyphaYjsProvider] Ignoring own update');
        return;
      }

      console.log('[HyphaYjsProvider] Applying update from other client');
      // Use the Uint8Array directly
      Y.applyUpdate(this.doc, data.update, this);
    } catch (error) {
      console.error('[HyphaYjsProvider] Failed to handle sync event:', error);
    }
  }

  /**
   * Get the session ID for this collaboration
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if the provider is connected
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Generate a shareable URL for this session
   */
  public generateShareableUrl(baseUrl: string): string {
    // Create URL with session ID as a query parameter
    const url = new URL(baseUrl);
    url.searchParams.set('session', this.sessionId);
    return url.toString();
  }
} 