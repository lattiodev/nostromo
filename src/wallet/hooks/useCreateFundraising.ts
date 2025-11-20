import { useState } from "react";

import { useTransactionMonitor } from "./useTransactionMonitor";
import { createFundraising, getProjectByIndex } from "../../services/nostromo.service";
import { broadcastTx, fetchTickInfo } from "../../services/rpc.service";
import { FundraisingData } from "../qubic/contract/nostromoApi";
import { useQubicConnect } from "../qubic/QubicConnectContext";

interface CreateFundraisingFormData {
  tokenPrice: number;
  soldAmount: number;
  requiredFunds: number;
  indexOfProject: number;

  // Phase 1 (ICO Phase)
  firstPhaseStartDate: Date;
  firstPhaseStartHour: number;
  firstPhaseEndDate: Date;
  firstPhaseEndHour: number;

  // Phase 2 (Public Sale)
  secondPhaseStartDate: Date;
  secondPhaseStartHour: number;
  secondPhaseEndDate: Date;
  secondPhaseEndHour: number;

  // Phase 3 (Final Sale)
  thirdPhaseStartDate: Date;
  thirdPhaseStartHour: number;
  thirdPhaseEndDate: Date;
  thirdPhaseEndHour: number;

  // Token Economics
  listingStartDate: Date;
  listingStartHour: number;
  cliffEndDate: Date;
  cliffEndHour: number;
  vestingEndDate: Date;
  vestingEndHour: number;

  threshold: number;
  TGE: number;
  stepOfVesting: number;
}

/**
 * Hook for creating fundraising campaigns
 */
