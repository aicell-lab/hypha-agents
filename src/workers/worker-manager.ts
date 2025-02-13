import { EventEmitter } from 'events';

interface WorkerMessage {
  type: string;
  data: any;
  content?: string;
  attrs?: any;
}

interface Output {
  type: string;
  content: string;
  attrs?: any;
}

interface AppInfo {
  id: string;
  [key: string]: any;
}

interface ExtendedWorker extends Worker {
  kill?: () => void;
  terminated?: boolean;
}

export class PyodideWorker extends EventEmitter {
  private worker: ExtendedWorker;
  private records: Output[] = [];
  private hyphaServices: any[] = [];
  private id: string;
  private appInfo: AppInfo;

  constructor(id: string, info: AppInfo) {
    super();
    this.id = id;
    this.appInfo = info;
    
    const workerPath = new URL('./pyodide-worker.js', import.meta.url);
    this.worker = new Worker(workerPath, { type: 'module' }) as ExtendedWorker;
    
    this.worker.kill = () => {
      this.worker.terminate();
      this.worker.terminated = true;
    };
  }

  async initialize(): Promise<void> {
    // Wait for worker to be ready
    await new Promise(resolve => this.worker.onmessage = () => resolve(true));
  }

  async mountNativeFs(mountPoint: string, dirHandle: FileSystemDirectoryHandle): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        if (e.data.mounted) {
          this.worker.removeEventListener("message", handler);
          resolve(true);
        } else if (e.data.mountError) {
          this.worker.removeEventListener("message", handler);
          reject(new Error(e.data.mountError));
        }
      };
      
      this.worker.addEventListener("message", handler);
      this.worker.postMessage({
        mount: {
          mountPoint,
          dirHandle
        }
      });
    });
  }

  private addToRecord(record: Output) {
    this.records.push(record);
  }

  async runScript(script: string, ioContext?: any): Promise<Output[]> {
    if (this.worker.terminated) {
      throw new Error("Worker already terminated");
    }

    return new Promise((resolve, reject) => {
      this.worker.onerror = e => console.error(e);
      
      const outputs: Output[] = [];
      const handler = (e: MessageEvent) => {
        if (e.data.type !== undefined) {
          if (!ioContext?.skip_record) {
            this.addToRecord(e.data);
          }
          outputs.push(e.data);
          
          if (e.data.type === "service") {
            this.hyphaServices.push(e.data.attrs);
          }

          // Emit output event for real-time updates
          this.emit('output', e.data);
        } 
        else if (e.data.executionDone) {
          this.worker.removeEventListener("message", handler);
          resolve(outputs);
        } 
        else if (e.data.executionError) {
          console.error("Execution Error", e.data.executionError);
          this.worker.removeEventListener("message", handler);
          reject(e.data.executionError);
        }
      };

      this.worker.addEventListener("message", handler);
      
      if (!ioContext?.skip_record) {
        this.addToRecord({ type: 'script', content: script });
      }
      
      this.worker.postMessage({ 
        source: script, 
        io_context: ioContext 
      });
    });
  }

  getLogs(): Output[] {
    return this.records;
  }

  getHyphaServices(): any[] {
    return this.hyphaServices;
  }

  getId(): string {
    return this.id;
  }

  getAppInfo(): AppInfo {
    return this.appInfo;
  }

  terminate() {
    this.worker.kill?.();
    this.removeAllListeners();
  }
}

class WorkerManager extends EventEmitter {
  private static instance: WorkerManager;
  private workers: { [key: string]: PyodideWorker } = {};
  private subscribers: ((workers: any) => void)[] = [];
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private mountPoint: string;

  private constructor(dirHandle?: FileSystemDirectoryHandle, mountPoint: string = "/mnt") {
    super();
    this.dirHandle = dirHandle || null;
    this.mountPoint = mountPoint;
  }

  static getInstance(dirHandle?: FileSystemDirectoryHandle, mountPoint: string = "/mnt"): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager(dirHandle, mountPoint);
    }
    return WorkerManager.instance;
  }

  getDirHandle() {
    return this.dirHandle;
  }

  subscribe(callback: (workers: any) => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  private notify() {
    this.subscribers.forEach(callback => callback(this.getWorkerApps()));
  }

  getWorkerApps() {
    return Object.values(this.workers).map(worker => ({
      id: worker.getId(),
      appInfo: worker.getAppInfo(),
      worker,
      runScript: (script: string, ioContext?: any) => worker.runScript(script, ioContext),
      getLogs: () => worker.getLogs(),
      listHyphaServices: () => worker.getHyphaServices(),
      close: () => this.closeWorker(worker.getId())
    }));
  }

  async createWorker(info: AppInfo): Promise<PyodideWorker> {
    const id = info.id || Math.random().toString(36).substring(7);
    console.log("Creating worker:", id);
    
    const worker = new PyodideWorker(id, info);
    await worker.initialize();
    
    this.workers[id] = worker;
    
    if (this.dirHandle) {
      await worker.mountNativeFs(this.mountPoint, this.dirHandle);
    }
    
    this.notify();
    return worker;
  }

  async closeWorker(id: string) {
    if (this.workers[id]) {
      this.workers[id].terminate();
      delete this.workers[id];
      this.notify();
    }
  }

  getWorker(id: string): PyodideWorker | undefined {
    return this.workers[id];
  }

  // Add method to handle cleanup
  terminate() {
    Object.keys(this.workers).forEach(id => {
      this.closeWorker(id);
    });
    this.removeAllListeners();
  }
}

export default WorkerManager;