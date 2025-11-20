import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { getProjectIndexListByCreator, getProjectByIndex, getFundraisingByIndex } from "@/services/nostromo.service";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Loader } from "@/shared/components/Loader";
import { Typography } from "@/shared/components/Typography";
import { IProjectInfo, IFundraisingInfo } from "@/types";
import { uint64ToTokenName } from "@/wallet/qubic/contract/nostromoApi";
import { useQubicConnect } from "@/wallet/qubic/QubicConnectContext";

import styles from "./UserFundraisings.module.scss";

interface ProjectWithFundraising extends IProjectInfo {
  projectIndex: number;
  fundraisingInfo?: IFundraisingInfo;
  fundraisingIndex?: number;
}

/**
 * Component to show user's created projects and their fundraising status
 */
export const UserFundraisings: React.FC = () => {
  const { wallet } = useQubicConnect();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [projects, setProjects] = useState<ProjectWithFundraising[]>([]);
  const [error, setError] = useState<string>("");

  const loadUserProjects = async () => {
    if (!wallet?.publicKey) return;

    setIsLoading(true);
    setError("");

    try {
      // Get projects created by this user
      const projectIndexList = await getProjectIndexListByCreator(wallet.publicKey);

      // Filter out invalid indices (0, negative numbers, and extremely large numbers)
      // Also remove duplicates using Set
      const validIndices = [
        ...new Set(
          projectIndexList.indexListForProjects.filter(
            (idx) => idx > 0 && idx < 1000000, // Reasonable upper bound
          ),
        ),
      ];

      if (validIndices.length === 0) {
        setProjects([]);
        setIsLoading(false);
        return;
      }

      // Limit to first 50 projects to prevent UI overload
      const limitedIndices = validIndices.slice(0, 50);

      // Load project details
      const projectPromises = limitedIndices.map(async (projectIndex): Promise<ProjectWithFundraising | null> => {
        try {
          const project = await getProjectByIndex(projectIndex);

          if (project.tokenName === 0) {
            return null;
          }

          let fundraisingInfo: IFundraisingInfo | undefined;
          let fundraisingIndex: number | undefined;

          // If project has fundraising, try to find it
          if (project.isCreatedFundarasing) {
            // Try to find the fundraising by checking all fundraisings
            try {
              for (let i = 0; i < 10; i++) {
                // Check first 10 fundraisings
                const fundraising = await getFundraisingByIndex(i);
                if (fundraising.indexOfProject === projectIndex) {
                  fundraisingInfo = fundraising;
                  fundraisingIndex = i;
                  break;
                }
              }
            } catch (error) {
              // Fundraising not found for this project
            }
          }

          return {
            ...project,
            projectIndex,
            fundraisingInfo,
            fundraisingIndex,
          };
        } catch (error) {
          return null;
        }
      });

      const loadedProjects = await Promise.all(projectPromises);
      const validProjects = loadedProjects.filter((p): p is ProjectWithFundraising => p !== null);

      setProjects(validProjects);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUserProjects();
  }, [wallet?.publicKey]);

  const getProjectStatus = (project: ProjectWithFundraising): string => {
    const now = new Date();
    const startDate = new Date(
      Date.UTC(project.startYear, project.startMonth - 1, project.startDay, project.startHour),
    );
    const endDate = new Date(Date.UTC(project.endYear, project.endMonth - 1, project.endDay, project.endHour));

    const isVotingOpen = now >= startDate && now <= endDate;
    const totalVotes = (project.numberOfYes || 0) + (project.numberOfNo || 0);
    const yesVotes = project.numberOfYes || 0;
    const noVotes = project.numberOfNo || 0;
    const votingPassed = totalVotes > 0 && yesVotes > noVotes;

    if (isVotingOpen) {
      return "🗳️ Voting Active";
    } else if (!isVotingOpen && now < startDate) {
      return "⏰ Voting Pending";
    } else if (votingPassed && project.isCreatedFundarasing) {
      return "💰 Fundraising Created";
    } else if (votingPassed && !project.isCreatedFundarasing) {
      return "✅ Ready for Fundraising";
    } else if (!votingPassed) {
      return "❌ Voting Failed";
    } else {
      return "🔒 Voting Closed";
    }
  };

  if (!wallet?.publicKey) {
    return (
      <Card>
        <Typography variant="heading" size="medium">
          Your Fundraisings
        </Typography>
        <Typography variant="body">
          Please connect your wallet to view your created projects and fundraisings.
        </Typography>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <Typography variant="heading" size="medium">
          Your Fundraisings
        </Typography>
        <Loader />
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Typography variant="heading" size="medium">
          Your Fundraisings
        </Typography>
        <Typography variant="body" className={styles.error}>
          ❌ Error: {error}
        </Typography>
        <Button caption="Retry" onClick={loadUserProjects} />
      </Card>
    );
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <Card>
        <Typography variant="heading" size="medium">
          Your Fundraisings
        </Typography>
        <Typography variant="body" className={styles.subtitle}>
          Manage your created projects and fundraising campaigns
        </Typography>
      </Card>

      <div className={styles.projects}>
        {projects.map((project) => (
          <Card key={project.projectIndex} className={styles.projectCard}>
            <div className={styles.projectHeader}>
              <Typography variant="heading" size="medium">
                {uint64ToTokenName(project.tokenName)}
              </Typography>
              <div className={styles.statusBadge}>{getProjectStatus(project)}</div>
            </div>

            <div className={styles.projectDetails}>
              <div className={styles.detail}>
                <Typography variant="label">Project Index:</Typography>
                <Typography variant="body">#{project.projectIndex}</Typography>
              </div>

              <div className={styles.detail}>
                <Typography variant="label">Token Supply:</Typography>
                <Typography variant="body">{project.supply.toLocaleString()}</Typography>
              </div>

              <div className={styles.detail}>
                <Typography variant="label">Voting Results:</Typography>
                <Typography variant="body">
                  👍 {project.numberOfYes || 0} YES, 👎 {project.numberOfNo || 0} NO
                </Typography>
              </div>

              {project.fundraisingInfo && (
                <>
                  <div className={styles.detail}>
                    <Typography variant="label">Token Price:</Typography>
                    <Typography variant="body">{project.fundraisingInfo.tokenPrice} QU</Typography>
                  </div>

                  <div className={styles.detail}>
                    <Typography variant="label">Target Funds:</Typography>
                    <Typography variant="body">{project.fundraisingInfo.requiredFunds.toLocaleString()} QU</Typography>
                  </div>
                </>
              )}
            </div>

            <div className={styles.actions}>
              {getProjectStatus(project) === "✅ Ready for Fundraising" && (
                <Button
                  caption="🚀 Create Fundraising"
                  variant="solid"
                  color="primary"
                  onClick={() => navigate(`/projects/create-fundraising/${project.projectIndex}`)}
                />
              )}

              {project.fundraisingInfo && project.fundraisingIndex !== undefined && project.fundraisingIndex >= 0 && (
                <Button
                  caption="View Fundraising"
                  variant="outline"
                  color="primary"
                  onClick={() => navigate(`/projects/fundraising/${project.fundraisingIndex}`)}
                />
              )}

              <Button
                caption="View Project"
                variant="outline"
                color="secondary"
                onClick={() => navigate(`/projects/dao-voting`)} // Or specific project view
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
