export interface Project {
  id: string;
  manifest: {
    name: string;
    description: string;
    version: string;
    type: string;
    created_at: string;
    filePath?: string;
  };
} 