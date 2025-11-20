import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import classNames from "clsx";

import { getRoute } from "@/lib/router";
import { Loader } from "@/shared/components/Loader";
import { Separator } from "@/shared/components/Separator";
import { Tabs } from "@/shared/components/Tabs";
import { useAppTitle } from "@/shared/hooks/useAppTitle";
import { useContractTier } from "@/wallet/hooks/useContractTier";
import { useQubicConnect } from "@/wallet/qubic/QubicConnectContext";

import styles from "./UserSettingsPage.module.scss";
import { UserProjects } from "../../components/UserProjects";
import { UserTier } from "../../components/UserTier";
import { USER_ROUTES } from "../../user.constants";
import { UserSettingsTabs } from "../../user.types";

/**
 * Parameters for the UserSettingsLayout component
 * @typedef {Object} UserSettingsLayoutParams
 * @property {UserSettingsTabs} tabId - The ID of the currently selected settings tab
 */
export type UserSettingsPageParams = {
  tabId: UserSettingsTabs;
};

export const UserSettingsPage: React.FC = () => {
  const { wallet } = useQubicConnect();
  const params = useParams<UserSettingsPageParams>();
  const navigate = useNavigate();
  const { data, isLoading: isLoadingTier, refetch } = useContractTier();

  useAppTitle("User settings");

  useEffect(() => {
    const fetchCurrentTier = async () => {
      await refetch();
    };

    fetchCurrentTier();
  }, [wallet?.publicKey]);

  if (!params?.tabId) {
    return <Navigate to={getRoute(USER_ROUTES.SETTINGS, { tabId: UserSettingsTabs.TIER })} />;
  }

  if (!wallet?.publicKey || !params.tabId || isLoadingTier) {
    return (
      <div className={classNames(styles.container, styles.center)}>
        <Loader size={42} className={styles.loader} />
      </div>
    );
  }

  /**
   * Renders the appropriate tab content based on the current tab ID.
   *
   * @returns {JSX.Element} The content of the selected tab.
   */
  const renderTab = () => {
    switch (params.tabId) {
      case UserSettingsTabs.PROJECTS:
        return <UserProjects />;

      case UserSettingsTabs.TIER:
      default:
        return <UserTier wallet={wallet.publicKey} userTier={data.tierLevel} />;
    }
  };

  return (
    <>
      <div className={styles.tabs}>
        <Tabs<UserSettingsTabs>
          size={"large"}
          tabs={[
            {
              id: UserSettingsTabs.TIER,
              label: "Tier",
            },
            {
              id: UserSettingsTabs.PROJECTS,
              label: "Projects",
            },
          ]}
          activeId={params.tabId}
          onChange={(tabId) => navigate(getRoute(USER_ROUTES.SETTINGS, { tabId }))}
        />
      </div>
      <Separator />
      {renderTab()}
    </>
  );
};
