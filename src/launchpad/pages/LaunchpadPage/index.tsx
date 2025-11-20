import React, { useMemo, useRef, useState } from "react";

import classNames from "clsx";
import { RiArrowLeftLine, RiArrowRightLine } from "react-icons/ri";

import { ProjectOverview } from "@/project/components/ProjectOverview";
import { ProjectsListByState } from "@/project/components/ProjectsListByState";
import { useProjectsVip } from "@/project/hooks/useProjectsVip";
import { getStats, getFundraisingByIndex } from "@/services/nostromo.service";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { DAOVoting } from "@/shared/components/DAOVoting";
import { FundraisingList } from "@/shared/components/FundraisingList";
import { IconButton } from "@/shared/components/IconButton";
import { Loader } from "@/shared/components/Loader";
import { SectionIndicator } from "@/shared/components/SectionIndicator";
import { Slider, SliderElement } from "@/shared/components/Slider";
import { Typography } from "@/shared/components/Typography";
import { useAppTitle } from "@/shared/hooks/useAppTitle";
import { IFundraisingInfo, INostromoStats } from "@/types";
import { useQubicConnect } from "@/wallet/qubic/QubicConnectContext";

import styles from "./LaunchpadPage.module.scss";
import { HowToBoyIdoSection } from "../../components/HowToBoyIdoSection";
import { launchpadProjectTabs } from "../../launchpad.constants";

