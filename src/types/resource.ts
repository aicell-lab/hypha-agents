export interface Author {
  name: string;
  orcid?: string;
  affiliation?: string;
}

export interface Citation {
  text: string;
  doi?: string;
}

export interface ResourceManifest {
  name: string;
  icon?: string;
  tags?: string[];
  description?: string;
  id_emoji?: string;
  version?: string;
  documentation?: string;
  authors?: Author[];
  cite?: Citation[];
  links?: {
    url: string;
    icon?: string;
    label: string;
  }[];
  git_repo?: string;
  license?: string;
  type?: string[];
  covers?: string[];
}

export interface Resource {
  id: string;
  manifest: {
    name: string;
    description: string;
    id_emoji?: string;
    version?: string;
    license?: string;
    documentation?: string;
    git_repo?: string;
    covers?: string[];
    tags?: string[];
    cite?: Array<{
      text: string;
      doi?: string;
    }>;
    authors?: Array<{
      name: string;
      orcid?: string;
      affiliation?: string;
    }>;
    type?: string[];
    welcomeMessage?: string;
    startup_script?: string;
    modelConfig?: {
      baseURL: string;
      apiKey: string;
      model: string;
      temperature: number;
    };
  };
  download_count: number;
  view_count: number;
} 