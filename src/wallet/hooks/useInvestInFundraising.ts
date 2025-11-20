import { useState } from "react";

import { useTransactionMonitor } from "./useTransactionMonitor";
import { investInProject, getInfoUserInvested } from "../../services/nostromo.service";
import { broadcastTx, fetchTickInfo } from "../../services/rpc.service";
import { useQubicConnect } from "../qubic/QubicConnectContext";

interface InvestmentData {
  indexOfFundraising: number;
  amount: number; // Amount in QU to invest
}

/**
 * Hook for investing in fundraising campaigns
 */
export const useInvestInFundraising = () => {
  const [loadingFundraisingIndex, setLoadingFundraisingIndex] = useState<number | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const { wallet, getSignedTx } = useQubicConnect();
  const { isMonitoring, monitorTransaction } = useTransactionMonitor();

  /**
   * Check if a specific fundraising is currently loading
   */
  const isLoading = (fundraisingIndex: number): boolean => {
    return loadingFundraisingIndex === fundraisingIndex;
  };

  const mutate = async (data: InvestmentData) => {
    if (!wallet?.publicKey) {
      setIsError(true);
      setErrorMessage("Wallet not connected");
      return;
    }

    if (data.amount <= 0) {
      setIsError(true);
      setErrorMessage("Investment amount must be greater than 0");
      return;
    }

    setLoadingFundraisingIndex(data.indexOfFundraising);
    setIsError(false);
    setErrorMessage("");

    try {
      // Get current tick info
      const tickInfo = await fetchTickInfo();
      const targetTick = tickInfo.tick + 10;

      // Create the investment transaction
      const tx = await investInProject(wallet.publicKey, data.indexOfFundraising, data.amount, targetTick);

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

      // Check different possible response formats
      const txId = res?.result?.transactionId || res?.transactionId || res?.result?.id || res?.txId;

      if (res && txId) {
        setTxHash(txId);
        setLoadingFundraisingIndex(null);

        // Monitor transaction with verification
        await monitorTransaction({
          txId: txId,
          targetTick,
          verificationFunction: async (): Promise<boolean> => {
            // Verify investment was recorded by checking user's investment list
            try {
              const currentInvestments = await getInfoUserInvested(wallet.publicKey);
              const investment = currentInvestments.listUserInvested.find(
                (inv) => inv.indexOfFundraising === data.indexOfFundraising,
              );
              return !!(investment && investment.investedAmount >= data.amount);
            } catch (error) {
              return true;
            }
          },
          onSuccess: () => {
            // Success - loading will be cleared
          },
          onError: (error) => {
            setIsError(true);
            setErrorMessage(error);
            setLoadingFundraisingIndex(null);
          },
        });
      } else {
        setLoadingFundraisingIndex(null);
        throw new Error("Failed to broadcast investment transaction");
      }
    } catch (error) {
      setIsError(true);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred");
      setLoadingFundraisingIndex(null);
      throw error;
    }
  };

  return {
    isLoading,
    mutate,
    isError,
    errorMessage,
    txHash,
    isMonitoring,
    loadingFundraisingIndex,
  };
};
