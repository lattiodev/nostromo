import React, { useState } from "react";

import { ProjectsListByWallet } from "@/project/components/ProjectsListByWallet";
import { Card } from "@/shared/components/Card";
import { DAOVoting } from "@/shared/components/DAOVoting";
import { Tabs } from "@/shared/components/Tabs";
import { Typography } from "@/shared/components/Typography";
import { useQubicConnect } from "@/wallet/qubic/QubicConnectContext";

import styles from "./UserProjects.module.scss";
import { ProjectFilterType } from "../../user.types";
import { UserFundraisings } from "../UserFundraisings";
import { UserInvestments } from "../UserInvestments";

/**
 * Unified Projects view component with filtering
 * Shows: My Projects, Fundraisings, Voting, Investments
 */
export const UserProjects: React.FC = () => {
  const { wallet } = useQubicConnect();
  const [filter, setFilter] = useState<ProjectFilterType>(ProjectFilterType.ALL);

  if (!wallet?.publicKey) {
    return (
      <Card>
        <Typography variant="heading" size="medium">
          Projects
        </Typography>
        <Typography variant="body">Please connect your wallet to view your projects.</Typography>
      </Card>
    );
  }

  const filterTabs = [
    {
      id: ProjectFilterType.ALL,
      label: "All Projects",
    },
    {
      id: ProjectFilterType.MY_PROJECTS,
      label: "My Projects",
    },
    {
      id: ProjectFilterType.FUNDRAISINGS,
      label: "Fundraisings",
    },
    {
      id: ProjectFilterType.VOTING,
      label: "Voting",
    },
    {
      id: ProjectFilterType.INVESTMENTS,
      label: "Investments",
    },
  ];

  const renderContent = () => {
    switch (filter) {
      case ProjectFilterType.MY_PROJECTS:
        return <ProjectsListByWallet walletAddress={wallet.publicKey} limit={20} />;

      case ProjectFilterType.FUNDRAISINGS:
        return <UserFundraisings />;

      case ProjectFilterType.VOTING:
        return (
          <DAOVoting
            title="DAO Voting & History"
            showStats={true}
            showRefresh={true}
            filterByUser={false}
            compact={false}
          />
        );

      case ProjectFilterType.INVESTMENTS:
        return <UserInvestments />;

      case ProjectFilterType.ALL:
      default:
        return (
          <div className={styles.unifiedView}>
            <div className={styles.section}>
              <div style={{ marginBottom: "1rem" }}>
                <Typography variant="heading" size="small">
                  My Projects
                </Typography>
              </div>
              <ProjectsListByWallet walletAddress={wallet.publicKey} limit={6} />
            </div>

            <div className={styles.section}>
              <div style={{ marginBottom: "1rem" }}>
                <Typography variant="heading" size="small">
                  My Fundraisings
                </Typography>
              </div>
              <UserFundraisings />
            </div>

            <div className={styles.section}>
              <div style={{ marginBottom: "1rem" }}>
                <Typography variant="heading" size="small">
                  My Investments
                </Typography>
              </div>
              <UserInvestments />
            </div>

            <div className={styles.section}>
              <div style={{ marginBottom: "1rem" }}>
                <Typography variant="heading" size="small">
                  DAO Voting
                </Typography>
              </div>
              <DAOVoting title="" showStats={false} showRefresh={true} filterByUser={false} compact={true} />
            </div>
          </div>
        );
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.filters}>
        <Tabs<ProjectFilterType>
          size="medium"
          tabs={filterTabs}
          activeId={filter}
          onChange={(newFilter) => setFilter(newFilter)}
        />
      </div>

      <div className={styles.content}>{renderContent()}</div>
    </div>
  );
};
