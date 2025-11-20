import React from "react";

import { DAOVoting } from "@/shared/components/DAOVoting";

/**
 * DAO Voting Page - Shows projects pending DAO approval
 * Now uses the reusable DAOVoting component
 */
export const DAOVotingPage: React.FC = () => {
  return <DAOVoting title="DAO Voting" showStats={true} showRefresh={true} filterByUser={false} compact={false} />;
};
