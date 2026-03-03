import { AleoNetworkClient } from "@provablehq/sdk";
import { PROGRAM_ID } from "../services/aleoService";

const networkClient = new AleoNetworkClient("https://api.provable.com/v2");

/**
 * Polling for transaction status.
 * Handles both Shield wallet transactions and direct Aleo transactions.
 */
export async function waitTransactionConfirmation(
  transactionId: string,
  onProgress?: (msg: string, txId: string) => void,
  getTransactionStatus?: (id: string) => Promise<any>,
  maxRetries: number = 120
) {
  // Ensure transactionId is a string
  let currentTxId = typeof transactionId === 'object'
    ? (transactionId.transactionId || transactionId.id)
    : transactionId;

  if (!currentTxId || typeof currentTxId !== 'string') {
    throw new Error('Invalid transaction ID');
  }

  console.log(`[Transaction] Waiting for confirmation: ${currentTxId}`);

  // Shield wallet transactions start with "shield_" - these need special handling
  const isShieldTx = currentTxId.startsWith('shield_');

  if (isShieldTx) {
    console.log('[Transaction] Shield wallet transaction detected');
    if (onProgress) onProgress('Shield transaction detected, waiting for broadcast...', currentTxId);
  }

  let retries = 0;
  while (retries < maxRetries) {
    try {
      // Priority 1: Use getTransactionStatus if available (most reliable for all wallets)
      if (typeof getTransactionStatus === 'function') {
        console.log(`[Transaction] Checking status via wallet (${retries + 1}/${maxRetries}): ${currentTxId}`);
        const response = await getTransactionStatus(currentTxId);
        const status = response?.status?.toLowerCase();

        console.log(`[Transaction] Wallet status: ${status}`, response);

        // Update ID if the wallet provides the on-chain one
        if (response.transactionId && response.transactionId !== currentTxId) {
          console.log(`[Transaction] Transaction ID bridged: ${currentTxId} -> ${response.transactionId}`);
          currentTxId = response.transactionId;
          if (onProgress) onProgress(`Transaction broadcasted: ${status}`, currentTxId);
        }

        if (status === 'accepted' || status === 'confirmed' || status === 'finalized' || status === 'completed') {
          console.log("[Transaction] Transaction confirmed via wallet:", currentTxId);
          return { ...response, confirmedTransactionId: currentTxId };
        }

        if (status === 'failed' || status === 'rejected' || status === 'error') {
          throw new Error(`Transaction failed with status: ${status}${response.error ? ': ' + response.error : ''}`);
        }
      }
      // Priority 2: Use explorer API (fallback for public transactions)
      else {
        const url = `https://api.explorer.provable.com/v1/testnet/transaction/${currentTxId}`;
        console.log(`[Transaction] Checking via explorer (${retries + 1}/${maxRetries}): ${url}`);

        const response = await fetch(url);

        if (response.ok) {
          const transaction = await response.json();
          console.log("[Transaction] Transaction confirmed via explorer:", currentTxId);
          return { ...transaction, confirmedTransactionId: currentTxId };
        }

        if (response.status !== 404) {
          console.warn(`[Transaction] Unexpected explorer response status: ${response.status}`);
        }
      }

      if (onProgress) onProgress(`Waiting for confirmation... (${retries + 1})`, currentTxId);
    } catch (error: any) {
      console.log(`[Transaction] Error checking status: ${error.message}`);
      // If it's a "failed" status error from wallet, throw it
      if (error.message.includes('Transaction failed')) throw error;
    }

    retries++;
    await new Promise(resolve => setTimeout(resolve, 3000)); // Poll every 3 seconds
  }

  throw new Error(`Transaction confirmation timeout after ${maxRetries * 3} seconds. Transaction ID: ${currentTxId}`);
}

export async function createTransaction(
  functionName: string,
  inputs: string[],
  fee: number,
  executeTransaction: any,
  feePrivate: boolean = false,
  recordIndices?: number[]
) {
  const options = {
    program: PROGRAM_ID,
    function: functionName,
    inputs: inputs,
    fee: fee,
    privateFee: feePrivate,
    ...(recordIndices && { recordIndices })
  };

  console.log("[Transaction] Executing Aleo Transaction:", JSON.stringify(options, null, 2));

  if (!executeTransaction) {
    throw new Error("executeTransaction function is required");
  }

  const result = await executeTransaction(options);

  // Extract transaction ID from result object
  const transactionId = typeof result === 'object'
    ? (result.transactionId || result.id)
    : result;

  console.log("[Transaction] Transaction ID:", transactionId);
  return transactionId;
}
