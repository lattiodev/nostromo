import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  getFundraisingByIndex,
  getInfoUserInvested,
  getMaxClaimAmount,
  getProjectByIndex,
} from "@/services/nostromo.service";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Fieldset } from "@/shared/components/Fieldset";
import { Loader } from "@/shared/components/Loader";
import { TextInput } from "@/shared/components/TextInput";
import { Typography } from "@/shared/components/Typography";
import { TransactionMonitoringModal } from "@/shared/modals/TransactionMonitoringModal";
import { ErrorPage } from "@/shared/pages/ErrorPage";
import { IFundraisingInfo, IInvestInfo, IProjectInfo } from "@/types";
import {
  canUserInvestInPhase,
  getFundraisingCaps,
  getFundraisingProgress,
  getPhaseInfo,
  scDateToDate,
} from "@/utils/fundraising.utils";
import { useClaimToken } from "@/wallet/hooks/useClaimToken";
import { useContractTier } from "@/wallet/hooks/useContractTier";
import { useInvestInFundraising } from "@/wallet/hooks/useInvestInFundraising";
import { uint64ToTokenName } from "@/wallet/qubic/contract/nostromoApi";
import { useQubicConnect } from "@/wallet/qubic/QubicConnectContext";

import styles from "./FundraisingDetailPage.module.scss";

/**
 * FundraisingDetailPage displays detailed information about a fundraising campaign
 * and allows users to invest or claim tokens
 */
