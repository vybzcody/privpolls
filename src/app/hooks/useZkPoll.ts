import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { aleoService, stringToField } from "../services/aleoService";
import { createTransaction, waitTransactionConfirmation } from "../core/transaction";
import { toast } from "sonner";

export function useZkPoll() {
  const { connected, address, executeTransaction, transactionStatus, requestRecords } = useWallet();
  const queryClient = useQueryClient();

  /**
   * Create a proposal (public or private)
   */
  const propose = async (
    functionName: string, // 'propose_public' or 'propose_private'
    title: string,
    content: string[],
    isPoll: boolean,
    quorum: number,
    endBlock: number,
    rewardType: number,
    tokenType: number,
    rewardAmount: number
  ) => {
    console.log("[useZkPoll] Propose called. State:", { connected, address: address?.toString(), hasExecute: !!executeTransaction });
    if (!address || !executeTransaction) {
      const msg = !address ? "Address missing" : "Execute function missing";
      console.error("[useZkPoll] Wallet not ready:", msg);
      throw new Error(`Wallet not fully connected: ${msg}`);
    }

    const toastId = toast.loading("Submitting proposal to Aleo...");

    try {
      // Build inputs array for propose_public/propose_private
      const inputs = [
        title,
        `[${content.join(', ')}]`,
        `${isPoll.toString()}`,
        `${quorum}u64`,
        `${endBlock}u32`,
        `${rewardType}u8`,
        `${tokenType}u8`,
        `${rewardAmount}u64`
      ];

      console.log("[useZkPoll] Creating transaction with function:", functionName, "inputs:", inputs);
      const txId = await createTransaction(functionName, inputs, 1000000, executeTransaction, false);

      console.log("[useZkPoll] Transaction created, waiting for confirmation:", txId);
      toast.loading("Waiting for on-chain confirmation...", { id: toastId });
      await waitTransactionConfirmation(txId, undefined, transactionStatus);

      toast.success("Proposal successfully created!", { id: toastId });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      return txId;
    } catch (error: any) {
      console.error("[useZkPoll] Proposal error:", error);
      toast.error(`Proposal failed: ${error.message}`, { id: toastId });
      throw error;
    }
  };

  /**
   * Request a ticket for voting (for PUBLIC polls only)
   */
  const requestTicket = async (proposalId: string) => {
    if (!address || !executeTransaction) {
      console.error("[useZkPoll] Request ticket failed - wallet not connected");
      throw new Error("Wallet not connected");
    }

    const toastId = toast.loading("Requesting voting ticket...");

    try {
      console.log("[useZkPoll] Requesting ticket for proposal:", proposalId);
      const txId = await createTransaction("request_ticket", [proposalId], 200000, executeTransaction, false);

      console.log("[useZkPoll] Ticket request created, waiting for confirmation:", txId);
      toast.loading("Confirming ticket issuance...", { id: toastId });
      await waitTransactionConfirmation(txId, undefined, transactionStatus);

      toast.success("Ticket received! You can now vote.", { id: toastId });
      return txId;
    } catch (error: any) {
      console.error("[useZkPoll] Ticket request error:", error);
      if (error.message.includes("rejected")) {
        toast.error("Ticket request rejected. You may already have a ticket or voting has ended.", { id: toastId });
      } else if (error.message.includes("No response")) {
        toast.error("Wallet connection issue. Please try again.", { id: toastId });
      } else {
        toast.error(`Failed to get ticket: ${error.message}`, { id: toastId });
      }
      throw error;
    }
  };

  /**
   * Issue a ticket to a specific voter (for PRIVATE polls - only proposer can call)
   */
  const issueTicket = async (proposalId: string, voterAddress: string) => {
    if (!address || !executeTransaction) {
      console.error("[useZkPoll] Issue ticket failed - wallet not connected");
      throw new Error("Wallet not connected");
    }

    const toastId = toast.loading("Issuing voting ticket to voter...");

    try {
      console.log("[useZkPoll] Issuing ticket for proposal:", proposalId, "to voter:", voterAddress);
      const txId = await createTransaction("issue_ticket", [proposalId, voterAddress], 200000, executeTransaction, false);

      console.log("[useZkPoll] Ticket issued, waiting for confirmation:", txId);
      toast.loading("Confirming ticket issuance...", { id: toastId });
      await waitTransactionConfirmation(txId, undefined, transactionStatus);

      toast.success("Ticket issued successfully!", { id: toastId });
      return txId;
    } catch (error: any) {
      console.error("[useZkPoll] Issue ticket error:", error);
      if (error.message.includes("rejected")) {
        toast.error("Ticket issuance rejected. Only the proposer can issue tickets.", { id: toastId });
      } else if (error.message.includes("No response")) {
        toast.error("Wallet connection issue. Please try again.", { id: toastId });
      } else {
        toast.error(`Failed to issue ticket: ${error.message}`, { id: toastId });
      }
      throw error;
    }
  };

  /**
   * Vote on a public free poll
   */
  const votePublicFree = async (proposalId: string, agree: boolean) => {
    if (!address || !executeTransaction) {
      console.error("[useZkPoll] Vote failed - wallet not connected");
      throw new Error("Wallet not connected");
    }

    const toastId = toast.loading("Submitting vote...");

    try {
      console.log("[useZkPoll] Voting on public poll:", proposalId, "vote:", agree ? "YES" : "NO");
      const txId = await createTransaction("vote_public_free", [proposalId, agree.toString()], 100000, executeTransaction, false);

      console.log("[useZkPoll] Vote submitted, waiting for confirmation:", txId);
      toast.loading("Recording vote on-chain...", { id: toastId });
      await waitTransactionConfirmation(txId, undefined, transactionStatus);

      toast.success("Vote recorded!", { id: toastId });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      return txId;
    } catch (error: any) {
      console.error("[useZkPoll] Vote error:", error);
      toast.error(`Voting failed: ${error.message}`, { id: toastId });
      throw error;
    }
  };

  /**
   * Vote on a rewarded poll (with Credits reward)
   */
  const votePublicRewardedCredits = async (proposalId: string, agree: boolean) => {
    if (!address || !executeTransaction) {
      console.error("[useZkPoll] Rewarded vote failed - wallet not connected");
      throw new Error("Wallet not connected");
    }

    const toastId = toast.loading("Submitting vote for reward...");

    try {
      console.log("[useZkPoll] Rewarded vote (Credits):", proposalId, "vote:", agree ? "YES" : "NO");
      const txId = await createTransaction("vote_public_rewarded_credits", [proposalId, agree.toString()], 200000, executeTransaction, false);

      console.log("[useZkPoll] Rewarded vote submitted, waiting for confirmation:", txId);
      toast.loading("Processing vote and reward...", { id: toastId });
      await waitTransactionConfirmation(txId, undefined, transactionStatus);

      toast.success("Vote recorded! Reward will be distributed.", { id: toastId });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      return txId;
    } catch (error: any) {
      console.error("[useZkPoll] Rewarded vote error:", error);
      toast.error(`Voting failed: ${error.message}`, { id: toastId });
      throw error;
    }
  };

  /**
   * Vote on a rewarded poll (with USDX reward)
   */
  const votePublicRewardedUsdx = async (proposalId: string, agree: boolean) => {
    if (!address || !executeTransaction) {
      console.error("[useZkPoll] USDX vote failed - wallet not connected");
      throw new Error("Wallet not connected");
    }

    const toastId = toast.loading("Submitting vote for USDX reward...");

    try {
      console.log("[useZkPoll] Rewarded vote (USDX):", proposalId, "vote:", agree ? "YES" : "NO");
      const txId = await createTransaction("vote_public_rewarded_usdx", [proposalId, agree.toString()], 200000, executeTransaction, false);

      console.log("[useZkPoll] USDX vote submitted, waiting for confirmation:", txId);
      toast.loading("Processing vote and reward...", { id: toastId });
      await waitTransactionConfirmation(txId, undefined, transactionStatus);

      toast.success("Vote recorded! USDX reward will be distributed.", { id: toastId });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      return txId;
    } catch (error: any) {
      console.error("[useZkPoll] USDX vote error:", error);
      toast.error(`Voting failed: ${error.message}`, { id: toastId });
      throw error;
    }
  };

  /**
   * Helper to find a ticket for a proposal in the user's records
   */
  const findTicket = async (proposalId: string) => {
    if (!requestRecords) return null;
    try {
      // Fetch all records for our program
      const records = await requestRecords(aleoService.PROGRAM_ID || "zkpowered_polls_app_mvp.aleo", true);
      console.log("[useZkPoll] Fetched records for findTicket:", JSON.stringify(records, null, 2));
      console.log("[useZkPoll] Looking for proposalId:", proposalId);
      
      // Normalize proposalId - keep the full ID with field suffix
      const normalizedProposalId = proposalId.replace(/field$/i, '');
      
      // Find a Ticket record that matches our proposalId and isn't used
      const ticket = records.find((r: any) => {
        console.log("[useZkPoll] Checking record:", JSON.stringify(r, null, 2));
        
        // First check if this is a Ticket record by recordName
        const recordName = r.recordName || '';
        if (recordName !== 'Ticket') {
          console.log("[useZkPoll] Not a Ticket record, skipping");
          return false;
        }
        
        // Handle different wallet response formats
        let plaintext = r.plaintext || r.recordPlaintext;
        
        // If plaintext is an object, check proposal_id directly
        if (plaintext && typeof plaintext === 'object') {
          console.log("[useZkPoll] Record plaintext object:", plaintext);
          const pId = plaintext.proposal_id || plaintext.proposalId;
          if (pId) {
            const pIdStr = String(pId).replace(/field$/i, '').replace(/^0x/, '');
            const checkId = normalizedProposalId.replace(/^0x/, '');
            console.log("[useZkPoll] Comparing proposal IDs:", pIdStr, checkId);
            if (pIdStr === checkId) {
              const isUsed = plaintext.is_used || plaintext.isUsed;
              console.log("[useZkPoll] is_used:", isUsed);
              return isUsed !== true && isUsed !== 'true';
            }
          }
          return false;
        }
        
        // If plaintext is a string - check for exact proposal_id match
        if (plaintext && typeof plaintext === 'string') {
          console.log("[useZkPoll] Record plaintext string:", plaintext);
          
          // Extract proposal_id from the plaintext string
          const proposalIdMatch = plaintext.match(/proposal_id:\s*([0-9a-f]+)field\.private/);
          if (proposalIdMatch) {
            const recordProposalId = proposalIdMatch[1];
            const checkId = normalizedProposalId;
            console.log("[useZkPoll] Extracted proposal_id:", recordProposalId, "looking for:", checkId);
            
            if (recordProposalId === checkId) {
              const notUsed = !plaintext.includes('is_used: true') && !plaintext.includes('is_used:true');
              console.log("[useZkPoll] Proposal matches, notUsed:", notUsed);
              return notUsed;
            }
          }
          return false;
        }
        
        return false;
      });
      
      console.log("[useZkPoll] Found ticket:", ticket);
      return ticket;
    } catch (e) {
      console.error("[useZkPoll] Error finding ticket:", e);
      return null;
    }
  };

  /**
   * Vote on a private poll (requires ticket)
   */
  const votePrivate = async (proposalId: string, agree: boolean) => {
    if (!address || !executeTransaction) {
      console.error("[useZkPoll] Private vote failed - wallet not connected");
      throw new Error("Wallet not connected");
    }

    const toastId = toast.loading("Finding voting ticket...");

    try {
      const ticket = await findTicket(proposalId) as any;
      
      if (!ticket) {
        toast.error("No valid voting ticket found for this proposal.", { id: toastId });
        throw new Error("No ticket found");
      }

      console.log("[useZkPoll] Private vote with ticket:", ticket, "vote:", agree ? "YES" : "NO");

      // Check proposal details before voting
      const proposalInfo = await aleoService.getProposal(proposalId);
      const currentHeight = await aleoService.getLatestHeight();
      console.log("[useZkPoll] Current block height:", currentHeight);
      console.log("[useZkPoll] Proposal info:", proposalInfo);
      
      if (proposalInfo) {
        // Check end_block
        const endBlockMatch = String(proposalInfo).match(/end_block:\s*(\d+)u32/);
        if (endBlockMatch) {
          const endBlock = parseInt(endBlockMatch[1]);
          console.log("[useZkPoll] Proposal end_block:", endBlock);
          if (currentHeight >= endBlock) {
            toast.error(`Voting has ended. Current height: ${currentHeight}, End block: ${endBlock}`, { id: toastId });
            throw new Error(`Voting has ended. Current height: ${currentHeight}, End block: ${endBlock}`);
          }
        }
        
        // Check access_type - only allow private voting for private polls
        const accessTypeMatch = String(proposalInfo).match(/access_type:\s*(\d+)u8/);
        if (accessTypeMatch) {
          const accessType = parseInt(accessTypeMatch[1]);
          console.log("[useZkPoll] Proposal access_type:", accessType);
          if (accessType !== 1) {
            toast.error("This is a PUBLIC poll. Please use public voting instead.", { id: toastId });
            throw new Error("This is a PUBLIC poll. Use vote_public_free instead of private voting.");
          }
        }
      }
      
      toast.loading("Submitting private vote...", { id: toastId });
      
      // Use the raw plaintext directly - the wallet should parse it
      const ticketAny = ticket as any;
      const plaintext = ticketAny.plaintext || ticketAny.recordPlaintext;
      
      let ticketRecord: string;
      
      if (plaintext) {
        if (typeof plaintext === 'string') {
          // Use raw string directly - format is already correct from wallet
          ticketRecord = plaintext;
          console.log("[useZkPoll] Raw plaintext:", ticketRecord);
        } else if (typeof plaintext === 'object') {
          const p = plaintext;
          // Build record with proper format
          ticketRecord = `{
  owner: ${p.owner},
  proposal_id: ${p.proposal_id},
  is_used: ${p.is_used}
}`;
          console.log("[useZkPoll] Built from object:", ticketRecord);
        } else {
          throw new Error("Invalid ticket plaintext format");
        }
      } else {
        throw new Error("No plaintext found in ticket record");
      }
      
      console.log("[useZkPoll] Formatted ticket record:", ticketRecord);
      
      // Try passing the record directly without recordIndices
      const txId = await createTransaction(
        "vote_private", 
        [ticketRecord, agree.toString()], 
        100000, 
        executeTransaction, 
        false
      );

      console.log("[useZkPoll] Private vote submitted, waiting for confirmation:", txId);
      toast.loading("Recording anonymous vote...", { id: toastId });
      await waitTransactionConfirmation(txId, undefined, transactionStatus);

      toast.success("Anonymous vote recorded!", { id: toastId });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      return txId;
    } catch (error: any) {
      console.error("[useZkPoll] Private vote error:", error);
      toast.error(`Voting failed: ${error.message}`, { id: toastId });
      throw error;
    }
  };

  /**
   * Deposit rewards for a proposal
   */
  const depositRewards = async (proposalId: string, amount: number) => {
    if (!address || !executeTransaction) {
      throw new Error("Wallet not connected");
    }

    const toastId = toast.loading("Depositing rewards...");

    try {
      const amountInMicrocredits = amount * 1000000;
      const txId = await createTransaction("deposit_rewards", [proposalId, `${amountInMicrocredits}u64`], 100000, executeTransaction, false);

      toast.loading("Confirming deposit...", { id: toastId });
      await waitTransactionConfirmation(txId, undefined, transactionStatus);

      toast.success("Rewards deposited successfully!", { id: toastId });
      return txId;
    } catch (error: any) {
      console.error("[useZkPoll] Deposit error:", error);
      toast.error(`Deposit failed: ${error.message}`, { id: toastId });
      throw error;
    }
  };

  return {
    propose,
    depositRewards,
    requestTicket,
    votePublicFree,
    votePublicRewardedCredits,
    votePublicRewardedUsdx,
    votePrivate,
    findTicket,
    issueTicket,
    address,
    isConnected: connected
  };
}

