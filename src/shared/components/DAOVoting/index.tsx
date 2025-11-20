import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  getFundraisingIndexByProjectIndex,
  getStats,
  getProjectByIndex,
  getUserVoteStatus,
} from "@/services/nostromo.service";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Loader } from "@/shared/components/Loader";
import { Typography } from "@/shared/components/Typography";
import { INostromoStats, IProjectInfo } from "@/types";
import { getCachedFundraisingIndex } from "@/utils/fundraising.utils";
import { useVote } from "@/wallet/hooks/useVote";
import { uint64ToTokenName } from "@/wallet/qubic/contract/nostromoApi";
import { useQubicConnect } from "@/wallet/qubic/QubicConnectContext";

import styles from "./DAOVoting.module.scss";

interface ProjectWithDetails extends IProjectInfo {
  projectIndex: number;
  hasUserVoted: boolean;
  fundraisingIndex?: number;
}

interface DAOVotingProps {
  readonly title?: string;
  readonly showStats?: boolean;
  readonly showRefresh?: boolean;
  readonly filterByUser?: boolean; // If true, only show projects created by current user
  readonly maxProjects?: number; // Limit number of projects shown
  readonly compact?: boolean; // Compact view for embedding
}

/**
 * Reusable DAO Voting Component
 * Can be used in launchpad, user settings, or as standalone page
 */
