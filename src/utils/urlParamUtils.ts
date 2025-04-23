import { useSearchParams } from 'react-router-dom';

/**
 * Parse the edit parameter from URL (format: workspace/agent-id)
 * @param editParam The edit parameter string from URL
 * @returns Object with workspace and agentId, or null if invalid
 */
export function parseEditParam(editParam: string | null): { workspace: string; agentId: string } | null {
  if (!editParam) return null;
  
  const parts = editParam.split('/');
  if (parts.length === 2) {
    return {
      workspace: parts[0],
      agentId: parts[1]
    };
  }
  
  console.warn('[urlParamUtils] Invalid edit parameter format:', editParam);
  return null;
}

/**
 * Update URL parameters while preserving existing ones
 * @param setSearchParams Function to set search parameters
 * @param paramsToUpdate Object with parameters to update
 */
export function updateUrlParams(
  setSearchParams: ReturnType<typeof useSearchParams>[1], 
  paramsToUpdate: Record<string, string | null>
): void {
  // Create a new URLSearchParams object to preserve all existing parameters
  const newParams = new URLSearchParams(window.location.search);
  
  // Update or remove parameters
  Object.entries(paramsToUpdate).forEach(([key, value]) => {
    if (value === null) {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
  });
  
  // Update URL without reloading the page
  setSearchParams(newParams, { replace: true });
}

/**
 * Get URL parameters as an object
 * @param searchParams URLSearchParams object
 * @returns Object with all parameters
 */
export function getUrlParamsObject(searchParams: URLSearchParams): Record<string, string> {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}
