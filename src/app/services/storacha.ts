/**
 * Storacha IPFS Service for ZK-Powered Polls
 *
 * Handles IPFS file upload and retrieval using Storacha (Web3.Storage)
 * Enables off-chain storage of poll metadata with on-chain CID commitment
 *
 * Features:
 * - Upload poll metadata (title, description, multi-question structure) to IPFS
 * - Retrieve metadata via decentralized gateways
 * - Fallback mode for development/testing without IPFS
 */

import { create } from '@storacha/client';
import * as Proof from '@storacha/client/proof';
import * as Signer from '@storacha/client/principal/ed25519';
import { StoreMemory } from '@storacha/client/stores/memory';
import { toast } from 'sonner';

// IPFS gateways for redundancy (tried in order)
const IPFS_GATEWAYS = [
  (cid: string) => `https://${cid}.ipfs.storacha.link`,
  (cid: string) => `https://w3s.link/ipfs/${cid}`,
  (cid: string) => `https://ipfs.io/ipfs/${cid}`,
];

/**
 * Poll metadata structure stored on IPFS
 * Supports up to 5 questions with 4 options each
 */
export interface PollMetadata {
  /** Poll title (human-readable) */
  title: string;
  /** Poll description/instructions */
  description: string;
  /** Array of poll questions (1-5) */
  questions: {
    /** Question text */
    question: string;
    /** Available options (2-4) */
    options: string[];
    /** Number of valid options */
    numOptions: number;
  }[];
  /** ISO 8601 timestamp */
  createdAt: string;
  /** Creator's Aleo address */
  creator: string;
  /** Optional: IPFS CID of poll image/cover */
  coverImageCid?: string;
}

