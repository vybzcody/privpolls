import { AleoNetworkClient, Field } from "@provablehq/sdk";
import { storacha, type PollMetadata } from "./storacha";

// Initialize the network client (testnet)
const networkClient = new AleoNetworkClient("https://api.provable.com/v2");

export const PROGRAM_ID = "zkpowered_polls_app_mvp.aleo";

const FIELD_MODULUS = 8444461749428370424248824938781546531375899335154063827935233455917409239040n;

/**
 * IPFS marker string stored in content[0] to identify IPFS-backed polls
 * The field value is derived from this string
 */
const IPFS_MARKER = "IPFS_POLL";

/**
 * Convert a string to a field element for on-chain storage
 * Strings > 31 bytes are hashed to fit the field
 */
export function stringToField(input: string): string {
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(input);

  if (utf8Bytes.length > 31) {
    // For longer strings, hash to field
    const bytes = new Uint8Array(32);
    bytes.set(utf8Bytes.slice(0, 31));
    return Field.fromBytesLe(bytes).toString();
  }

  const paddedBytes = new Uint8Array(32);
  paddedBytes.set(utf8Bytes);
  return Field.fromBytesLe(paddedBytes).toString();
}

/**
 * Convert a field element back to string
 */
export function fieldToString(fieldStr: string): string {
  if (!fieldStr || !fieldStr.endsWith("field")) return fieldStr;
  try {
    const field = Field.fromString(fieldStr);
    const bytes = field.toBytesLe();
    return new TextDecoder().decode(bytes).replace(/\0/g, '');
  } catch (e) {
    return fieldStr;
  }
}

/**
 * Convert IPFS CID to field elements for on-chain storage
 * Stores CID in title field, marks as IPFS in content[0]
 */
function cidToFields(cid: string): { titleField: string; contentFields: string[] } {
  const titleField = stringToField(cid);
  // Mark as IPFS content with special marker in content[0]
  const contentFields = [
    stringToField(IPFS_MARKER), // Marker to identify IPFS polls
    "0field",
    "0field",
    "0field"
  ];

  return { titleField, contentFields };
}

/**
 * Parse Aleo struct string into a JS object
 */
export function parseAleoStruct(structStr: string): any {
  if (!structStr || typeof structStr !== 'string') return {};
  
  const result: any = {};
  
  // Extract content array
  const contentMatch = structStr.match(/content: \[([\s\S]*?)\]/);
  if (contentMatch) {
    result.content = contentMatch[1].split(',').map(s => s.trim());
  }
  
  // Extract fields with regex
  const titleMatch = structStr.match(/title: ([\w\d]+field)/);
  if (titleMatch) result.title = fieldToString(titleMatch[1]);
  
  const proposerMatch = structStr.match(/proposer: ([\w\d]+)/);
  if (proposerMatch) result.proposer = proposerMatch[1];
  
  const isPollMatch = structStr.match(/is_poll:\s*(true|false)/);
  if (isPollMatch) {
    result.is_poll = isPollMatch[1] === 'true';
    result.isPoll = result.is_poll;
  }
  
  const endBlockMatch = structStr.match(/end_block: (\d+)u32/);
  if (endBlockMatch) {
    result.end_block = parseInt(endBlockMatch[1]);
    result.endBlock = result.end_block;
  }
  
  const rewardTypeMatch = structStr.match(/reward_type: (\d+)u8/);
  if (rewardTypeMatch) {
    result.reward_type = parseInt(rewardTypeMatch[1]);
    result.rewardType = result.reward_type;
  }
  
  const tokenTypeMatch = structStr.match(/token_type: (\d+)u8/);
  if (tokenTypeMatch) {
    result.token_type = parseInt(tokenTypeMatch[1]);
    result.tokenType = result.token_type;
  }
  
  const accessTypeMatch = structStr.match(/access_type: (\d+)u8/);
  if (accessTypeMatch) {
    result.access_type = parseInt(accessTypeMatch[1]);
    result.accessType = result.access_type;
  }

  const rewardAmountMatch = structStr.match(/reward_amount: (\d+)u64/);
  if (rewardAmountMatch) {
    result.reward_amount = parseInt(rewardAmountMatch[1]);
    result.rewardAmount = result.reward_amount;
  }
  
  return result;
}

/**
 * Check if a proposal uses IPFS storage by examining content[0]
 */