export const FundraisingDetailPage: React.FC = () => {
  const { fundraisingIndex } = useParams<{ fundraisingIndex: string }>();
  const navigate = useNavigate();
  const { wallet } = useQubicConnect();
  const {
    data: { tierLevel },
  } = useContractTier();
  const investInFundraising = useInvestInFundraising();
  const claimToken = useClaimToken();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingInvestment, setIsLoadingInvestment] = useState<boolean>(true);
  const [fundraising, setFundraising] = useState<IFundraisingInfo | null>(null);
  const [project, setProject] = useState<IProjectInfo | null>(null);
  const [userInvestment, setUserInvestment] = useState<IInvestInfo | null>(null);
  const [maxClaimAmount, setMaxClaimAmount] = useState<number>(0);
  const [investAmount, setInvestAmount] = useState<string>("");
  const [claimAmount, setClaimAmount] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [showMonitoringModal, setShowMonitoringModal] = useState<boolean>(false);
  const [monitoringStatus, setMonitoringStatus] = useState<"pending" | "confirming" | "success" | "error">("pending");

  useEffect(() => {
    loadFundraisingData();
  }, [fundraisingIndex, wallet?.publicKey]);

  // Monitor investment transaction status
  useEffect(() => {
    if (investInFundraising.isMonitoring && showMonitoringModal) {
      setMonitoringStatus("confirming");
    } else if (investInFundraising.isError && showMonitoringModal) {
      setMonitoringStatus("error");
    } else if (
      !investInFundraising.isMonitoring &&
      !investInFundraising.isLoading(Number(fundraisingIndex)) &&
      showMonitoringModal &&
      monitoringStatus === "confirming"
    ) {
      // Transaction completed successfully
      setMonitoringStatus("success");
      // Refresh data after a short delay
      setTimeout(async () => {
        await loadFundraisingData();
        setInvestAmount("");
        // Close modal after showing success for a moment
        setTimeout(() => {
          setShowMonitoringModal(false);
        }, 2000);
      }, 1000);
    }
  }, [
    investInFundraising.isMonitoring,
    investInFundraising.isError,
    investInFundraising.isLoading,
    showMonitoringModal,
    monitoringStatus,
    fundraisingIndex,
  ]);

  const loadFundraisingData = async () => {
    if (!fundraisingIndex) return;

    setIsLoading(true);
    setError("");

    try {
      const index = parseInt(fundraisingIndex, 10);
      const fundraisingData = await getFundraisingByIndex(index);

      // Check if fundraising is valid (has a project index)
      if (!fundraisingData || fundraisingData.indexOfProject === 0) {
        // Try to load project by index to see if it exists
        try {
          const projectInfo = await getProjectByIndex(index);
          if (projectInfo && projectInfo.tokenName !== 0) {
            // Project exists but fundraising hasn't been created
            setProject(projectInfo);
            setFundraising(null);
            setError("Fundraising has not been created yet for this project.");
            setIsLoading(false);
            return;
          }
        } catch (error) {
          // Project doesn't exist either
        }
        setError("Fundraising not found. The fundraising campaign you're looking for doesn't exist.");
        setIsLoading(false);
        return;
      }

      // Load project data
      let projectInfo: IProjectInfo | null = null;
      if (fundraisingData.indexOfProject !== 0) {
        try {
          projectInfo = await getProjectByIndex(fundraisingData.indexOfProject);
        } catch (error) {
          // Project might not exist, continue with fundraising data
        }
      }

      setFundraising(fundraisingData);
      setProject(projectInfo);

      // Load user investment data if wallet is connected
      setIsLoadingInvestment(true);
      if (wallet?.publicKey) {
        try {
          const userInvestments = await getInfoUserInvested(wallet.publicKey);

          // Find investment - check for any entry with this fundraising index
          // Show it even if amounts are 0 (might be pending confirmation)
          const investment = userInvestments.listUserInvested.find((inv) => inv.indexOfFundraising === index);

          // Set investment even if amounts are 0 - this way user can see their investment status
          setUserInvestment(investment || null);

          // Get max claimable amount
          if (investment) {
            try {
              const maxClaim = await getMaxClaimAmount(wallet.publicKey, index);
              setMaxClaimAmount(maxClaim);
              setClaimAmount(maxClaim.toString());
            } catch (error) {
              // Error loading max claim amount - continue without it
            }
          }
        } catch (error) {
          // Error loading user investments - continue without investment data
        } finally {
          setIsLoadingInvestment(false);
        }
      } else {
        setIsLoadingInvestment(false);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load fundraising");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvest = async () => {
    if (!fundraising || !wallet?.publicKey || !investAmount) return;

    const amount = parseFloat(investAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid investment amount");
      return;
    }

    const index = parseInt(fundraisingIndex || "0", 10);
    const phaseInfo = getPhaseInfo(fundraising);

    if (!phaseInfo.canInvest) {
      setError("Investment is not available at this time");
      return;
    }

    if (!canUserInvestInPhase(fundraising, tierLevel)) {
      setError(`Your tier level (${tierLevel}) does not allow investment in the current phase`);
      return;
    }

    try {
      setShowMonitoringModal(true);
      setMonitoringStatus("pending");
      setError("");

      await investInFundraising.mutate({
        indexOfFundraising: index,
        amount,
      });

      // The hook will handle monitoring, we'll update status based on hook state
      setMonitoringStatus("confirming");
    } catch (error) {
      setMonitoringStatus("error");
      setError(error instanceof Error ? error.message : "Failed to invest");
    }
  };

  const handleClaim = async () => {
    if (!fundraising || !wallet?.publicKey || !claimAmount) return;

    const amount = parseFloat(claimAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid claim amount");
      return;
    }

    if (amount > maxClaimAmount) {
      setError(`Cannot claim more than ${maxClaimAmount.toLocaleString()} tokens`);
      return;
    }

    const index = parseInt(fundraisingIndex || "0", 10);

    try {
      await claimToken.mutate({
        indexOfFundraising: index,
        amount,
      });
      // Refresh data after claiming
      await loadFundraisingData();
      setClaimAmount("");
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to claim tokens");
    }
  };

  if (isLoading) {
    return <Loader variant="full" size={42} />;
  }

  if (error && !fundraising) {
    return (
      <ErrorPage
        code="404"
        title="Fundraising Not Found"
        description="The fundraising campaign you're looking for doesn't exist."
        actions={[<Button key="home" caption="Return Home" onClick={() => navigate("/")} />]}
      />
    );
  }

  if (!fundraising || !fundraisingIndex) {
    // Check if we have a project but no fundraising
    if (project && project.tokenName !== 0) {
      return (
        <div className={styles.container}>
          <Card>
            <div className={styles.header}>
              <Button caption="← Back" variant="outline" color="primary" onClick={() => navigate("/")} />
              <Typography variant="heading" size="large">
                {uint64ToTokenName(project.tokenName)}
              </Typography>
            </div>
          </Card>

          <Card>
            <Fieldset title="Fundraising Status">
              <div style={{ marginBottom: "1rem" }}>
                <Typography variant="body">⏳ Fundraising has not been created yet for this project.</Typography>
              </div>
              <div style={{ opacity: 0.8 }}>
                <Typography variant="body" size="small">
                  The project exists, but the fundraising campaign has not been started. Please check back later or
                  contact the project creator.
                </Typography>
              </div>
            </Fieldset>
          </Card>
        </div>
      );
    }

    return (
      <ErrorPage
        code="404"
        title="Fundraising Not Found"
        description={error || "The fundraising campaign you're looking for doesn't exist."}
        actions={[<Button key="home" caption="Return Home" onClick={() => navigate("/")} />]}
      />
    );
  }

  const phaseInfo = getPhaseInfo(fundraising);
  const progress = getFundraisingProgress(fundraising);
  const caps = getFundraisingCaps(fundraising);

  return (
    <div className={styles.container}>
      <Card>
        <div className={styles.header}>
          <Button caption="← Back" variant="outline" color="primary" onClick={() => navigate("/")} />
          <Typography variant="heading" size="large">
            {project ? uint64ToTokenName(project.tokenName) : `Fundraising #${fundraisingIndex}`}
          </Typography>
        </div>
      </Card>

      <Card>
        <div className={styles.statusSection}>
          <div className={styles.statusBadge}>
            <Typography variant="heading" size="medium">
              {phaseInfo.label}
            </Typography>
            <Typography variant="body" className={styles.statusDescription}>
              {phaseInfo.description}
            </Typography>
          </div>

          <div className={styles.progressSection}>
            <div className={styles.progressHeader}>
              <Typography variant="label">Fundraising Progress</Typography>
              <Typography variant="body">{progress.toFixed(1)}%</Typography>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <div className={styles.progressDetails}>
              <Typography variant="body" size="small">
                {fundraising.raisedFunds.toLocaleString()} / {fundraising.requiredFunds.toLocaleString()} QU raised
              </Typography>
            </div>
          </div>
        </div>
      </Card>

      <div className={styles.grid}>
        <Card>
          <Fieldset title="📊 Fundraising Details">
            <div className={styles.details}>
              <div className={styles.detail}>
                <Typography variant="label">Token Price:</Typography>
                <Typography variant="body">{fundraising.tokenPrice} QU</Typography>
              </div>

              <div className={styles.detail}>
                <Typography variant="label">Tokens for Sale:</Typography>
                <Typography variant="body">{fundraising.soldAmount.toLocaleString()}</Typography>
              </div>

              <div className={styles.detail}>
                <Typography variant="label">Required Funds:</Typography>
                <Typography variant="body">{fundraising.requiredFunds.toLocaleString()} QU</Typography>
              </div>

              <div className={styles.detail}>
                <Typography variant="label">Raised Funds:</Typography>
                <Typography variant="body">{fundraising.raisedFunds.toLocaleString()} QU</Typography>
              </div>

              <div className={styles.detail}>
                <Typography variant="label">Threshold:</Typography>
                <Typography variant="body">±{fundraising.threshold}%</Typography>
              </div>

              <div className={styles.detail}>
                <Typography variant="label">Min Cap:</Typography>
                <Typography variant="body">{caps.minCap.toLocaleString()} QU</Typography>
              </div>

              <div className={styles.detail}>
                <Typography variant="label">Max Cap:</Typography>
                <Typography variant="body">{caps.maxCap.toLocaleString()} QU</Typography>
              </div>
            </div>
          </Fieldset>
        </Card>

        <Card>
          <Fieldset title="📅 Phase Schedule">
            <div className={styles.schedule}>
              <div className={styles.scheduleItem}>
                <Typography variant="label">Phase 1 (ICO):</Typography>
                <Typography variant="body">
                  {scDateToDate(
                    fundraising.firstPhaseStartYear,
                    fundraising.firstPhaseStartMonth,
                    fundraising.firstPhaseStartDay,
                    fundraising.firstPhaseStartHour,
                  ).toLocaleString()}{" "}
                  -{" "}
                  {scDateToDate(
                    fundraising.firstPhaseEndYear,
                    fundraising.firstPhaseEndMonth,
                    fundraising.firstPhaseEndDay,
                    fundraising.firstPhaseEndHour,
                  ).toLocaleString()}
                </Typography>
                <Typography variant="body" size="small">
                  All tiers can participate
                </Typography>
              </div>

              <div className={styles.scheduleItem}>
                <Typography variant="label">Phase 2 (Public Sale):</Typography>
                <Typography variant="body">
                  {scDateToDate(
                    fundraising.secondPhaseStartYear,
                    fundraising.secondPhaseStartMonth,
                    fundraising.secondPhaseStartDay,
                    fundraising.secondPhaseStartHour,
                  ).toLocaleString()}{" "}
                  -{" "}
                  {scDateToDate(
                    fundraising.secondPhaseEndYear,
                    fundraising.secondPhaseEndMonth,
                    fundraising.secondPhaseEndDay,
                    fundraising.secondPhaseEndHour,
                  ).toLocaleString()}
                </Typography>
                <Typography variant="body" size="small">
                  Tier 4-5 only
                </Typography>
              </div>

              <div className={styles.scheduleItem}>
                <Typography variant="label">Phase 3 (Final Sale):</Typography>
                <Typography variant="body">
                  {scDateToDate(
                    fundraising.thirdPhaseStartYear,
                    fundraising.thirdPhaseStartMonth,
                    fundraising.thirdPhaseStartDay,
                    fundraising.thirdPhaseStartHour,
                  ).toLocaleString()}{" "}
                  -{" "}
                  {scDateToDate(
                    fundraising.thirdPhaseEndYear,
                    fundraising.thirdPhaseEndMonth,
                    fundraising.thirdPhaseEndDay,
                    fundraising.thirdPhaseEndHour,
                  ).toLocaleString()}
                </Typography>
                <Typography variant="body" size="small">
                  Open to all
                </Typography>
              </div>

              <div className={styles.scheduleItem}>
                <Typography variant="label">Token Listing:</Typography>
                <Typography variant="body">
                  {scDateToDate(
                    fundraising.listingStartYear,
                    fundraising.listingStartMonth,
                    fundraising.listingStartDay,
                    fundraising.listingStartHour,
                  ).toLocaleString()}
                </Typography>
              </div>
            </div>
          </Fieldset>
        </Card>
      </div>

      {/* Investment Status Section - Show at top if user has an investment entry (even if 0) */}
      {!isLoadingInvestment && userInvestment && (
        <div style={{ marginBottom: "1.5rem", border: "2px solid var(--color-primary, #3b82f6)", borderRadius: "8px" }}>
          <Card className={styles.actionCard}>
            <Fieldset title="✅ Your Investment">
              <div className={styles.userInvestment}>
                <div
                  className={styles.detail}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <Typography variant="label">Total Invested:</Typography>
                    {userInvestment.investedAmount > 0 ? (
                      <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--color-primary, #3b82f6)" }}>
                        <Typography variant="body">{userInvestment.investedAmount.toLocaleString()} QU</Typography>
                      </span>
                    ) : (
                      <div>
                        <span
                          style={{ fontSize: "1.5rem", fontWeight: "bold", color: "var(--color-warning, #f59e0b)" }}
                        >
                          <Typography variant="body">0 QU</Typography>
                        </span>
                        <div style={{ marginTop: "0.25rem", opacity: 0.8, fontStyle: "italic" }}>
                          <Typography variant="body" size="small">
                            ⏳ Investment transaction may be pending confirmation. Please wait a few minutes and
                            refresh.
                          </Typography>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    caption="View All Investments"
                    variant="outline"
                    color="primary"
                    onClick={() => navigate("/user/settings/investments")}
                  />
                </div>

                {userInvestment.investedAmount > 0 && (
                  <>
                    <div className={styles.detail}>
                      <Typography variant="label">Tokens Purchased:</Typography>
                      <span style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                        <Typography variant="body">
                          {Math.floor(userInvestment.investedAmount / fundraising.tokenPrice).toLocaleString()} tokens
                        </Typography>
                      </span>
                    </div>

                    {phaseInfo.canClaim ? (
                      <div className={styles.detail}>
                        <Typography variant="label">Status:</Typography>
                        <span style={{ color: "var(--color-success, #10b981)", fontWeight: "600" }}>
                          <Typography variant="body">🎁 Tokens are now available to claim!</Typography>
                        </span>
                      </div>
                    ) : (
                      <div className={styles.detail}>
                        <Typography variant="label">Token Claiming Starts:</Typography>
                        <Typography variant="body">
                          {scDateToDate(
                            fundraising.listingStartYear,
                            fundraising.listingStartMonth,
                            fundraising.listingStartDay,
                            fundraising.listingStartHour,
                          ).toLocaleString()}
                        </Typography>
                      </div>
                    )}

                    {userInvestment.claimedAmount > 0 && (
                      <div className={styles.detail}>
                        <Typography variant="label">Already Claimed:</Typography>
                        <Typography variant="body">{userInvestment.claimedAmount.toLocaleString()} tokens</Typography>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Fieldset>
          </Card>
        </div>
      )}

      {/* Investment Form - Always show if phase allows investing, even if user already invested */}
      {isLoadingInvestment ? (
        <div id="invest">
          <Card className={styles.actionCard}>
            <Fieldset title="💰 Invest in Fundraising">
              <Typography variant="body">Loading investment status...</Typography>
            </Fieldset>
          </Card>
        </div>
      ) : phaseInfo.canInvest ? (
        <div id="invest">
          <Card className={styles.actionCard}>
            <Fieldset title="💰 Invest in Fundraising">
              {!wallet?.publicKey ? (
                <Typography variant="body">Please connect your wallet to invest.</Typography>
              ) : !canUserInvestInPhase(fundraising, tierLevel) ? (
                <div>
                  <span style={{ marginBottom: "0.5rem", display: "block" }}>
                    <Typography variant="body">
                      Your tier level ({tierLevel}) does not allow investment in the current phase ({phaseInfo.label}).
                    </Typography>
                  </span>
                  {phaseInfo.phase === "phase2" && (
                    <span style={{ opacity: 0.8, display: "block" }}>
                      <Typography variant="body" size="small">
                        Phase 2 (Public Sale) is only available for Xenomorph (Tier 4) and Warrior (Tier 5) members.
                      </Typography>
                    </span>
                  )}
                </div>
              ) : (
                <>
                  {userInvestment && (
                    <div
                      className={styles.userInvestment}
                      style={{
                        marginBottom: "1rem",
                        padding: "1rem",
                        background: "rgba(59, 130, 246, 0.1)",
                        borderRadius: "8px",
                      }}
                    >
                      <div style={{ marginBottom: "0.5rem" }}>
                        <Typography variant="label">Current Investment:</Typography>
                      </div>
                      {userInvestment.investedAmount > 0 ? (
                        <>
                          <span style={{ fontWeight: "600", fontSize: "1.1rem" }}>
                            <Typography variant="body">{userInvestment.investedAmount.toLocaleString()} QU</Typography>
                          </span>
                          <div style={{ marginTop: "0.25rem", opacity: 0.8 }}>
                            <Typography variant="body" size="small">
                              You can add more to your investment below
                            </Typography>
                          </div>
                        </>
                      ) : (
                        <>
                          <span
                            style={{ fontWeight: "600", fontSize: "1.1rem", color: "var(--color-warning, #f59e0b)" }}
                          >
                            <Typography variant="body">0 QU (Pending)</Typography>
                          </span>
                          <div style={{ marginTop: "0.25rem", opacity: 0.8, fontStyle: "italic" }}>
                            <Typography variant="body" size="small">
                              Your investment transaction is pending. Once confirmed, it will appear here.
                            </Typography>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <TextInput
                    label="Investment Amount (QU)"
                    type="number"
                    value={investAmount}
                    onChange={(e) => setInvestAmount((e.target as HTMLInputElement).value)}
                    placeholder={userInvestment ? "Enter additional amount" : "Enter amount"}
                  />

                  {error && (
                    <Typography variant="body" className={styles.error}>
                      {error}
                    </Typography>
                  )}

                  <Button
                    caption="Invest"
                    variant="solid"
                    color="primary"
                    onClick={handleInvest}
                    isLoading={investInFundraising.isLoading(Number(fundraisingIndex))}
                    disabled={investInFundraising.isLoading(Number(fundraisingIndex))}
                  />
                </>
              )}
            </Fieldset>
          </Card>
        </div>
      ) : null}

      {/* Claim Section - Show if user has investment (even if not claimable yet) */}
      {userInvestment && userInvestment.investedAmount > 0 && (
        <div id="claim">
          <div
            style={{
              marginTop: "1.5rem",
              border:
                phaseInfo.canClaim && maxClaimAmount > 0
                  ? "2px solid var(--color-success, #10b981)"
                  : "2px solid var(--color-warning, #f59e0b)",
              borderRadius: "8px",
            }}
          >
            <Card className={styles.actionCard}>
              <Fieldset title="🎁 Claim Your Tokens">
                {!wallet?.publicKey ? (
                  <Typography variant="body">Please connect your wallet to claim tokens.</Typography>
                ) : isLoadingInvestment ? (
                  <Typography variant="body">Loading claim information...</Typography>
                ) : (
                  <>
                    {!phaseInfo.canClaim ? (
                      // Not yet claimable - show future date
                      <div
                        style={{
                          padding: "1.5rem",
                          background: "rgba(245, 158, 11, 0.1)",
                          borderRadius: "8px",
                          textAlign: "center",
                        }}
                      >
                        <span
                          style={{ marginBottom: "1rem", color: "var(--color-warning, #f59e0b)", display: "block" }}
                        >
                          <Typography variant="heading" size="small">
                            ⏳ Token Claiming Not Yet Available
                          </Typography>
                        </span>
                        <span style={{ marginBottom: "0.5rem", fontWeight: "600", display: "block" }}>
                          <Typography variant="body">You will be able to claim your tokens starting on:</Typography>
                        </span>
                        <span
                          style={{
                            fontSize: "1.2rem",
                            fontWeight: "bold",
                            color: "var(--color-primary, #3b82f6)",
                            marginBottom: "1rem",
                            display: "block",
                          }}
                        >
                          <Typography variant="body">
                            {scDateToDate(
                              fundraising.listingStartYear,
                              fundraising.listingStartMonth,
                              fundraising.listingStartDay,
                              fundraising.listingStartHour,
                            ).toLocaleString()}
                          </Typography>
                        </span>
                        <span style={{ opacity: 0.8, display: "block" }}>
                          <Typography variant="body" size="small">
                            Return to this page after the listing date to claim your tokens. The amount you can claim
                            will be based on the vesting schedule.
                          </Typography>
                        </span>
                      </div>
                    ) : (
                      // Claimable - show claim form
                      <>
                        <div
                          style={{
                            padding: "1rem",
                            background: "rgba(16, 185, 129, 0.1)",
                            borderRadius: "8px",
                            marginBottom: "1rem",
                            textAlign: "center",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: "600",
                              color: "var(--color-success, #10b981)",
                              marginBottom: "0.5rem",
                              display: "block",
                            }}
                          >
                            <Typography variant="body">✅ Tokens are now available to claim!</Typography>
                          </span>
                          <Typography variant="body" size="small">
                            You can claim your tokens below based on the vesting schedule.
                          </Typography>
                        </div>

                        <div className={styles.claimInfo}>
                          <div className={styles.detail}>
                            <Typography variant="label">Your Investment:</Typography>
                            <Typography variant="body">{userInvestment.investedAmount.toLocaleString()} QU</Typography>
                          </div>

                          <div className={styles.detail}>
                            <Typography variant="label">Total Tokens Purchased:</Typography>
                            <span style={{ fontSize: "1.1rem", fontWeight: "600" }}>
                              <Typography variant="body">
                                {Math.floor(userInvestment.investedAmount / fundraising.tokenPrice).toLocaleString()}{" "}
                                tokens
                              </Typography>
                            </span>
                          </div>

                          {userInvestment.claimedAmount > 0 && (
                            <div className={styles.detail}>
                              <Typography variant="label">Already Claimed:</Typography>
                              <Typography variant="body">
                                {userInvestment.claimedAmount.toLocaleString()} tokens
                              </Typography>
                            </div>
                          )}

                          <div
                            className={styles.detail}
                            style={{
                              padding: "1rem",
                              background: maxClaimAmount > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(156, 163, 175, 0.1)",
                              borderRadius: "8px",
                              marginTop: "0.5rem",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: "600",
                                color: maxClaimAmount > 0 ? "var(--color-success, #10b981)" : undefined,
                              }}
                            >
                              <Typography variant="label">Available to Claim:</Typography>
                            </span>
                            {maxClaimAmount > 0 ? (
                              <span
                                style={{
                                  fontSize: "1.2rem",
                                  fontWeight: "bold",
                                  color: "var(--color-success, #10b981)",
                                }}
                              >
                                <Typography variant="body">{maxClaimAmount.toLocaleString()} tokens</Typography>
                              </span>
                            ) : (
                              <span style={{ marginTop: "0.25rem", opacity: 0.8, display: "block" }}>
                                <Typography variant="body" size="small">
                                  Calculating available tokens based on vesting schedule... Please refresh in a moment.
                                </Typography>
                              </span>
                            )}
                          </div>

                          {fundraising.listingStartYear && (
                            <div className={styles.detail}>
                              <Typography variant="label">Token Listing Started:</Typography>
                              <Typography variant="body">
                                {scDateToDate(
                                  fundraising.listingStartYear,
                                  fundraising.listingStartMonth,
                                  fundraising.listingStartDay,
                                  fundraising.listingStartHour,
                                ).toLocaleString()}
                              </Typography>
                            </div>
                          )}
                        </div>

                        {maxClaimAmount > 0 ? (
                          <>
                            <TextInput
                              label="Claim Amount (tokens)"
                              type="number"
                              value={claimAmount}
                              onChange={(e) => setClaimAmount((e.target as HTMLInputElement).value)}
                              placeholder={`Max: ${maxClaimAmount.toLocaleString()} tokens`}
                            />

                            {error && (
                              <Typography variant="body" className={styles.error}>
                                {error}
                              </Typography>
                            )}

                            <Button
                              caption={`Claim ${maxClaimAmount.toLocaleString()} Tokens`}
                              variant="solid"
                              color="primary"
                              onClick={handleClaim}
                              isLoading={claimToken.isLoading || claimToken.isMonitoring}
                              disabled={
                                claimToken.isLoading ||
                                claimToken.isMonitoring ||
                                !claimAmount ||
                                Number(claimAmount) <= 0
                              }
                            />
                          </>
                        ) : (
                          <div
                            style={{
                              padding: "1rem",
                              background: "rgba(156, 163, 175, 0.1)",
                              borderRadius: "8px",
                              marginTop: "1rem",
                            }}
                          >
                            <Typography variant="body" size="small">
                              ⏳ Please wait while we calculate your available tokens based on the vesting schedule.
                              Refresh the page in a moment.
                            </Typography>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </Fieldset>
            </Card>
          </div>
        </div>
      )}

      <TransactionMonitoringModal
        isOpen={showMonitoringModal}
        status={monitoringStatus}
        txHash={investInFundraising.txHash}
        message={investInFundraising.isError ? investInFundraising.errorMessage : undefined}
        onClose={() => {
          if (monitoringStatus === "success" || monitoringStatus === "error") {
            setShowMonitoringModal(false);
          }
        }}
      />

      {investInFundraising.isLoading(Number(fundraisingIndex)) && (
        <Card className={styles.statusCard}>
          <Typography variant="body">🔄 Processing investment transaction...</Typography>
        </Card>
      )}

      {claimToken.isMonitoring && (
        <Card className={styles.statusCard}>
          <Typography variant="body">🔄 Processing token claim transaction...</Typography>
        </Card>
      )}
    </div>
  );
};