export const useCreateFundraising = () => {
  const [isLoading, setLoading] = useState<boolean>(false);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const { wallet, getSignedTx } = useQubicConnect();
  const { isMonitoring, monitorTransaction } = useTransactionMonitor();

  const mutate = async (data: CreateFundraisingFormData, onSuccess?: (projectIndex: number) => void) => {
    if (!wallet?.publicKey) {
      setIsError(true);
      setErrorMessage("Wallet not connected");
      return;
    }

    setLoading(true);
    setIsError(false);
    setErrorMessage("");

    try {
      console.log("Creating fundraising with data:", data);

      // Get current tick info
      const tickInfo = await fetchTickInfo();
      const targetTick = tickInfo.tick + 10;

      // Convert form data to the format expected by the smart contract
      const fundraisingData: FundraisingData = {
        tokenPrice: data.tokenPrice,
        soldAmount: data.soldAmount,
        requiredFunds: data.requiredFunds,
        indexOfProject: data.indexOfProject,

        // Phase 1 dates (send year - 2000 like integration scripts)
        firstPhaseStartYear: data.firstPhaseStartDate.getUTCFullYear() - 2000,
        firstPhaseStartMonth: data.firstPhaseStartDate.getUTCMonth() + 1,
        firstPhaseStartDay: data.firstPhaseStartDate.getUTCDate(),
        firstPhaseStartHour: data.firstPhaseStartHour,
        firstPhaseEndYear: data.firstPhaseEndDate.getUTCFullYear() - 2000,
        firstPhaseEndMonth: data.firstPhaseEndDate.getUTCMonth() + 1,
        firstPhaseEndDay: data.firstPhaseEndDate.getUTCDate(),
        firstPhaseEndHour: data.firstPhaseEndHour,

        // Phase 2 dates
        secondPhaseStartYear: data.secondPhaseStartDate.getUTCFullYear() - 2000,
        secondPhaseStartMonth: data.secondPhaseStartDate.getUTCMonth() + 1,
        secondPhaseStartDay: data.secondPhaseStartDate.getUTCDate(),
        secondPhaseStartHour: data.secondPhaseStartHour,
        secondPhaseEndYear: data.secondPhaseEndDate.getUTCFullYear() - 2000,
        secondPhaseEndMonth: data.secondPhaseEndDate.getUTCMonth() + 1,
        secondPhaseEndDay: data.secondPhaseEndDate.getUTCDate(),
        secondPhaseEndHour: data.secondPhaseEndHour,

        // Phase 3 dates
        thirdPhaseStartYear: data.thirdPhaseStartDate.getUTCFullYear() - 2000,
        thirdPhaseStartMonth: data.thirdPhaseStartDate.getUTCMonth() + 1,
        thirdPhaseStartDay: data.thirdPhaseStartDate.getUTCDate(),
        thirdPhaseStartHour: data.thirdPhaseStartHour,
        thirdPhaseEndYear: data.thirdPhaseEndDate.getUTCFullYear() - 2000,
        thirdPhaseEndMonth: data.thirdPhaseEndDate.getUTCMonth() + 1,
        thirdPhaseEndDay: data.thirdPhaseEndDate.getUTCDate(),
        thirdPhaseEndHour: data.thirdPhaseEndHour,

        // Token economics dates
        listingStartYear: data.listingStartDate.getUTCFullYear() - 2000,
        listingStartMonth: data.listingStartDate.getUTCMonth() + 1,
        listingStartDay: data.listingStartDate.getUTCDate(),
        listingStartHour: data.listingStartHour,
        cliffEndYear: data.cliffEndDate.getUTCFullYear() - 2000,
        cliffEndMonth: data.cliffEndDate.getUTCMonth() + 1,
        cliffEndDay: data.cliffEndDate.getUTCDate(),
        cliffEndHour: data.cliffEndHour,
        vestingEndYear: data.vestingEndDate.getUTCFullYear() - 2000,
        vestingEndMonth: data.vestingEndDate.getUTCMonth() + 1,
        vestingEndDay: data.vestingEndDate.getUTCDate(),
        vestingEndHour: data.vestingEndHour,

        // Token economics - clamp values to SC constraints before encoding
        // SC constraints: threshold <= 50, TGE <= 50, stepOfVesting > 0 && <= 12
        threshold: Math.min(Math.max(data.threshold, 1), 50),
        TGE: Math.min(Math.max(data.TGE, 1), 50),
        stepOfVesting: Math.min(Math.max(data.stepOfVesting, 1), 12),
      };

      console.log("🚀 Converted fundraising data:", fundraisingData);

      // Debug: Log the exact payload structure
      console.log("🔍 Payload structure check:");
      console.log("- tokenPrice:", fundraisingData.tokenPrice, "(should be uint64)");
      console.log("- soldAmount:", fundraisingData.soldAmount, "(should be uint64)");
      console.log("- requiredFunds:", fundraisingData.requiredFunds, "(should be uint64)");
      console.log("- indexOfProject:", fundraisingData.indexOfProject, "(should be uint32)");
      console.log("- firstPhaseStartYear:", fundraisingData.firstPhaseStartYear, "(should be uint32)");
      console.log("- threshold:", fundraisingData.threshold, "(should be uint8, clamped to 1-50)");
      console.log("- TGE:", fundraisingData.TGE, "(should be uint8, clamped to 1-50)");
      console.log("- stepOfVesting:", fundraisingData.stepOfVesting, "(should be uint8, clamped to 1-12)");

      // Validate SC constraints one more time before encoding
      if (fundraisingData.threshold < 1 || fundraisingData.threshold > 50) {
        throw new Error(`Invalid threshold: ${fundraisingData.threshold}. Must be between 1 and 50 (SC constraint)`);
      }
      if (fundraisingData.TGE < 1 || fundraisingData.TGE > 50) {
        throw new Error(`Invalid TGE: ${fundraisingData.TGE}. Must be between 1 and 50 (SC constraint)`);
      }
      if (fundraisingData.stepOfVesting < 1 || fundraisingData.stepOfVesting > 12) {
        throw new Error(
          `Invalid stepOfVesting: ${fundraisingData.stepOfVesting}. Must be between 1 and 12 (SC constraint)`,
        );
      }
      console.log("📅 Dates being sent to contract:");
      console.log(
        "- Phase 3 End:",
        `${fundraisingData.thirdPhaseEndYear + 2000}/${fundraisingData.thirdPhaseEndMonth}/${fundraisingData.thirdPhaseEndDay} ${fundraisingData.thirdPhaseEndHour}:00 UTC`,
      );
      console.log(
        "- Listing Start:",
        `${fundraisingData.listingStartYear + 2000}/${fundraisingData.listingStartMonth}/${fundraisingData.listingStartDay} ${fundraisingData.listingStartHour}:00 UTC`,
      );
      console.log(
        "- Cliff End:",
        `${fundraisingData.cliffEndYear + 2000}/${fundraisingData.cliffEndMonth}/${fundraisingData.cliffEndDay} ${fundraisingData.cliffEndHour}:00 UTC`,
      );
      console.log(
        "- Vesting End:",
        `${fundraisingData.vestingEndYear + 2000}/${fundraisingData.vestingEndMonth}/${fundraisingData.vestingEndDay} ${fundraisingData.vestingEndHour}:00 UTC`,
      );

      // Create the fundraising transaction
      const tx = await createFundraising(
        wallet.publicKey,
        fundraisingData.tokenPrice,
        fundraisingData.soldAmount,
        fundraisingData.requiredFunds,
        fundraisingData.indexOfProject,
        fundraisingData.firstPhaseStartYear,
        fundraisingData.firstPhaseStartMonth,
        fundraisingData.firstPhaseStartDay,
        fundraisingData.firstPhaseStartHour,
        fundraisingData.firstPhaseEndYear,
        fundraisingData.firstPhaseEndMonth,
        fundraisingData.firstPhaseEndDay,
        fundraisingData.firstPhaseEndHour,
        fundraisingData.secondPhaseStartYear,
        fundraisingData.secondPhaseStartMonth,
        fundraisingData.secondPhaseStartDay,
        fundraisingData.secondPhaseStartHour,
        fundraisingData.secondPhaseEndYear,
        fundraisingData.secondPhaseEndMonth,
        fundraisingData.secondPhaseEndDay,
        fundraisingData.secondPhaseEndHour,
        fundraisingData.thirdPhaseStartYear,
        fundraisingData.thirdPhaseStartMonth,
        fundraisingData.thirdPhaseStartDay,
        fundraisingData.thirdPhaseStartHour,
        fundraisingData.thirdPhaseEndYear,
        fundraisingData.thirdPhaseEndMonth,
        fundraisingData.thirdPhaseEndDay,
        fundraisingData.thirdPhaseEndHour,
        fundraisingData.listingStartYear,
        fundraisingData.listingStartMonth,
        fundraisingData.listingStartDay,
        fundraisingData.listingStartHour,
        fundraisingData.cliffEndYear,
        fundraisingData.cliffEndMonth,
        fundraisingData.cliffEndDay,
        fundraisingData.cliffEndHour,
        fundraisingData.vestingEndYear,
        fundraisingData.vestingEndMonth,
        fundraisingData.vestingEndDay,
        fundraisingData.vestingEndHour,
        fundraisingData.threshold,
        fundraisingData.TGE,
        fundraisingData.stepOfVesting,
        targetTick,
      );

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
      console.log("📡 Full broadcast response:", res);

      // Check different possible response formats
      const txId = res?.result?.transactionId || res?.transactionId || res?.result?.id || res?.txId;
      console.log("📡 Found transaction ID:", txId);

      if (res && txId) {
        setTxHash(txId);
        setLoading(false);

        console.log("🔄 Fundraising creation transaction broadcast successful. Monitoring for confirmation...");

        // Monitor transaction
        await monitorTransaction({
          txId: txId,
          targetTick,
          verificationFunction: async () => {
            try {
              // Check if the project now has a fundraising created
              const projectInfo = await getProjectByIndex(data.indexOfProject);
              console.log(`🔍 Verifying fundraising creation for project ${data.indexOfProject}:`, projectInfo);
              return projectInfo.isCreatedFundarasing === true;
            } catch (error) {
              console.error("Error verifying fundraising creation:", error);
              return false;
            }
          },
          onSuccess: () => {
            console.log(
              `🎉 Fundraising creation confirmed! Successfully created fundraising for project ${data.indexOfProject}`,
            );
            // Call the success callback if provided
            if (onSuccess) {
              onSuccess(data.indexOfProject);
            }
          },
          onError: (error) => {
            setIsError(true);
            setErrorMessage(error);
          },
        });
      } else {
        throw new Error("Failed to broadcast fundraising creation transaction");
      }
    } catch (error) {
      console.error("Error creating fundraising:", error);
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
