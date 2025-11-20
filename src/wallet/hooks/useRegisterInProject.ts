import { useState } from "react";

import { useTransactionMonitor } from "./useTransactionMonitor";
import { investInProject, getInfoUserInvested } from "../../services/nostromo.service";
import { broadcastTx, fetchTickInfo } from "../../services/rpc.service";
import { useQubicConnect } from "../qubic/QubicConnectContext";

/**
 *
 * @returns
 */
export const useRegisterInProject = () => {
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const { wallet, getSignedTx } = useQubicConnect();
  const { isMonitoring, monitorTransaction } = useTransactionMonitor();

  const mutate = async (indexOfFundraising: number, amount: number) => {
    if (!wallet?.publicKey) {
      setIsError(true);
      setErrorMessage("Wallet not connected");
      return;
    }

    setLoading(true);
    setIsError(false);
    setErrorMessage("");

    try {
      // Get current tick info
      const tickInfo = await fetchTickInfo();
      const targetTick = tickInfo.tick + 10;

      // Get initial investment info for verification
      const initialInvestments = await getInfoUserInvested(wallet.publicKey);
      const initialInvestmentCount = initialInvestments.listUserInvested.filter((inv) => inv.investedAmount > 0).length;

      console.log(`Investing ${amount} in fundraising ${indexOfFundraising}`);

      // Create the investment transaction
      const tx = await investInProject(wallet.publicKey, indexOfFundraising, amount, targetTick);

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

      if (res && res.result?.transactionId) {
        setTxHash(res.result.transactionId);
        setLoading(false);

        console.log("🔄 Investment transaction broadcast successful. Monitoring for confirmation...");

        // Monitor transaction with verification function
        await monitorTransaction({
          txId: res.result.transactionId,
          targetTick,
          verificationFunction: async () => {
            const currentInvestments = await getInfoUserInvested(wallet.publicKey);
            const currentInvestmentCount = currentInvestments.listUserInvested.filter(
              (inv) => inv.investedAmount > 0,
            ).length;
            return currentInvestmentCount > initialInvestmentCount;
          },
          onSuccess: () => {
            console.log(`🎉 Investment confirmed! Successfully invested in project`);
          },
          onError: (error) => {
            setIsError(true);
            setErrorMessage(error);
          },
        });
      } else {
        throw new Error("Failed to broadcast investment transaction");
      }
    } catch (error) {
      console.error("Error investing in project:", error);
      setIsError(true);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred");
      setLoading(false);
    }
  };

  return {
    isLoading,
    mutate,
    isError,
    errorMessage,
    txHash,
    isMonitoring,
  };
};