export const LaunchpadPage: React.FC = () => {
  const slider = useRef<SliderElement>();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const { projects, isLoading } = useProjectsVip();
  const { wallet } = useQubicConnect();

  // Debug state for fundraising data
  const [showFundraisingDebug, setShowFundraisingDebug] = useState(false);
  const [fundraisingData, setFundraisingData] = useState<Array<IFundraisingInfo & { index: number; error?: string }>>(
    [],
  );
  const [fundraisingStats, setFundraisingStats] = useState<INostromoStats | null>(null);

  useAppTitle("Launchpad");

  // Debug function to load actual fundraising data from smart contract
  const loadFundraisingDebugData = async () => {
    if (!wallet?.publicKey) return;

    try {
      console.log("🔍 Loading fundraising debug data...");

      // Get stats to see how many fundraisings exist
      const stats = await getStats();
      setFundraisingStats(stats);
      console.log("📊 Stats:", stats);

      const numberOfFundraisings = stats.numberOfFundraising || 0;
      console.log(`📊 Number of fundraisings: ${numberOfFundraisings}`);

      if (numberOfFundraisings === 0) {
        setFundraisingData([]);
        return;
      }

      // Load all fundraisings
      const fundraisingPromises = [];
      for (let i = 0; i < numberOfFundraisings; i++) {
        fundraisingPromises.push(
          getFundraisingByIndex(i)
            .then((fundraising) => {
              console.log(`💰 Fundraising ${i}:`, fundraising);
              return { index: i, ...fundraising };
            })
            .catch((error) => {
              console.error(`Error loading fundraising ${i}:`, error);
              return { index: i, error: error.message };
            }),
        );
      }

      const results = await Promise.all(fundraisingPromises);
      setFundraisingData(results);
      console.log("💰 All fundraising data:", results);
    } catch (error) {
      console.error("Error loading fundraising debug data:", error);
    }
  };

  /**
   * Renders the slider controls for navigating through projects.
   *
   * @returns A JSX element containing the slider controls or null if the slider is not initialized.
   */
  const renderSliderControls = useMemo(() => {
    return (
      <div className={styles.stepper}>
        <IconButton
          icon={<RiArrowLeftLine />}
          size={"small"}
          variant={"ghost"}
          onClick={() => slider.current?.previous()}
          disabled={currentIndex === 0}
        />
        <SectionIndicator
          step={currentIndex}
          steps={Array.from({ length: projects.length })}
          onClick={(index) => slider.current?.moveTo(index)}
          orientation="horizontal"
        />
        <IconButton
          icon={<RiArrowRightLine />}
          size={"small"}
          variant={"ghost"}
          onClick={() => slider.current?.next()}
          disabled={currentIndex === projects.length - 1}
        />
      </div>
    );
  }, [currentIndex, slider.current, projects.length]);

  return (
    <div className={styles.layout}>
      <section className={classNames(styles.section, styles.top)}>
        <div className={styles.diffuse} />

        {/* How to buy IDO */}
        <div className={classNames(styles.container, styles.large, styles.bottomLighting)}>
          <div className={styles.zIndexSuperior}>
            <HowToBoyIdoSection />
          </div>
        </div>

        {/* Project Overview */}
        <div className={classNames(styles.container, styles.large)}>
          <div className={styles.slider}>
            {isLoading ? (
              <div className={styles.loader}>
                <Loader size={52} />
              </div>
            ) : (
              <>
                <div className={styles.sliderFrame}>
                  <Slider
                    ref={slider}
                    delay={5000}
                    onMove={setCurrentIndex}
                    components={projects.map((project, index) => (
                      <ProjectOverview
                        key={index}
                        name={project.name}
                        slug={project.slug}
                        description={project.description}
                        photoUrl={project.photoUrl}
                        bannerUrl={project.bannerUrl}
                        fundraisingGoal={project.amountToRaise}
                        tokenPrice={project.tokenPrice}
                        currency={project.currency.name}
                        date={project.startDate}
                      />
                    ))}
                  />
                </div>
                {renderSliderControls}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Active Fundraisings Section */}
      <section className={styles.section}>
        <div className={styles.container}>
          <FundraisingList title="💰 Active Fundraisings" maxFundraisings={6} compact={true} showOnlyActive={true} />
        </div>
      </section>

      {/* DAO Voting Section */}
      <section className={styles.section}>
        <div className={styles.container}>
          <DAOVoting
            title="🗳️ DAO Voting"
            showStats={false}
            showRefresh={false}
            filterByUser={false}
            maxProjects={12}
            compact={true}
          />
        </div>
      </section>

      {/* Hidden Fundraising Debug Section */}
      {wallet?.publicKey && (
        <section className={styles.section}>
          <div className={styles.container}>
            <Card>
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}
              >
                <Typography variant="heading" size="medium">
                  🔍 Fundraising Debug Data
                </Typography>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <Button
                    caption="Load Fundraising Data"
                    variant="outline"
                    color="secondary"
                    onClick={loadFundraisingDebugData}
                  />
                  <Button
                    caption={showFundraisingDebug ? "Hide" : "Show"}
                    variant="outline"
                    color="primary"
                    onClick={() => setShowFundraisingDebug(!showFundraisingDebug)}
                  />
                </div>
              </div>

              {fundraisingStats && (
                <div
                  style={{
                    marginBottom: "1rem",
                    padding: "1rem",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "6px",
                  }}
                >
                  <Typography variant="body">
                    📊 <strong>Smart Contract Stats:</strong>
                    <br />• Total Fundraisings: {fundraisingStats.numberOfFundraising}
                    <br />• Total Projects: {fundraisingStats.numberOfCreatedProject}
                    <br />• Registered Users: {fundraisingStats.numberOfRegister}
                  </Typography>
                </div>
              )}

              {showFundraisingDebug && (
                <div style={{ maxHeight: "400px", overflow: "auto" }}>
                  {fundraisingData.length === 0 ? (
                    <Typography variant="body">
                      No fundraising data loaded. Click "Load Fundraising Data" button.
                    </Typography>
                  ) : (
                    fundraisingData.map((fundraising, index) => (
                      <div
                        key={index}
                        style={{
                          marginBottom: "1rem",
                          padding: "1rem",
                          background: "rgba(255,255,255,0.02)",
                          borderRadius: "6px",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        <Typography variant="body" size="small">
                          <strong>Fundraising #{fundraising.index}</strong>
                          <br />
                          {fundraising.error ? (
                            <span style={{ color: "#ff4444" }}>Error: {fundraising.error}</span>
                          ) : (
                            <>
                              • Token Price: {fundraising.tokenPrice} QU
                              <br />• Sold Amount: {fundraising.soldAmount?.toLocaleString()} tokens
                              <br />• Required Funds: {fundraising.requiredFunds?.toLocaleString()} QU
                              <br />• Project Index: {fundraising.indexOfProject}
                              <br />• Threshold: {fundraising.threshold}%<br />• TGE: {fundraising.TGE}%<br />• Vesting
                              Step: {fundraising.stepOfVesting}%<br />
                              <br />
                              <strong>Phase 1 (ICO):</strong>
                              <br />• Start: {fundraising.firstPhaseStartYear + 2000}-{fundraising.firstPhaseStartMonth}
                              -{fundraising.firstPhaseStartDay} {fundraising.firstPhaseStartHour}:00 UTC
                              <br />• End: {fundraising.firstPhaseEndYear + 2000}-{fundraising.firstPhaseEndMonth}-
                              {fundraising.firstPhaseEndDay} {fundraising.firstPhaseEndHour}:00 UTC
                              <br />
                              <br />
                              <strong>Phase 2 (Public):</strong>
                              <br />• Start: {fundraising.secondPhaseStartYear + 2000}-
                              {fundraising.secondPhaseStartMonth}-{fundraising.secondPhaseStartDay}{" "}
                              {fundraising.secondPhaseStartHour}:00 UTC
                              <br />• End: {fundraising.secondPhaseEndYear + 2000}-{fundraising.secondPhaseEndMonth}-
                              {fundraising.secondPhaseEndDay} {fundraising.secondPhaseEndHour}:00 UTC
                              <br />
                              <br />
                              <strong>Phase 3 (Final):</strong>
                              <br />• Start: {fundraising.thirdPhaseStartYear + 2000}-{fundraising.thirdPhaseStartMonth}
                              -{fundraising.thirdPhaseStartDay} {fundraising.thirdPhaseStartHour}:00 UTC
                              <br />• End: {fundraising.thirdPhaseEndYear + 2000}-{fundraising.thirdPhaseEndMonth}-
                              {fundraising.thirdPhaseEndDay} {fundraising.thirdPhaseEndHour}:00 UTC
                              <br />
                              <br />
                              <strong>Token Economics:</strong>
                              <br />• Listing: {fundraising.listingStartYear + 2000}-{fundraising.listingStartMonth}-
                              {fundraising.listingStartDay} {fundraising.listingStartHour}:00 UTC
                              <br />• Cliff End: {fundraising.cliffEndYear + 2000}-{fundraising.cliffEndMonth}-
                              {fundraising.cliffEndDay} {fundraising.cliffEndHour}:00 UTC
                              <br />• Vesting End: {fundraising.vestingEndYear + 2000}-{fundraising.vestingEndMonth}-
                              {fundraising.vestingEndDay} {fundraising.vestingEndHour}:00 UTC
                            </>
                          )}
                        </Typography>
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          </div>
        </section>
      )}

      {/* Projects by State Section */}
      <section className={styles.section}>
        <div className={styles.container}>
          <ProjectsListByState tabs={launchpadProjectTabs} initialState={launchpadProjectTabs[0].id} />
        </div>
      </section>
    </div>
  );
};
