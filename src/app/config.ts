/**
 * Application Configuration
 * 
 * Centralized configuration management
 */

export interface AppConfig {
  /** Aleo program ID */
  programId: string;
  /** Maximum questions per poll */
  maxQuestions: number;
  /** Maximum options per question */
  maxOptions: number;
}

/**
 * Get environment variable with fallback
 */
function getEnvVar(key: string, fallback: string): string {
  return import.meta.env[key] || fallback;
}

/**
 * Application configuration object
 */
export const config: AppConfig = {
  programId: getEnvVar('VITE_PROGRAM_ID', 'zkpowered_polls_app_mvp.aleo'),
  maxQuestions: 5,
  maxOptions: 4
};
