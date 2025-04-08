/**
 * Environment variables accessor utility
 * 
 * This file provides a centralized way to access environment variables in the frontend.
 * All environment variables are validated with fallbacks for improved reliability.
 */

/**
 * Site configuration
 */
export const SITE_ID = process.env.REACT_APP_SITE_ID || 'hypha-agents';
export const SITE_NAME = process.env.REACT_APP_SITE_NAME || 'Hypha Agents';

/**
 * Server configuration
 */
export const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'https://hypha.aicell.io';
export const API_VERSION = process.env.REACT_APP_VERSION || '0.1.0';

/**
 * Returns the base URL for Hypha artifacts
 */
export const getHyphaArtifactBaseUrl = () => {
  return `${SERVER_URL}/${SITE_ID}/artifacts`;
};

/**
 * Returns the base URL for agent artifacts
 */
export const getAgentArtifactsBaseUrl = () => {
  return `${getHyphaArtifactBaseUrl()}/agents`;
};

export default {
  SITE_ID,
  SITE_NAME,
  SERVER_URL,
  API_VERSION,
  getHyphaArtifactBaseUrl,
  getAgentArtifactsBaseUrl,
}; 