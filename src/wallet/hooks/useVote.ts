import { create } from "zustand";

import { useTransactionMonitor } from "./useTransactionMonitor";
import { voteInProject, getUserVoteStatus } from "../../services/nostromo.service";
import { broadcastTx, fetchTickInfo } from "../../services/rpc.service";
import { useQubicConnect } from "../qubic/QubicConnectContext";

interface Store {
  loadingProjectIndex: number | null;
  setLoadingProject: (projectIndex: number | null) => void;
  isError: boolean;
  setError: (isError: boolean) => void;
  errorMessage: string;
  setErrorMessage: (errorMessage: string) => void;
  txHash: string;
  setTxHash: (txHash: string) => void;
}

/**
 * Store for managing vote state
 */
const store = create<Store>((set) => ({
  /** Currently loading project index (null if not loading) */
  loadingProjectIndex: null,

  /** Function to update loading project
   * @param projectIndex - Project index being voted on, or null if not loading
   */
  setLoadingProject: (projectIndex: number | null) => set({ loadingProjectIndex: projectIndex }),

  /** Error state */
  isError: false,

  /** Function to update error state
   * @param isError - New error state value
   */
  setError: (isError: boolean) => set({ isError }),

  /** Error message */
  errorMessage: "",

  /** Function to update error message
   * @param errorMessage - New error message value
   */
  setErrorMessage: (errorMessage: string) => set({ errorMessage }),

  /** Transaction hash */
  txHash: "",

  /** Function to update transaction hash
   * @param txHash - New transaction hash value
   */
  setTxHash: (txHash: string) => set({ txHash }),
}));

/**
 * Custom hook for voting on projects in the Nostromo contract.
 *
 * @returns {Object} An object containing the voting state and mutation function
 *
 * @example
 * ```tsx
 * const { isLoading, mutate, isError, errorMessage, txHash, reset } = useVote();
 *
 * const handleVote = async () => {
 *   try {
 *     await mutate({ indexOfProject: 1, decision: true });
 *     console.log('Vote successful!', txHash);
 *   } catch (error) {
 *     console.error('Vote failed:', errorMessage);
 *   }
 * };
 * ```
 */
export const useVote = () => {
  const {
    loadingProjectIndex,
    setLoadingProject,
    isError,
    setError,
    errorMessage,
    setErrorMessage,
    txHash,
    setTxHash,
  } = store();
  const { wallet, getSignedTx } = useQubicConnect();
  const { isMonitoring, monitorTransaction } = useTransactionMonitor();

  /**
   * Executes a vote transaction for a specific project.
   *
   * @param {VoteParams} params - The voting parameters
   * @param {number} params.indexOfProject - The index of the project to vote on
   * @param {boolean} params.decision - The voting decision (true for yes, false for no)
   * @throws {Error} Throws an error if the transaction fails
   */
  const mutate = async (indexOfProject: number, decision: boolean): Promise<void> => {
    if (!wallet?.publicKey) {
      setError(true);
      setErrorMessage("Wallet not connected");
      return;
    }

    setLoadingProject(indexOfProject);
    setError(false);
    setErrorMessage("");

    try {
      // Get current tick info
      const tickInfo = await fetchTickInfo();
      const targetTick = tickInfo.tick + 10; // Add offset

      // Get initial vote status for verification
      const initialVoteStatus = await getUserVoteStatus(wallet.publicKey);
      const initialVotedProjects = initialVoteStatus.numberOfVotedProjects;

      // Create the vote transaction
      const tx = await voteInProject(wallet.publicKey, indexOfProject, decision, targetTick);

      // Sign transaction - handle both WalletConnect and other wallets
      let signedResult;
      if (wallet.connectType === "walletconnect") {
        signedResult = await getSignedTx(tx);
      } else {
        const rawTx = await tx.build("0".repeat(55));
        signedResult = await getSignedTx(rawTx, rawTx.length - 64);
      }

      // Broadcast transaction
      const res = await broadcastTx(signedResult.tx);

      // Check different possible response formats for transaction ID
      const txId = res?.result?.transactionId || res?.transactionId || res?.result?.id || res?.txId;

      if (res && txId) {
        setTxHash(txId);
        setLoadingProject(null);

        // Monitor transaction with verification function
        await monitorTransaction({
          txId: txId,
          targetTick,
          verificationFunction: async () => {
            const currentVoteStatus = await getUserVoteStatus(wallet.publicKey);
            return currentVoteStatus.numberOfVotedProjects > initialVotedProjects;
          },
          onSuccess: () => {
            // Success - loading will be cleared by monitorTransaction
          },
          onError: (error) => {
            setError(true);
            setErrorMessage(error);
            setLoadingProject(null);
          },
        });
      } else {
        setLoadingProject(null);
        throw new Error("Failed to broadcast vote transaction - no transaction ID returned");
      }
    } catch (error) {
      setError(true);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      setErrorMessage(message);
      setLoadingProject(null);
      throw error;
    }
  };

  /**
   * Resets the hook state to initial values.
   * Useful for clearing error states and preparing for a new vote.
   */
  const reset = (): void => {
    setLoadingProject(null);
    setError(false);
    setErrorMessage("");
    setTxHash("");
  };

  /**
   * Check if a specific project is currently loading
   */
  const isLoading = (projectIndex: number): boolean => {
    return loadingProjectIndex === projectIndex || (isMonitoring && loadingProjectIndex === projectIndex);
  };

  return {
    isLoading,
    isError,
    errorMessage,
    txHash,
    reset,
    mutate,
    isMonitoring,
    loadingProjectIndex,
  };
};