/**
 * Validation result for poll metadata
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

class StorachaService {
  private client: any = null;
  private initialized = false;
  private initializationFailed = false;

  /**
   * Check if Storacha is configured and ready
   */
  isConfigured(): boolean {
    const key = import.meta.env.VITE_STORACHA_KEY;
    const proof = import.meta.env.VITE_STORACHA_PROOF;
    const spaceDid = import.meta.env.VITE_STORACHA_SPACE_DID;
    return !!(key && proof && spaceDid);
  }

  /**
   * Check if service is fully initialized
   */
  isReady(): boolean {
    return this.initialized && this.client !== null;
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initializationFailed) {
      throw new Error('Storacha initialization previously failed');
    }

    const key = import.meta.env.VITE_STORACHA_KEY;
    const proof = import.meta.env.VITE_STORACHA_PROOF;
    const spaceDid = import.meta.env.VITE_STORACHA_SPACE_DID;

    if (!key || !proof || !spaceDid) {
      console.warn('[Storacha] Configuration missing. IPFS uploads disabled.');
      console.warn('[Storacha] Set VITE_STORACHA_KEY, VITE_STORACHA_PROOF, VITE_STORACHA_SPACE_DID in .env');
      this.initializationFailed = true;
      return;
    }

    try {
      console.log('[Storacha] Initializing client...');
      const principal = Signer.parse(key);
      const store = new StoreMemory();
      this.client = await create({ principal, store });

      console.log('[Storacha] Parsing proof...');
      const parsedProof = await Proof.parse(proof);
      console.log('[Storacha] Proof parsed, adding space...');
      const space = await this.client.addSpace(parsedProof);
      console.log('[Storacha] Space added:', space.did());
      
      if (spaceDid && space.did() !== spaceDid) {
        console.warn(`[Storacha] Space DID mismatch! .env says ${spaceDid}, but proof is for ${space.did()}`);
      }
      
      await this.client.setCurrentSpace(space.did());

      // Check if space is registered (optional but helpful for debugging)
      try {
        const info = await this.client.capability.space.info(space.did());
        console.log('[Storacha] Space info:', info);
      } catch (e: any) {
        console.warn('[Storacha] Could not fetch space info (this is common if space/info capability is missing):', e.message);
      }

      this.initialized = true;
      console.log('[Storacha] Initialized successfully with space:', space.did());
    } catch (error: any) {
      console.error('[Storacha] Initialization failed:', error.message);
      this.initializationFailed = true;
      throw new Error(`Failed to connect to Storacha: ${error.message}`);
    }
  }

  /**
   * Validate poll metadata before upload
   */
  validateMetadata(metadata: PollMetadata): ValidationResult {
    const errors: string[] = [];

    if (!metadata.title || metadata.title.trim().length === 0) {
      errors.push('Title is required');
    } else if (metadata.title.length > 200) {
      errors.push('Title must be less than 200 characters');
    }

    // Description is optional for simpler poll creation
    // if (!metadata.description || metadata.description.trim().length === 0) {
    //   errors.push('Description is required');
    // }

    if (!metadata.questions || metadata.questions.length === 0) {
      errors.push('At least one question is required');
    } else if (metadata.questions.length > 5) {
      errors.push('Maximum 5 questions allowed');
    }

    metadata.questions.forEach((q, idx) => {
      if (!q.question || q.question.trim().length === 0) {
        errors.push(`Question ${idx + 1} is empty`);
      }
      if (!q.options || q.options.length < 2) {
        errors.push(`Question ${idx + 1} needs at least 2 options`);
      } else if (q.options.length > 4) {
        errors.push(`Question ${idx + 1} has too many options (max 4)`);
      }
      q.options.forEach((opt, optIdx) => {
        if (!opt || opt.trim().length === 0) {
          errors.push(`Question ${idx + 1}, Option ${optIdx + 1} is empty`);
        }
      });
    });

    if (!metadata.creator) {
      errors.push('Creator address is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Upload poll metadata to IPFS
   * @param metadata - Poll metadata object
   * @returns IPFS CID string
   * @throws Error if upload fails or configuration is missing
   */
  async uploadPoll(metadata: PollMetadata): Promise<string> {
    try {
      // Validate metadata before upload
      const validation = this.validateMetadata(metadata);
      if (!validation.valid) {
        throw new Error(`Invalid poll metadata: ${validation.errors.join(', ')}`);
      }

      // Initialize if needed
      if (!this.initialized) {
        await this.initialize();
      }

      // Check if ready
      if (!this.isReady()) {
        const msg = 'Storacha not configured. IPFS uploads require VITE_STORACHA_* environment variables.';
        console.error('[Storacha] Upload failed:', msg);
        throw new Error(msg);
      }

      toast.info('Uploading poll to IPFS...');

      // Convert metadata to JSON blob
      const jsonBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      const file = new File([jsonBlob], 'poll-metadata.json', { type: 'application/json' });

      console.log(`[Storacha] Preparing to upload ${file.size} bytes for poll: "${metadata.title}"`);
      const currentSpace = this.client.currentSpace();
      console.log('[Storacha] Current space:', currentSpace?.did());

      // If we have a mismatch, try to force the correct space if possible
      // but usually the proof-provided space is the only one we can use
      
      const cid = await this.client.uploadFile(file);
      const cidStr = cid.toString();

      toast.success('Poll uploaded to IPFS!');
      console.log('[Storacha] Poll uploaded successfully with CID:', cidStr);

      return cidStr;
    } catch (error: any) {
      console.error('[Storacha] Upload operation failed!');
      console.error('[Storacha] Error Name:', error.name);
      console.error('[Storacha] Error Message:', error.message);
      if (error.stack) console.error('[Storacha] Stack trace:', error.stack);
      
      if (error.message.includes('not configured')) {
        toast.error('IPFS storage not configured. Check .env setup.');
      } else if (error.message.includes('ucan/conclude')) {
        toast.error('Storacha space needs registration or storage quota. Verify your space is verified and active at web3.storage');
        console.error('[Storacha] UCAN Conclude Error: This often means the space has not been registered or verified with an email at web3.storage/dashboard, or it lacks a storage plan.');
      } else {
        toast.error(`Failed to upload to IPFS: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get primary IPFS gateway URL for a CID
   */
  getGatewayUrl(cid: string): string {
    return `https://w3s.link/ipfs/${cid}`;
  }

  /**
   * Fetch poll metadata from IPFS with gateway fallback
   * @param cid - IPFS CID
   * @returns Poll metadata or null if unavailable
   */
  async getPollMetadata(cid: string): Promise<PollMetadata | null> {
    if (!cid || cid.length < 10) {
      console.warn('[Storacha] Invalid CID for metadata fetch:', cid);
      return null;
    }

    // Try each gateway in order
    for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
      try {
        const gatewayUrl = IPFS_GATEWAYS[i](cid);
        console.log(`[Storacha] Fetching from gateway ${i + 1}: ${gatewayUrl}`);
        
        const response = await fetch(gatewayUrl, { 
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000) // 10s timeout
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const metadata = await response.json();
        console.log('[Storacha] Metadata fetched successfully');
        return metadata as PollMetadata;
      } catch (error: any) {
        console.warn(`[Storacha] Gateway ${i + 1} failed:`, error.message);
        if (i === IPFS_GATEWAYS.length - 1) {
          // Last gateway failed
          console.error('[Storacha] All gateways failed for CID:', cid);
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Verify a CID is accessible (ping test)
   */
  async verifyCidAccessible(cid: string): Promise<boolean> {
    try {
      const response = await fetch(IPFS_GATEWAYS[0](cid), { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton export
export const storacha = new StorachaService();