export const DAOVoting: React.FC<DAOVotingProps> = ({
  title = "DAO Voting",
  showStats = true,
  showRefresh = true,
  filterByUser = false,
  maxProjects,
  compact = false,
}) => {
  const { wallet } = useQubicConnect();
  const navigate = useNavigate();
  const vote = useVote();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [stats, setStats] = useState<INostromoStats | null>(null);
  const [error, setError] = useState<string>("");

  const loadProjectsForVoting = async () => {
    if (!wallet?.publicKey) return;

    setIsLoading(true);
    setError("");

    try {
      // Get platform stats to know how many projects exist
      const platformStats = await getStats();
      if (showStats) {
        setStats(platformStats);
      }

      // Get user's voting history
      const userVoteStatus = await getUserVoteStatus(wallet.publicKey);
      // Ensure we have a valid array and only use the actual voted projects
      const votedProjectIndices = Array.isArray(userVoteStatus.projectIndexList)
        ? userVoteStatus.projectIndexList.slice(0, userVoteStatus.numberOfVotedProjects)
        : [];

      // Load projects for voting
      const projectPromises: Promise<ProjectWithDetails | null>[] = [];
      const numberOfProjects = platformStats.numberOfCreatedProject || 0;

      // Determine how many projects to load
      const projectsToLoad = maxProjects ? Math.min(maxProjects, numberOfProjects) : numberOfProjects;

      for (let i = 0; i < projectsToLoad; i++) {
        projectPromises.push(
          (async (): Promise<ProjectWithDetails | null> => {
            try {
              const project = await getProjectByIndex(i);
              if (project.tokenName === 0) {
                return null; // Skip empty projects
              }

              // If filtering by user, only show projects created by current user
              if (filterByUser && project.creator !== wallet.publicKey) {
                return null;
              }

              const hasUserVoted = votedProjectIndices.includes(i);

              // If fundraising is created, find the fundraising index
              let fundraisingIndex: number | undefined;
              if (project.isCreatedFundarasing) {
                try {
                  fundraisingIndex = await getCachedFundraisingIndex(i, getFundraisingIndexByProjectIndex);
                  if (fundraisingIndex < 0) {
                    fundraisingIndex = undefined;
                  }
                } catch (error) {
                  // Failed to find fundraising index, continue without it
                }
              }

              return {
                ...project,
                projectIndex: i,
                hasUserVoted,
                fundraisingIndex,
              };
            } catch {
              return null;
            }
          })(),
        );
      }

      const loadedProjects = await Promise.all(projectPromises);
      const validProjects = loadedProjects.filter((p): p is ProjectWithDetails => p !== null);

      setProjects(validProjects);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjectsForVoting();
  }, [wallet?.publicKey, filterByUser, maxProjects]);

  const handleVote = async (projectIndex: number, decision: boolean) => {
    try {
      await vote.mutate(projectIndex, decision);
      // Wait a moment for blockchain to update, then refresh
      setTimeout(async () => {
        await loadProjectsForVoting();
      }, 2000); // 2 second delay
    } catch (error) {
      // Vote failed - error is handled by the hook
    }
  };

  const handleRefresh = () => {
    loadProjectsForVoting();
  };

  if (!wallet?.publicKey) {
    return (
      <Card className={compact ? styles.compactCard : undefined}>
        <Typography variant="heading" size={compact ? "medium" : "large"}>
          {title}
        </Typography>
        <Typography variant="body">Please connect your wallet to view DAO voting.</Typography>
      </Card>
    );
  }

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
        {showRefresh && <Button caption="Retry" onClick={handleRefresh} />}
      </Card>
    );
  }

  if (projects.length === 0) {
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
            Vote on projects to approve them for fundraising
          </Typography>

          {showStats && stats && (
            <div className={styles.stats}>
              <div className={styles.stat}>
                <Typography variant="label">Total Projects</Typography>
                <Typography variant="heading" size="medium">
                  {stats.numberOfCreatedProject}
                </Typography>
              </div>
              <div className={styles.stat}>
                <Typography variant="label">Active Fundraisings</Typography>
                <Typography variant="heading" size="medium">
                  {stats.numberOfFundraising}
                </Typography>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className={compact ? styles.compactProjects : styles.projects}>
        {projects.map((project) => (
          <Card key={project.projectIndex} className={compact ? styles.compactProjectCard : styles.projectCard}>
            {(() => {
              // Check if voting is currently open for voted badge logic
              const now = new Date();
              const startDate = new Date(
                Date.UTC(project.startYear, project.startMonth - 1, project.startDay, project.startHour),
              );

              const hasVotingStarted = now >= startDate;

              // Only show voted badge if voting has started AND user has voted
              return project.hasUserVoted && hasVotingStarted ? (
                <div className={styles.votedBadge}>✅ Voted</div>
              ) : null;
            })()}

            <div className={styles.projectHeader}>
              <Typography variant="heading" size={compact ? "small" : "medium"}>
                Project #{project.projectIndex}
              </Typography>
            </div>

            <div className={styles.projectDetails}>
              <div className={styles.detail}>
                <Typography variant="label">Token Name:</Typography>
                <Typography variant="body">{uint64ToTokenName(project.tokenName)}</Typography>
              </div>

              <div className={styles.detail}>
                <Typography variant="label">Token Supply:</Typography>
                <Typography variant="body">{project.supply.toLocaleString()}</Typography>
              </div>

              <div className={styles.detail}>
                <Typography variant="label">Project Period:</Typography>
                <Typography variant="body">
                  📅 {project.startYear}-{project.startMonth.toString().padStart(2, "0")}-
                  {project.startDay.toString().padStart(2, "0")} {project.startHour.toString().padStart(2, "0")}:00 UTC
                  {" → "}
                  {project.endYear}-{project.endMonth.toString().padStart(2, "0")}-
                  {project.endDay.toString().padStart(2, "0")} {project.endHour.toString().padStart(2, "0")}:00 UTC
                </Typography>
              </div>

              <div className={styles.detail}>
                <Typography variant="label">Voting Status:</Typography>
                <Typography variant="body">
                  {(() => {
                    // Check if voting period is currently active using UTC time
                    const now = new Date();
                    const startDate = new Date(
                      Date.UTC(project.startYear, project.startMonth - 1, project.startDay, project.startHour),
                    );
                    const endDate = new Date(
                      Date.UTC(project.endYear, project.endMonth - 1, project.endDay, project.endHour),
                    );

                    const isVotingOpen = now >= startDate && now <= endDate;
                    const totalVotes = (project.numberOfYes || 0) + (project.numberOfNo || 0);
                    const yesVotes = project.numberOfYes || 0;
                    const noVotes = project.numberOfNo || 0;

                    if (!isVotingOpen && now < startDate) {
                      return "⏰ Voting NOT OPEN YET - Voting will start in the future";
                    } else if (!isVotingOpen && now > endDate) {
                      return "🔒 Voting CLOSED - Voting period has ended";
                    } else if (isVotingOpen && totalVotes === 0) {
                      return "🟢 Voting is OPEN - No votes yet, be the first to vote!";
                    } else if (isVotingOpen && yesVotes > noVotes) {
                      return "🗳️ Voting is OPEN - Currently leading YES votes";
                    } else if (isVotingOpen && noVotes > yesVotes) {
                      return "🗳️ Voting is OPEN - Currently leading NO votes";
                    } else if (isVotingOpen) {
                      return "🗳️ Voting is OPEN - Currently tied, your vote matters!";
                    } else {
                      return "❓ Voting status unknown";
                    }
                  })()}
                </Typography>
              </div>

              <div className={styles.detail}>
                <Typography variant="label">Current Votes:</Typography>
                <Typography variant="body">
                  👍 {project.numberOfYes || 0} YES, 👎 {project.numberOfNo || 0} NO
                </Typography>
              </div>
            </div>

            {(() => {
              // Check if voting is currently open
              const now = new Date();
              const startDate = new Date(
                Date.UTC(project.startYear, project.startMonth - 1, project.startDay, project.startHour),
              );
              const endDate = new Date(
                Date.UTC(project.endYear, project.endMonth - 1, project.endDay, project.endHour),
              );

              const isVotingOpen = now >= startDate && now <= endDate;
              const totalVotes = (project.numberOfYes || 0) + (project.numberOfNo || 0);
              const yesVotes = project.numberOfYes || 0;
              const noVotes = project.numberOfNo || 0;
              const votingPassed = totalVotes > 0 && yesVotes > noVotes;
              const isCreator = wallet?.publicKey === project.creator;

              // If voting has passed and no fundraising created yet, show create fundraising button
              if (!isVotingOpen && now > endDate && votingPassed && !project.isCreatedFundarasing && isCreator) {
                return (
                  <div className={styles.actions}>
                    <Button
                      caption="🚀 Create Fundraising"
                      variant="solid"
                      color="primary"
                      onClick={() => navigate(`/projects/create-fundraising/${project.projectIndex}`)}
                    />
                    <div className={styles.passedInfo}>
                      <Typography variant="body" size="small">
                        🎉 Voting passed! You can now create the fundraising campaign.
                      </Typography>
                    </div>
                  </div>
                );
              }

              // If fundraising already created
              if (project.isCreatedFundarasing) {
                return (
                  <div className={styles.fundraisingCreated}>
                    <Typography variant="body" size="small">
                      💰 Fundraising campaign has been created!
                    </Typography>
                    <Button
                      caption="View Fundraising"
                      variant="outline"
                      color="primary"
                      onClick={() => {
                        if (project.fundraisingIndex !== undefined && project.fundraisingIndex >= 0) {
                          navigate(`/projects/fundraising/${project.fundraisingIndex}`);
                        } else {
                          // Fallback: try to find it
                          getCachedFundraisingIndex(project.projectIndex, getFundraisingIndexByProjectIndex).then(
                            (index) => {
                              if (index >= 0) {
                                navigate(`/projects/fundraising/${index}`);
                              } else {
                                console.error(`Could not find fundraising index for project ${project.projectIndex}`);
                              }
                            },
                          );
                        }
                      }}
                    />
                  </div>
                );
              }

              // Regular voting logic
              if (project.hasUserVoted) {
                return (
                  <div className={styles.votedInfo}>
                    <Typography variant="body" size="small">
                      ✅ You have already voted on this project
                    </Typography>
                    <Typography variant="body" size="small">
                      Vote changes are not allowed by the smart contract.
                    </Typography>
                  </div>
                );
              } else if (!isVotingOpen) {
                return (
                  <div className={styles.votingClosed}>
                    <Typography variant="body" size="small">
                      🔒 Voting is not currently open for this project
                    </Typography>
                  </div>
                );
              } else {
                return (
                  <div className={styles.actions}>
                    <Button
                      caption="Vote YES"
                      variant="solid"
                      color="primary"
                      onClick={() => handleVote(project.projectIndex, true)}
                      isLoading={vote.isLoading(project.projectIndex)}
                      disabled={vote.isLoading(project.projectIndex)}
                    />
                    <Button
                      caption="Vote NO"
                      variant="outline"
                      color="secondary"
                      onClick={() => handleVote(project.projectIndex, false)}
                      isLoading={vote.isLoading(project.projectIndex)}
                      disabled={vote.isLoading(project.projectIndex)}
                    />
                  </div>
                );
              }
            })()}

            {vote.isMonitoring && (
              <div className={styles.monitoring}>
                <Typography variant="body" size="small">
                  🔄 Processing vote...
                </Typography>
              </div>
            )}

            {vote.isError && (
              <div className={styles.error}>
                <Typography variant="body" size="small">
                  ❌ Error: {vote.errorMessage}
                </Typography>
              </div>
            )}
          </Card>
        ))}
      </div>

      {showRefresh && !compact && (
        <div className={styles.refreshSection}>
          <Button
            caption="🔄 Refresh Projects"
            variant="outline"
            color="secondary"
            onClick={handleRefresh}
            disabled={isLoading}
          />
        </div>
      )}

      {compact && projects.length > 0 && (
        <div className={styles.viewAllSection}>
          <Button
            caption="View All DAO Voting →"
            variant="outline"
            color="primary"
            onClick={() => navigate("/projects/dao-voting")}
          />
        </div>
      )}
    </div>
  );
};
