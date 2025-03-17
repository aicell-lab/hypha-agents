/**
 * Get the setup code for initializing the Jupyter environment
 * @param outputId Unique ID for the output area
 * @returns Setup code as a string
 */
export default function getSetupCode(outputId: string): string {
  return `
# Initialize matplotlib for inline plotting
%matplotlib inline
`;
} 