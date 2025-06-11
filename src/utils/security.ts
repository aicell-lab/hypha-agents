/**
 * Security utilities for agent publishing and sharing
 * 
 * CRITICAL SECURITY RULES:
 * 1. NEVER publish API keys, tokens, or other credentials when sharing agents
 * 2. Always sanitize sensitive data before making it public
 * 3. Use these utilities consistently across all publishing flows
 */

import { AgentSettings, PublicAgentSettings } from './chatCompletion';

// List of sensitive field patterns that should never be published
const SENSITIVE_FIELD_PATTERNS = [
  /api[_-]?key/i,
  /token/i,
  /secret/i,
  /password/i,
  /credential/i,
  /auth/i,
  /bearer/i,
];

// List of sensitive values that should never be published (except known safe ones)
const SAFE_API_KEY_VALUES = [
  'ollama', // Ollama uses 'ollama' as a placeholder API key
  '', // Empty string is safe
];

/**
 * Check if a field name suggests it contains sensitive data
 */
export function isSensitiveFieldName(fieldName: string): boolean {
  return SENSITIVE_FIELD_PATTERNS.some(pattern => pattern.test(fieldName));
}

/**
 * Check if an API key value is potentially sensitive
 */
export function isPotentiallySensitiveApiKey(value: string): boolean {
  if (!value || SAFE_API_KEY_VALUES.includes(value)) {
    return false;
  }
  
  // Check if it looks like a real API key (has some length and complexity)
  return value.length > 8 && /[a-zA-Z]/.test(value) && /[0-9]/.test(value);
}

/**
 * Validate that no sensitive data will be published
 */
export function validateNoSensitiveData(data: any, path: string = 'root'): string[] {
  const violations: string[] = [];
  
  if (typeof data !== 'object' || data === null) {
    return violations;
  }
  
  for (const [key, value] of Object.entries(data)) {
    const currentPath = `${path}.${key}`;
    
    // Check if field name suggests sensitive data
    if (isSensitiveFieldName(key) && typeof value === 'string' && value.length > 0) {
      if (key.toLowerCase().includes('key') && isPotentiallySensitiveApiKey(value)) {
        violations.push(`Potential API key found at ${currentPath}: ${value.substring(0, 8)}...`);
      } else if (!SAFE_API_KEY_VALUES.includes(value)) {
        violations.push(`Sensitive field found at ${currentPath}`);
      }
    }
    
    // Recursively check nested objects
    if (typeof value === 'object' && value !== null) {
      violations.push(...validateNoSensitiveData(value, currentPath));
    }
  }
  
  return violations;
}

/**
 * Sanitize an object by removing all sensitive fields
 */
export function sanitizeObjectForPublishing(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectForPublishing(item));
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive fields entirely
    if (isSensitiveFieldName(key)) {
      continue;
    }
    
    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObjectForPublishing(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Create a safe manifest for agent publishing
 */
export function createSafeAgentManifest(manifest: any): any {
  // First, sanitize the entire manifest
  const sanitized = sanitizeObjectForPublishing(manifest);
  
  // If there's a modelConfig, ensure it's using the sanitized version
  if (sanitized.modelConfig && typeof sanitized.modelConfig === 'object') {
    // Convert to public agent settings format
    const { baseURL, model, temperature } = sanitized.modelConfig;
    sanitized.modelConfig = { baseURL, model, temperature };
  }
  
  // Add security metadata
  sanitized._security = {
    sanitized: true,
    sanitizedAt: new Date().toISOString(),
    version: '1.0',
  };
  
  return sanitized;
}

/**
 * Pre-publish security check - throws error if sensitive data is found
 */
export function performPrePublishSecurityCheck(data: any): void {
  const violations = validateNoSensitiveData(data);
  
  if (violations.length > 0) {
    const errorMessage = `SECURITY VIOLATION: Attempted to publish sensitive data!\n\n` +
      `The following violations were found:\n${violations.map(v => `- ${v}`).join('\n')}\n\n` +
      `Publishing has been blocked to protect your credentials. ` +
      `Please remove all API keys, tokens, and other sensitive data before publishing.`;
    
    throw new Error(errorMessage);
  }
}

/**
 * Console warning for developers
 */
export function logSecurityWarning(context: string): void {
  console.warn(
    `🔒 SECURITY REMINDER [${context}]: ` +
    `Ensure no API keys or sensitive data are included in published agents. ` +
    `Use sanitization functions from src/utils/security.ts`
  );
} 