export function isIpfsPoll(info: any): boolean {
  if (!info) return false;
  
  // Handle both raw string and parsed object
  let content0: string | undefined;
  if (typeof info === 'string') {
    const match = info.match(/content: \[([\w\d]+field)/);
    if (match) content0 = fieldToString(match[1]);
  } else if (info.content && Array.isArray(info.content)) {
    // If it's a parsed object from parseAleoStruct
    content0 = fieldToString(info.content[0]);
  }
  
  // Also check if content0 itself is the marker string after decoding
  return content0 === IPFS_MARKER || (content0 && content0.includes('IPFS_METADATA'));
}

/**
 * Extract IPFS CID from proposal info title field
 * For linked proposals, extracts the base CID (without _Q{index} suffix)
 */
export function extractCid(info: any): string | null {
  if (!isIpfsPoll(info)) return null;
  
  let title: string | undefined;
  if (typeof info === 'string') {
    const match = info.match(/title: ([\w\d]+field)/);
    if (match) title = fieldToString(match[1]);
  } else {
    title = info.title;
  }
  
  if (!title) return null;

  // For linked proposals (format: CID_Q{index}), extract base CID
  const baseCidMatch = title.match(/^(.+)_Q\d+$/);
  if (baseCidMatch) {
    return baseCidMatch[1];
  }
  return title;
}

export interface ExecuteOptions {
  program: string;
  func: string;
  inputs: string[];
  fee?: number;
}

export interface ExecuteResult {
  transactionId: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export class AleoService {
  private networkClient = networkClient;

  /**
   * Generic mapping value fetcher
   */
  async getMappingValue(mappingName: string, key: string, programId: string = PROGRAM_ID) {
    try {
      const result = await this.networkClient.getProgramMappingValue(programId, mappingName, key);
      return result;
    } catch (error: any) {
      console.warn(`[AleoService] Mapping fetch fail: ${programId}/${mappingName}[${key}]`, error.message);
      return null;
    }
  }

  /**
   * Fetch a proposal from the mapping
   */
  async getProposal(proposalId: string) {
    return this.getMappingValue('proposals', proposalId);
  }

  /**
   * Check if voter has a ticket for a proposal
   */
  async hasTicket(proposalId: string, voterAddress: string): Promise<boolean> {
    // Calculate the key: BHP256::hash_to_field([proposal_id, (voter as group) as field])
    // This is the same logic used in the contract
    const key = `${proposalId}`;
    const result = await this.getMappingValue('voter_has_ticket', key);
    return result === 'true';
  }

  /**
   * Check if voter has voted on a proposal
   */
  async hasVoted(proposalId: string, voterAddress: string): Promise<boolean> {
    const key = `${proposalId}`;
    const result = await this.getMappingValue('voter_has_voted', key);
    return result === 'true';
  }

  /**
   * Get current block height
   */
  async getLatestHeight(): Promise<number> {
    try {
      return await this.networkClient.getLatestHeight();
    } catch (error) {
      console.error("[AleoService] Error fetching height:", error);
      return 15000000; // Safe fallback for current testnet
    }
  }

  /**
   * Fetch all proposals for discovery
   */
  async getAllProposals() {
    try {
      const countResult = await this.getMappingValue('proposals_count', '0u64');
      if (!countResult) return [];
      
      const count = parseInt(String(countResult).replace("u64", ""));
      const proposals = [];
      
      for (let i = 1; i <= count; i++) {
        const idResult = await this.getMappingValue('proposals_index', `${i}u64`);
        if (idResult) {
          const proposalId = String(idResult);
          const infoResult = await this.getMappingValue('proposals', proposalId);
          if (infoResult) {
            proposals.push({
              id: proposalId,
              info: infoResult, // This will be the struct string from Aleo
            });
          }
        }
      }
      return proposals;
    } catch (error) {
      console.error("[AleoService] Error discovery proposals:", error);
      return [];
    }
  }

  /**
   * Fetch agree votes for a proposal
   */
  async getAgreeVotes(proposalId: string) {
    const result = await this.getMappingValue('agree_votes', proposalId);
    return result ? parseInt(String(result).replace("u64", "")) : 0;
  }

  /**
   * Fetch disagree votes for a proposal
   */
  async getDisagreeVotes(proposalId: string) {
    const result = await this.getMappingValue('disagree_votes', proposalId);
    return result ? parseInt(String(result).replace("u64", "")) : 0;
  }

  /**
   * Get poll scores
   */
  async getPollScore(proposalId: string, questionIndex: number, optionIndex: number) {
    const key = `${proposalId}_${questionIndex}_${optionIndex}`; 
    const result = await this.getMappingValue('poll_scores', key);
    return result ? parseInt(String(result).replace("u64", "")) : 0;
  }

  /**
   * Create IPFS poll proposal
   */
  async createIpfsPoll(cid: string): Promise<{ titleField: string; contentFields: string[] }> {
    const { titleField, contentFields } = cidToFields(cid);
    return { titleField, contentFields };
  }

  /**
   * Get poll metadata from IPFS
   * Falls back to on-chain data if IPFS is unavailable
   */
  async getPollMetadata(proposalId: string): Promise<PollMetadata | null> {
    const rawInfo = await this.getProposal(proposalId);
    if (!rawInfo) return null;

    const info = typeof rawInfo === 'string' ? parseAleoStruct(rawInfo) : rawInfo;

    if (isIpfsPoll(info)) {
      const cid = extractCid(info);
      if (cid) {
        try {
          const metadata = await storacha.getPollMetadata(cid);
          if (metadata) {
            console.log('[AleoService] Fetched IPFS metadata for proposal:', proposalId);
            return metadata;
          }
        } catch (error) {
          console.warn('[AleoService] IPFS metadata fetch failed, using on-chain fallback:', error);
        }
      }
    }

    // Fallback: construct basic metadata from on-chain data
    console.log('[AleoService] Using on-chain data fallback for proposal:', proposalId);
    return {
      title: info.title || "Untitled Poll",
      description: info.content && info.content[0] ? fieldToString(info.content[0]) : "No description",
      questions: [],
      createdAt: '',
      creator: info.proposer || ''
    };
  }

  /**
   * Get complete poll data including IPFS metadata and on-chain vote counts
   */
  async getCompletePollData(proposalId: string) {
    const [rawInfo, metadata, agreeVotes, disagreeVotes, currentHeight] = await Promise.all([
      this.getProposal(proposalId),
      this.getPollMetadata(proposalId),
      this.getAgreeVotes(proposalId),
      this.getDisagreeVotes(proposalId),
      this.getLatestHeight()
    ]);

    const info = typeof rawInfo === 'string' ? parseAleoStruct(rawInfo) : rawInfo;

    return {
      id: proposalId,
      info,
      metadata,
      isIpfs: info ? isIpfsPoll(info) : false,
      cid: info ? extractCid(info) : null,
      agreeVotes,
      disagreeVotes,
      currentHeight,
      endBlock: info?.end_block || 0,
      isPoll: info?.is_poll || false,
      accessType: info?.access_type || 0
    };
  }

  /**
   * Get number of questions for a poll
   */
  async getPollNumQuestions(proposalId: string): Promise<number> {
    const result = await this.getMappingValue('poll_questions', proposalId);
    return result ? parseInt(String(result).replace("u8", "")) : 0;
  }

  /**
   * Get questions for a multi-question poll
   */
  async getPollQuestions(proposalId: string): Promise<{ question: string; options: string[]; numOptions: number }[]> {
    try {
      const numQuestions = await this.getPollNumQuestions(proposalId);
      if (numQuestions === 0) return [];

      const questions: { question: string; options: string[]; numOptions: number }[] = [];
      
      for (let i = 0; i < numQuestions && i < 5; i++) {
        const mappingName = `poll_question_${i}`;
        const result = await this.getMappingValue(mappingName, proposalId);
        
        if (result) {
          const str = String(result);
          const questionMatch = str.match(/question:\s*([\w\d]+)field/);
          const options0Match = str.match(/option_0:\s*([\w\d]+)field/);
          const options1Match = str.match(/option_1:\s*([\w\d]+)field/);
          const options2Match = str.match(/option_2:\s*([\w\d]+)field/);
          const options3Match = str.match(/option_3:\s*([\w\d]+)field/);
          const numOptionsMatch = str.match(/num_options:\s*(\d+)u8/);
          
          questions.push({
            question: questionMatch ? fieldToString(questionMatch[1] + "field") : "",
            options: [
              options0Match ? fieldToString(options0Match[1] + "field") : "",
              options1Match ? fieldToString(options1Match[1] + "field") : "",
              options2Match ? fieldToString(options2Match[1] + "field") : "",
              options3Match ? fieldToString(options3Match[1] + "field") : "",
            ],
            numOptions: numOptionsMatch ? parseInt(numOptionsMatch[1]) : 2,
          });
        }
      }
      
      return questions;
    } catch (error) {
      console.error("[AleoService] Error getting poll questions:", error);
      return [];
    }
  }

  /**
   * Get votes for each question in a multi-question poll
   */
  async getPollVotes(proposalId: string): Promise<{ option_0: number; option_1: number; option_2: number; option_3: number }[]> {
    try {
      const numQuestions = await this.getPollNumQuestions(proposalId);
      if (numQuestions === 0) return [];

      const votes: { option_0: number; option_1: number; option_2: number; option_3: number }[] = [];
      
      for (let i = 0; i < numQuestions && i < 5; i++) {
        const mappingName = `poll_votes_q${i}`;
        const result = await this.getMappingValue(mappingName, proposalId);
        
        if (result) {
          const str = String(result);
          const o0Match = str.match(/option_0:\s*(\d+)u64/);
          const o1Match = str.match(/option_1:\s*(\d+)u64/);
          const o2Match = str.match(/option_2:\s*(\d+)u64/);
          const o3Match = str.match(/option_3:\s*(\d+)u64/);
          
          votes.push({
            option_0: o0Match ? parseInt(o0Match[1]) : 0,
            option_1: o1Match ? parseInt(o1Match[1]) : 0,
            option_2: o2Match ? parseInt(o2Match[1]) : 0,
            option_3: o3Match ? parseInt(o3Match[1]) : 0,
          });
        } else {
          votes.push({ option_0: 0, option_1: 0, option_2: 0, option_3: 0 });
        }
      }
      
      return votes;
    } catch (error) {
      console.error("[AleoService] Error getting poll votes:", error);
      return [];
    }
  }

  /**
   * Get total voters count for a multi-question poll
   */
  async getPollVoters(proposalId: string): Promise<number> {
    const result = await this.getMappingValue('poll_total_voters', proposalId);
    return result ? parseInt(String(result).replace("u64", "")) : 0;
  }

  /**
   * Extract base CID from a linked proposal title (format: CID_Q{index})
   * Returns null if not a linked proposal
   */
  extractBaseCid(title: string): string | null {
    if (!title || typeof title !== 'string') return null;
    // Format: {CID}_Q{number}
    const match = title.match(/^(.+)_Q(\d+)$/);
    if (match) {
      return match[1]; // Return the base CID
    }
    return null;
  }

  /**
   * Extract question index from a linked proposal title
   * Returns -1 if not a linked proposal
   */
  extractQuestionIndex(title: string): number {
    if (!title || typeof title !== 'string') return -1;
    const match = title.match(/_Q(\d+)$/);
    if (match) {
      return parseInt(match[1]);
    }
    return -1;
  }

  /**
   * Check if a proposal is part of a linked multi-question poll
   */
  isLinkedProposal(info: any): boolean {
    if (!info) return false;
    const parsed = typeof info === 'string' ? parseAleoStruct(info) : info;
    const title = parsed.title || "";
    return this.extractBaseCid(title) !== null;
  }

  /**
   * Get base CID from proposal info for linked proposals
   */
  getLinkedPollBaseCid(info: any): string | null {
    if (!info) return null;
    const parsed = typeof info === 'string' ? parseAleoStruct(info) : info;
    const title = parsed.title || "";
    return this.extractBaseCid(title);
  }

  /**
   * Fetch all proposals that belong to a linked multi-question poll
   * Groups proposals by their base CID
   */
  async getLinkedPollProposals(baseCid: string): Promise<Array<{
    proposalId: string;
    info: any;
    questionIndex: number;
  }>> {
    try {
      const allProposals = await this.getAllProposals();
      const linkedProposals: Array<{
        proposalId: string;
        info: any;
        questionIndex: number;
      }> = [];

      for (const proposal of allProposals) {
        const parsed = parseAleoStruct(String(proposal.info));
        const title = parsed.title || "";
        const proposalBaseCid = this.extractBaseCid(title);

        if (proposalBaseCid === baseCid) {
          const questionIndex = this.extractQuestionIndex(title);
          linkedProposals.push({
            proposalId: proposal.id,
            info: parsed, // Use parsed info instead of raw string
            questionIndex
          });
        }
      }

      // Sort by question index
      return linkedProposals.sort((a, b) => a.questionIndex - b.questionIndex);
    } catch (error) {
      console.error("[AleoService] Error fetching linked proposals:", error);
      return [];
    }
  }
  /**
   * Get vote counts for a linked proposal (binary YES/NO)
   */
  async getLinkedProposalVotes(proposalId: string): Promise<{ agree: number; disagree: number; total: number }> {
    const [agree, disagree] = await Promise.all([
      this.getAgreeVotes(proposalId),
      this.getDisagreeVotes(proposalId)
    ]);
    return {
      agree,
      disagree,
      total: agree + disagree
    };
  }
}

export const aleoService = new AleoService();
