import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  getInfoUserInvested,
  getFundraisingByIndex,
  getProjectByIndex,
  getMaxClaimAmount,
} from "@/services/nostromo.service";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Loader } from "@/shared/components/Loader";
import { Typography } from "@/shared/components/Typography";
import { IInvestInfo, IFundraisingInfo, IProjectInfo } from "@/types";
import { useClaimToken } from "@/wallet/hooks/useClaimToken";
import { uint64ToTokenName } from "@/wallet/qubic/contract/nostromoApi";
import { useQubicConnect } from "@/wallet/qubic/QubicConnectContext";

import styles from "./UserInvestments.module.scss";

interface InvestmentWithDetails extends IInvestInfo {
  fundraisingInfo?: IFundraisingInfo;
  projectInfo?: IProjectInfo;
  maxClaimAmount?: number;
}

/**
 * Component to show user's investments in fundraising campaigns
 */
export const UserInvestments: React.FC = () => {
  const { wallet } = useQubicConnect();
  const navigate = useNavigate();
  const claimToken = useClaimToken();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [investments, setInvestments] = useState<InvestmentWithDetails[]>([]);
  const [error, setError] = useState<string>("");

  const loadUserInvestments = async () => {
    if (!wallet?.publicKey) return;

    setIsLoading(true);
    setError("");

    try {
      // Get user's investment info
      const userInvestments = await getInfoUserInvested(wallet.publicKey);

      const validInvestments = userInvestments.listUserInvested.filter(
        (inv) => inv.investedAmount > 0 || inv.claimedAmount > 0,
      );

      if (validInvestments.length === 0) {
        setInvestments([]);
        setIsLoading(false);
        return;
      }

      // Load details for each investment
      const investmentPromises = validInvestments.map(async (investment): Promise<InvestmentWithDetails> => {
        let fundraisingInfo: IFundraisingInfo | undefined;
        let projectInfo: IProjectInfo | undefined;
        let maxClaimAmount: number | undefined;

        try {
          // Get fundraising details
          fundraisingInfo = await getFundraisingByIndex(investment.indexOfFundraising);

          // Only validate if we got fundraising info - if invalid, we'll still show the investment
          if (fundraisingInfo && fundraisingInfo.indexOfProject > 0 && fundraisingInfo.tokenPrice > 0) {
            // Get project details
            try {
              projectInfo = await getProjectByIndex(fundraisingInfo.indexOfProject);
              // Validate project - if invalid, clear it but continue
              if (projectInfo && projectInfo.tokenName === 0) {
                projectInfo = undefined;
              }
            } catch (error) {
              // Project might not exist - continue without it but still show investment
            }

            // Get max claimable amount
            try {
              maxClaimAmount = await getMaxClaimAmount(wallet.publicKey, investment.indexOfFundraising);
            } catch (error) {
              // Could not get max claim amount - continue without it
            }
          } else {
            // Invalid fundraising - clear it but still show investment
            fundraisingInfo = undefined;
          }
        } catch (error) {
          // If fundraising doesn't exist or can't be loaded, still show the investment with minimal info
          // This handles cases where fundraising might have been deleted or index is wrong
        }

        return {
          ...investment,
          fundraisingInfo,
          projectInfo,
          maxClaimAmount,
        };
      });

      const loadedInvestments = await Promise.all(investmentPromises);
      setInvestments(loadedInvestments);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load investments");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserInvestments();
  }, [wallet?.publicKey]);

  if (!wallet?.publicKey) {
    return (
      <Card>
        <Typography variant="heading" size="medium">
          Your Investments
        </Typography>
        <Typography variant="body">Please connect your wallet to view your investments.</Typography>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <Typography variant="heading" size="medium">
          Your Investments
        </Typography>
        <Loader />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Typography variant="heading" size="medium">
          Your Investments
        </Typography>
        <Typography variant="body" className={styles.error}>
          ❌ Error: {error}
        </Typography>
        <Button caption="Retry" onClick={loadUserInvestments} />
      </Card>
    );
  }

  if (investments.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <Card>
        <Typography variant="heading" size="medium">
          Your Investments
        </Typography>
        <Typography variant="body" className={styles.subtitle}>
          Track your investments and claim available tokens
        </Typography>
      </Card>

      <div className={styles.investments}>
        {investments.map((investment) => (
          <Card key={investment.indexOfFundraising} className={styles.investmentCard}>
            <div className={styles.investmentHeader}>
              <Typography variant="heading" size="medium">
                {investment.projectInfo
                  ? uint64ToTokenName(investment.projectInfo.tokenName)
                  : `Fundraising #${investment.indexOfFundraising}`}
              </Typography>
            </div>

            <div className={styles.investmentDetails}>
              <div className={styles.detail}>
                <Typography variant="label">Total Invested:</Typography>
                <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: "var(--color-primary, #3b82f6)" }}>
                  <Typography variant="body">{investment.investedAmount.toLocaleString()} QU</Typography>
                </span>
              </div>

              {investment.fundraisingInfo && (
                <>
                  <div className={styles.detail}>
                    <Typography variant="label">Tokens Purchased:</Typography>
                    <span style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                      <Typography variant="body">
                        {Math.floor(investment.investedAmount / investment.fundraisingInfo.tokenPrice).toLocaleString()}{" "}
                        tokens
                      </Typography>
                    </span>
                  </div>

                  <div className={styles.detail}>
                    <Typography variant="label">Token Price:</Typography>
                    <Typography variant="body">{investment.fundraisingInfo.tokenPrice} QU per token</Typography>
                  </div>
                </>
              )}

              {investment.claimedAmount > 0 && (
                <div className={styles.detail}>
                  <Typography variant="label">Already Claimed:</Typography>
                  <Typography variant="body">{investment.claimedAmount.toLocaleString()} tokens</Typography>
                </div>
              )}

              {investment.maxClaimAmount !== undefined && investment.maxClaimAmount > 0 && (
                <div
                  className={styles.detail}
                  style={{
                    padding: "1rem",
                    background: "rgba(16, 185, 129, 0.1)",
                    borderRadius: "8px",
                    marginTop: "0.5rem",
                  }}
                >
                  <span style={{ fontWeight: "600", color: "var(--color-success, #10b981)" }}>
                    <Typography variant="label">🎁 Available to Claim:</Typography>
                  </span>
                  <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--color-success, #10b981)" }}>
                    <Typography variant="body">{investment.maxClaimAmount.toLocaleString()} tokens</Typography>
                  </span>
                </div>
              )}

              {investment.fundraisingInfo && (
                <div className={styles.detail}>
                  <Typography variant="label">Token Listing Date:</Typography>
                  <Typography variant="body">
                    {new Date(
                      Date.UTC(
                        investment.fundraisingInfo.listingStartYear + 2000,
                        investment.fundraisingInfo.listingStartMonth - 1,
                        investment.fundraisingInfo.listingStartDay,
                        investment.fundraisingInfo.listingStartHour,
                      ),
                    ).toLocaleString()}
                  </Typography>
                  <div style={{ opacity: 0.8, marginTop: "0.25rem" }}>
                    <Typography variant="body" size="small">
                      Tokens become claimable after this date based on vesting schedule
                    </Typography>
                  </div>
                  {investment.fundraisingInfo.cliffEndYear && (
                    <div style={{ opacity: 0.7, marginTop: "0.25rem" }}>
                      <Typography variant="body" size="small">
                        Cliff ends:{" "}
                        {new Date(
                          Date.UTC(
                            investment.fundraisingInfo.cliffEndYear + 2000,
                            investment.fundraisingInfo.cliffEndMonth - 1,
                            investment.fundraisingInfo.cliffEndDay,
                            investment.fundraisingInfo.cliffEndHour,
                          ),
                        ).toLocaleDateString()}
                      </Typography>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.actions}>
              {investment.maxClaimAmount && investment.maxClaimAmount > 0 && (
                <Button
                  caption={`Claim ${investment.maxClaimAmount.toLocaleString()} Tokens`}
                  variant="solid"
                  color="primary"
                  onClick={async () => {
                    await claimToken.mutate({
                      indexOfFundraising: investment.indexOfFundraising,
                      amount: investment.maxClaimAmount!,
                    });
                    // Refresh investments after claiming
                    await loadUserInvestments();
                  }}
                  isLoading={claimToken.isLoading || claimToken.isMonitoring}
                  disabled={claimToken.isLoading || claimToken.isMonitoring}
                />
              )}

              <Button
                caption="View Details"
                variant="outline"
                color="primary"
                onClick={() => navigate(`/projects/fundraising/${investment.indexOfFundraising}`)}
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Claim Status Messages */}
      {claimToken.isMonitoring && (
        <Card className={styles.statusCard}>
          <Typography variant="body">🔄 Processing token claim transaction...</Typography>
        </Card>
      )}

      {claimToken.isError && (
        <Card className={styles.statusCard}>
          <Typography variant="body" className={styles.error}>
            ❌ Claim Error: {claimToken.errorMessage}
          </Typography>
        </Card>
      )}

      {claimToken.txHash && (
        <Card className={styles.statusCard}>
          <Typography variant="body">✅ Claim transaction submitted! Hash: {claimToken.txHash}</Typography>
        </Card>
      )}
    </div>
  );
};