export function useProposals() {
  return useQuery({
    queryKey: ['proposals'],
    queryFn: () => aleoService.getAllProposals(),
    refetchInterval: 30000,
  });
}

export function useProposalData(proposalId: string) {
  // Ensure proposalId has 'field' suffix for fetching (but not twice)
  const normalizedId = proposalId?.endsWith('field') ? proposalId : `${proposalId}field`;
  return useQuery({
    queryKey: ['proposal', normalizedId],
    queryFn: () => aleoService.getProposal(normalizedId),
    enabled: !!proposalId
  });
}

export function useVoteStats(proposalId: string) {
  // Ensure proposalId has 'field' suffix for fetching (but not twice)
  const normalizedId = proposalId?.endsWith('field') ? proposalId : `${proposalId}field`;
  return useQuery({
    queryKey: ['votes', normalizedId],
    queryFn: async () => {
      const [agree, disagree] = await Promise.all([
        aleoService.getAgreeVotes(normalizedId),
        aleoService.getDisagreeVotes(normalizedId)
      ]);
      return { agree, disagree, total: agree + disagree };
    },
    enabled: !!proposalId,
    refetchInterval: 15000,
  });
}

export function useHasVoted(proposalId: string, userAddress?: string) {
  const normalizedId = proposalId?.endsWith('field') ? proposalId : `${proposalId}field`;
  return useQuery({
    queryKey: ['hasVoted', normalizedId, userAddress],
    queryFn: async () => {
      if (!userAddress) return false;
      return aleoService.hasVoted(normalizedId, userAddress);
    },
    enabled: !!proposalId && !!userAddress,
  });
}

export interface PollQuestion {
  question: string;
  options: string[];
  numOptions: number;
}

export interface PollVotes {
  option_0: number;
  option_1: number;
  option_2: number;
  option_3: number;
}

export function usePollQuestions(proposalId: string) {
  const normalizedId = proposalId?.endsWith('field') ? proposalId : `${proposalId}field`;
  return useQuery({
    queryKey: ['pollQuestions', normalizedId],
    queryFn: () => aleoService.getPollQuestions(normalizedId),
    enabled: !!proposalId
  });
}

export function usePollVotes(proposalId: string) {
  const normalizedId = proposalId?.endsWith('field') ? proposalId : `${proposalId}field`;
  return useQuery({
    queryKey: ['pollVotes', normalizedId],
    queryFn: () => aleoService.getPollVotes(normalizedId),
    enabled: !!proposalId,
    refetchInterval: 15000,
  });
}

export function usePollVoters(proposalId: string) {
  const normalizedId = proposalId?.endsWith('field') ? proposalId : `${proposalId}field`;
  return useQuery({
    queryKey: ['pollVoters', normalizedId],
    queryFn: () => aleoService.getPollVoters(normalizedId),
    enabled: !!proposalId,
    refetchInterval: 15000,
  });
}
