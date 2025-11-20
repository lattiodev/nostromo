import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { getStats, getFundraisingByIndex, getProjectByIndex } from "@/services/nostromo.service";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Loader } from "@/shared/components/Loader";
import { Typography } from "@/shared/components/Typography";
import { IFundraisingInfo, IProjectInfo } from "@/types";
import { getPhaseInfo, getFundraisingProgress } from "@/utils/fundraising.utils";
import { uint64ToTokenName } from "@/wallet/qubic/contract/nostromoApi";

import styles from "./FundraisingList.module.scss";

interface FundraisingWithProject extends IFundraisingInfo {
  fundraisingIndex: number;
  projectInfo?: IProjectInfo;
}

interface FundraisingListProps {
  readonly title?: string;
  readonly maxFundraisings?: number;
  readonly compact?: boolean;
  readonly showOnlyActive?: boolean; // If true, only show fundraisings in active phases
}

/**
 * Component to display fundraising campaigns using real Nostromo smart contract data
 */
export const FundraisingList: React.FC<FundraisingListProps> = ({
  title = "Fundraisings",
  maxFundraisings,
  compact = false,
  showOnlyActive = false,
}) => {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fundraisings, setFundraisings] = useState<FundraisingWithProject[]>([]);
  const [error, setError] = useState<string>("");

  const loadFundraisings = async () => {
    setIsLoading(true);
    setError("");

    try {
      // Get platform stats to know how many fundraisings exist
      const platformStats = await getStats();
      const numberOfFundraisings = platformStats.numberOfFundraising || 0;

      if (numberOfFundraisings === 0) {
        setFundraisings([]);
        setIsLoading(false);
        return;
      }

      // Determine how many fundraisings to load
      const fundraisingsToLoad = maxFundraisings
        ? Math.min(maxFundraisings, numberOfFundraisings)
        : numberOfFundraisings;

      // Load fundraisings
      const fundraisingPromises: Promise<FundraisingWithProject | null>[] = [];

      for (let i = 0; i < fundraisingsToLoad; i++) {
        fundraisingPromises.push(
          getFundraisingByIndex(i)
            .then(async (fundraising): Promise<FundraisingWithProject | null> => {
              if (fundraising.tokenPrice === 0 || fundraising.indexOfProject === 0) {
                return null; // Skip empty fundraisings
              }

              // Get the associated project info
              let projectInfo: IProjectInfo | undefined;
              try {
                projectInfo = await getProjectByIndex(fundraising.indexOfProject);
              } catch (error) {
                // Project might not exist, continue without it
              }

              // Use utility to check phase
              const phaseInfo = getPhaseInfo(fundraising);
              const isActive = phaseInfo.canInvest;

              // If filtering for active only and this isn't active, skip it
              if (showOnlyActive && !isActive) {
                return null;
              }

              return {
                ...fundraising,
                fundraisingIndex: i,
                projectInfo,
              };
            })
            .catch(() => {
              return null;
            }),
        );
      }

      const loadedFundraisings = await Promise.all(fundraisingPromises);
      const validFundraisings = loadedFundraisings.filter((f): f is FundraisingWithProject => f !== null);

      // If showOnlyActive is true but no active fundraisings found, show all fundraisings
      if (showOnlyActive && validFundraisings.length === 0 && numberOfFundraisings > 0) {
        // Reload without the active filter
        const allFundraisingPromises: Promise<FundraisingWithProject | null>[] = [];
        for (let i = 0; i < fundraisingsToLoad; i++) {
          allFundraisingPromises.push(
            getFundraisingByIndex(i)
              .then(async (fundraising): Promise<FundraisingWithProject | null> => {
                if (fundraising.tokenPrice === 0 || fundraising.indexOfProject === 0) {
                  return null;
                }
                const projectInfo = await getProjectByIndex(fundraising.indexOfProject).catch(() => undefined);
                return {
                  ...fundraising,
                  fundraisingIndex: i,
                  projectInfo,
                };
              })
              .catch(() => null),
          );
        }
        const allFundraisings = await Promise.all(allFundraisingPromises);
        const allValid = allFundraisings.filter((f): f is FundraisingWithProject => f !== null);
        setFundraisings(allValid);
      } else {
        setFundraisings(validFundraisings);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load fundraisings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFundraisings();
  }, [maxFundraisings, showOnlyActive]);

  if (isLoading) {
    return (
      <Card className={compact ? styles.compactCard : undefined}>
        <Typography variant="heading" size={compact ? "medium" : "large"}>
          {title}
        </Typography>
        <Loader />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={compact ? styles.compactCard : undefined}>
        <Typography variant="heading" size={compact ? "medium" : "large"}>
          {title}
        </Typography>
        <Typography variant="body" className={styles.error}>
          ❌ Error: {error}
        </Typography>
      </Card>
    );
  }

  if (fundraisings.length === 0) {
    return null;
  }

  return (
    <div className={compact ? styles.compactContainer : styles.container}>
      {!compact && (
        <Card>
          <Typography variant="heading" size="large">
            {title}
          </Typography>
          <Typography variant="body" className={styles.subtitle}>
            {showOnlyActive ? "Active fundraising campaigns you can participate in" : "All fundraising campaigns"}
          </Typography>
        </Card>
      )}

      <div className={compact ? styles.compactFundraisings : styles.fundraisings}>
        {fundraisings.map((fundraising) => {
          const phaseInfo = getPhaseInfo(fundraising);
          const progress = getFundraisingProgress(fundraising);

          return (
            <Card
              key={fundraising.fundraisingIndex}
              className={compact ? styles.compactFundraisingCard : styles.fundraisingCard}
            >
              <div className={styles.fundraisingHeader}>
                <Typography variant="heading" size={compact ? "small" : "medium"}>
                  {fundraising.projectInfo
                    ? uint64ToTokenName(fundraising.projectInfo.tokenName)
                    : `Fundraising #${fundraising.fundraisingIndex}`}
                </Typography>
                <div className={styles.statusBadge}>{phaseInfo.label}</div>
              </div>

              <div className={styles.fundraisingDetails}>
                <div className={styles.progressBar}>
                  <div className={styles.progressLabel}>
                    <Typography variant="label">Progress:</Typography>
                    <Typography variant="body">{progress.toFixed(1)}%</Typography>
                  </div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                  </div>
                  <div className={styles.progressAmounts}>
                    <Typography variant="body" size="small">
                      {fundraising.raisedFunds.toLocaleString()} / {fundraising.requiredFunds.toLocaleString()} QU
                    </Typography>
                  </div>
                </div>

                <div className={styles.detail}>
                  <Typography variant="label">Token Price:</Typography>
                  <Typography variant="body">{fundraising.tokenPrice} QU</Typography>
                </div>

                <div className={styles.detail}>
                  <Typography variant="label">For Sale:</Typography>
                  <Typography variant="body">{fundraising.soldAmount.toLocaleString()} tokens</Typography>
                </div>

                <div className={styles.detail}>
                  <Typography variant="label">Target:</Typography>
                  <Typography variant="body">{fundraising.requiredFunds.toLocaleString()} QU</Typography>
                </div>

                <div className={styles.detail}>
                  <Typography variant="label">Threshold:</Typography>
                  <Typography variant="body">±{fundraising.threshold}%</Typography>
                </div>
              </div>

              <div className={styles.actions}>
                <Button
                  caption="View Details"
                  variant="outline"
                  color="primary"
                  onClick={() => navigate(`/projects/fundraising/${fundraising.fundraisingIndex}`)}
                />
                {phaseInfo.canInvest && (
                  <Button
                    caption="Invest Now"
                    variant="solid"
                    color="primary"
                    onClick={() => navigate(`/projects/fundraising/${fundraising.fundraisingIndex}#invest`)}
                  />
                )}
                {phaseInfo.canClaim && (
                  <Button
                    caption="Claim Tokens"
                    variant="solid"
                    color="primary"
                    onClick={() => navigate(`/projects/fundraising/${fundraising.fundraisingIndex}#claim`)}
                  />
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {compact && fundraisings.length > 0 && (
        <div className={styles.viewAllSection}>
          <Button
            caption="View All Fundraisings →"
            variant="outline"
            color="primary"
            onClick={() => navigate("/#fundraisings")}
          />
        </div>
      )}
    </div>
  );
};
