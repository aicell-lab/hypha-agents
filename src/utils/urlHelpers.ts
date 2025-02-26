import { SITE_ID, SERVER_URL } from './env';

/**
 * Resolves a relative URL to a full Hypha artifact URL
 * @param path - The relative path to resolve
 * @param resourceId - The resource ID
 * @returns The full resolved URL
 */
export const resolveHyphaUrl = (path: string, resourceId: string): string => {
  if (!path) return '';
  
  // If the path is already a full URL, return it as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Extract the ID from the full resource ID (removing any prefix like 'elia/')
  const id = resourceId.split('/').pop();
  
  // Construct the full URL
  return `${SERVER_URL}/${SITE_ID}/artifacts/${id}/files/${path}?use_proxy=true`;
};

export function getArtifactFileUrl(id: string, path: string): string {
  return `${SERVER_URL}/${SITE_ID}/artifacts/${id}/files/${path}?use_proxy=true`;
} 