import { create } from 'zustand';
import { hyphaWebsocketClient } from 'hypha-rpc';
// import { hRPC } from 'hypha';
import { Resource } from '../types';
import { SITE_ID, SERVER_URL } from '../utils/env';


// Add a type for connection config
interface ConnectionConfig {
  server_url: string;
  token?: string;
}

interface LoginConfig {
  server_url: string;
  login_callback?: (context: any) => void;
}

export interface HyphaState {
  client: typeof hyphaWebsocketClient | null;
  server: any;
  setServer: (server: any) => void;
  user: any;
  setUser: (user: any) => void;
  isInitialized: boolean;
  setIsInitialized: (isInitialized: boolean) => void;
  resources: Resource[];
  setResources: (resources: Resource[]) => void;
  resourceType: string | null;
  setResourceType: (type: string | null) => void;
  fetchResources: (page: number, searchQuery?: string) => Promise<void>;
  resourceTypes: string[];
  setResourceTypes: (types: string[]) => void;
  page: number;
  itemsPerPage: number;
  totalItems: number;
  setTotalItems: (total: number) => void;
  artifactManager: any;
  isConnected: boolean;
  isConnecting: boolean;
  connect: (config: ConnectionConfig) => Promise<any>;
  isLoggingIn: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  isLoggedIn: boolean;
  setLoggedIn: (status: boolean) => void;
  selectedResource: Resource | null;
  setSelectedResource: (resource: Resource | null) => void;
  fetchResource: (id: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const useHyphaStore = create<HyphaState>((set, get) => ({
  client: hyphaWebsocketClient,
  server: null,
  user: null,
  isInitialized: false,
  resources: [],
  resourceType: 'agent',
  resourceTypes: [],
  page: 0,
  itemsPerPage: 12,
  totalItems: 0,
  artifactManager: null,
  schemaAgents: null,
  isConnected: false,
  isConnecting: false,
  isLoggingIn: false,
  isAuthenticated: false,
  isLoggedIn: false,
  selectedResource: null,
  isLoading: false,
  error: null,
  setServer: (server) => set({ server }),
  setUser: (user) => set({ user }),
  setIsInitialized: (isInitialized) => set({ isInitialized }),
  setResources: (resources) => set({ resources }),
  setResourceType: (type) => {
    set({ resourceType: type });
    // Automatically fetch resources when type changes
    get().fetchResources(get().page);
  },
  setResourceTypes: (types) => {
    set((state) => ({
      resourceTypes: types,
      page: 0  // Reset page when filter changes
    }));
  },
  setTotalItems: (total) => set({ totalItems: total }),
  setLoggedIn: (status: boolean) => set({ isLoggedIn: status }),
  setSelectedResource: (resource) => set({ selectedResource: resource }),
  connect: async (config: ConnectionConfig) => {
    if (get().isConnecting || get().isConnected) {
      console.log('Connection attempt skipped: already connecting or connected.');
      return get().server;
    }

    set({ isConnecting: true });

    try {
      const client = hyphaWebsocketClient;
      const server = await client.connectToServer(config);
      
      if (!server) {
        throw new Error('Failed to connect to server');
      }

      const artifactManager = await server.getService('public/artifact-manager');
      const isAuthenticated = !!config.token;
      
      set({
        client,
        server,
        artifactManager,
        isConnected: true,
        isAuthenticated,
        isLoggedIn: isAuthenticated,
        user: server.config.user,
        isInitialized: true
      });

      set({ isConnecting: false });
      return server;
    } catch (error) {
      console.error('Failed to connect to Hypha:', error);
      set({
        client: null,
        server: null,
        artifactManager: null,
        isConnected: false,
        isAuthenticated: false,
        isLoggedIn: false,
        user: null,
        isInitialized: false,
        isConnecting: false
      });
      throw error;
    }
  },
  fetchResources: async (page: number, searchQuery?: string) => {
    try {
      if (page < 1) {
        page = 1;
      }
      console.log('Fetching resources for page:', page, searchQuery);
      const offset = (page - 1) * get().itemsPerPage;
      
      // Construct the base URL
      let url = `${SERVER_URL}/${SITE_ID}/artifacts/agents/children?pagination=true&offset=${offset}&limit=${get().itemsPerPage}`;
      
      // Add type filter if resourceType is specified
      if (get().resourceType) {
        const filters = JSON.stringify({ type: get().resourceType });
        url += `&filters=${encodeURIComponent(filters)}`;
      }
      
      // Add search keywords if there's a search query
      if (searchQuery) {
        const keywords = searchQuery.split(',').map(k => k.trim()).join(',');
        url += `&keywords=${encodeURIComponent(keywords)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      set({ 
        resources: data.items || [],
        totalItems: data.total || 0
      });
    } catch (error) {
      console.error('Error fetching resources:', error);
      set({ 
        resources: [],
        totalItems: 0
      });
    }
  },
  fetchResource: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      
      // Handle both formats: workspace/name or just name
      const [workspace, artifactName] = id.includes('/') 
        ? id.split('/')
        : [SITE_ID, id];
      const url = `${SERVER_URL}/${workspace}/artifacts/${artifactName}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch resource: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(data);
      set({ selectedResource: data, isLoading: false });
    } catch (error) {
      console.error('Error fetching resource:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        selectedResource: null 
      });
    }
  },
  login: async (username: string, password: string) => {
    const state = get();
    
    if (state.isLoggingIn || state.isAuthenticated) {
      return;
    }

    set({ isLoggingIn: true });

    try {
      const client = hyphaWebsocketClient;

      // First step: Get the token through login
      const loginConfig: LoginConfig = {
        server_url: 'https://hypha.aicell.io',
      };

      const token = await client.login(loginConfig);
      if (!token) {
        throw new Error('Login failed - no token received');
      }

      // Use the new connect function with the token
      await get().connect({
        server_url: 'https://hypha.aicell.io',
        token: token
      });

      // Set both isAuthenticated and isLoggedIn to true after successful login
      set({ 
        isAuthenticated: true,
        isLoggedIn: true 
      });

    } catch (error) {
      console.error('Login failed:', error);
      set({ 
        isAuthenticated: false,
        isConnected: false,
        isLoggedIn: false,
        user: null 
      });
      throw error;
    } finally {
      set({ isLoggingIn: false });
    }
  }
}));