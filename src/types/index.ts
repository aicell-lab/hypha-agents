export interface Resource {
  id: string;
  name: string;
  description: string;
  tags: string[];
  config: any;
  type: string;
  created_at: number;
  last_modified: number;
  manifest: {
    name: string;
    authors?: string[];
    license?: string;
    version?: string;
    description: string;
    icon?: string;
    id_emoji?: string;
    tags?: string[];
    badges?: Badge[];
    covers?: string[];
    type?: string;
    documentation?: string;
  };
}

export interface Badge {
  url: string;
  icon?: string;
  label: string;
} 