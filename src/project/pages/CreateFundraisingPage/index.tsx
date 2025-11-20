import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { getProjectByIndex } from "@/services/nostromo.service";
import { getFundraisingIndexByProjectIndex } from "@/services/nostromo.service";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { DateInput } from "@/shared/components/DateInput";
import { Fieldset } from "@/shared/components/Fieldset";
import { TextInput } from "@/shared/components/TextInput";
import { Typography } from "@/shared/components/Typography";
import { IProjectInfo } from "@/types";
import { useCreateFundraising } from "@/wallet/hooks/useCreateFundraising";

import styles from "./CreateFundraisingPage.module.scss";

interface FundraisingFormData {
  tokenPrice: number;
  soldAmount: number;
  requiredFunds: number;

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

  threshold: number; // Percentage threshold
  TGE: number; // Token Generation Event percentage
  stepOfVesting: number; // Vesting step percentage
}

interface FormErrors {
  [key: string]: string;
}

export const CreateFundraisingPage: React.FC = () => {
  const { projectIndex } = useParams<{ projectIndex: string }>();
  const navigate = useNavigate();
  const createFundraising = useCreateFundraising();

  const [project, setProject] = useState<IProjectInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});

  // Default dates: start from tomorrow
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const oneMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const threeMonths = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const sixMonths = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

  const [formData, setFormData] = useState<FundraisingFormData>({
    tokenPrice: 1, // 1 QU per token
    soldAmount: 500000, // 50% of supply for sale
    requiredFunds: 500000, // Amount to raise

    // Phase 1: ICO (1 week)
    firstPhaseStartDate: tomorrow,
    firstPhaseStartHour: 12,
    firstPhaseEndDate: nextWeek,
    firstPhaseEndHour: 12,

    // Phase 2: Public Sale (1 week after phase 1)
    secondPhaseStartDate: nextWeek,
    secondPhaseStartHour: 12,
    secondPhaseEndDate: twoWeeks,
    secondPhaseEndHour: 12,

    // Phase 3: Final Sale (1 week after phase 2)
    thirdPhaseStartDate: twoWeeks,
    thirdPhaseStartHour: 12,
    thirdPhaseEndDate: oneMonth,
    thirdPhaseEndHour: 12,

    // Token Economics
    listingStartDate: oneMonth, // List after all phases
    listingStartHour: 12,
    cliffEndDate: threeMonths, // 3-month cliff
    cliffEndHour: 12,
    vestingEndDate: sixMonths, // 6-month vesting
    vestingEndHour: 12,

    threshold: 50, // 50% threshold
    TGE: 25, // 25% at TGE
    stepOfVesting: 10, // 10% per vesting step
  });

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      if (!projectIndex) {
        navigate("/projects/dao-voting");
        return;
      }

      try {
        const projectData = await getProjectByIndex(parseInt(projectIndex));
        setProject(projectData);

        // Auto-fill some values based on project
        setFormData((prev) => ({
          ...prev,
          soldAmount: Math.floor(projectData.supply * 0.5), // 50% for sale
          requiredFunds: Math.floor(projectData.supply * 0.5), // 1:1 ratio initially
        }));
      } catch (error) {
        console.error("Error loading project:", error);
        navigate("/projects/dao-voting");
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectIndex, navigate]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Basic validation
    if (formData.tokenPrice <= 0) {
      newErrors.tokenPrice = "Token price must be greater than 0";
    }
    if (formData.soldAmount <= 0) {
      newErrors.soldAmount = "Sold amount must be greater than 0";
    }
    if (formData.requiredFunds <= 0) {
      newErrors.requiredFunds = "Required funds must be greater than 0";
    }

    // Date sequence validation
    if (formData.firstPhaseEndDate < formData.firstPhaseStartDate) {
      newErrors.firstPhaseEndDate = "End date must be after start date";
    }
    if (formData.secondPhaseEndDate < formData.secondPhaseStartDate) {
      newErrors.secondPhaseEndDate = "End date must be after start date";
    }
    if (formData.thirdPhaseEndDate < formData.thirdPhaseStartDate) {
      newErrors.thirdPhaseEndDate = "End date must be after start date";
    }
    if (formData.secondPhaseStartDate < formData.firstPhaseEndDate) {
      newErrors.secondPhaseStartDate = "Phase 2 must start after Phase 1 ends";
    }
    if (formData.thirdPhaseStartDate < formData.secondPhaseEndDate) {
      newErrors.thirdPhaseStartDate = "Phase 3 must start after Phase 2 ends";
    }

    // Smart Contract constraints validation
    if (formData.threshold < 1 || formData.threshold > 50) {
      newErrors.threshold = "Threshold must be between 1 and 50 (SC constraint)";
    }
    if (formData.TGE < 1 || formData.TGE > 50) {
      newErrors.TGE = "TGE must be between 1 and 50 (SC constraint)";
    }
    if (formData.stepOfVesting < 1 || formData.stepOfVesting > 12) {
      newErrors.stepOfVesting = "Vesting steps must be between 1 and 12 (SC constraint)";
    }

    // Date relationship validation
    // SC uses strict > comparisons, so same day with different hours is allowed for testing
    const listingDate = new Date(formData.listingStartDate);
    listingDate.setUTCHours(formData.listingStartHour, 0, 0, 0);

    const cliffDate = new Date(formData.cliffEndDate);
    cliffDate.setUTCHours(formData.cliffEndHour, 0, 0, 0);

    const vestingDate = new Date(formData.vestingEndDate);
    vestingDate.setUTCHours(formData.vestingEndHour, 0, 0, 0);

    const thirdPhaseEnd = new Date(formData.thirdPhaseEndDate);
    thirdPhaseEnd.setUTCHours(formData.thirdPhaseEndHour, 0, 0, 0);

    // SC constraint: thirdPhaseEndDate > listingStartDate (strictly greater)
    if (listingDate <= thirdPhaseEnd) {
      newErrors.listingStartDate =
        "Listing must start after Phase 3 ends (can be same day with later hour for testing)";
    }
    // SC constraint: listingStartDate > cliffEndDate (strictly greater)
    if (cliffDate <= listingDate) {
      newErrors.cliffEndDate = "Cliff end must be after listing start (can be same day with later hour for testing)";
    }
    // SC constraint: cliffEndDate > vestingEndDate (strictly greater)
    if (vestingDate <= cliffDate) {
      newErrors.vestingEndDate = "Vesting end must be after cliff end (can be same day with later hour for testing)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !project || !projectIndex) {
      return;
    }

    const fundraisingData = {
      ...formData,
      indexOfProject: parseInt(projectIndex),
    };

    await createFundraising.mutate(fundraisingData, async (projectIndex: number) => {
      // Wait a few seconds after transaction confirmation for blockchain to update
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Find the fundraising index for this project
      const fundraisingIndex = await getFundraisingIndexByProjectIndex(projectIndex);

      if (fundraisingIndex >= 0) {
        // Navigate to the fundraising detail page
        navigate(`/projects/fundraising/${fundraisingIndex}`);
      } else {
        // Fallback: if we can't find the fundraising, go back to DAO voting
        console.warn(`Could not find fundraising index for project ${projectIndex}`);
        navigate("/projects/dao-voting");
      }
    });
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Card>
          <Typography variant="heading" size="large">
            Loading...
          </Typography>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.container}>
        <Card>
          <Typography variant="heading" size="large">
            Project Not Found
          </Typography>
          <Button caption="Back to Voting" onClick={() => navigate("/projects/dao-voting")} />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Card>
        <Typography variant="heading" size="large">
          Create Fundraising Campaign
        </Typography>
        <Typography variant="body" className={styles.subtitle}>
          Set up the fundraising phases for project: <strong>{project.tokenName}</strong>
        </Typography>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Basic Fundraising Info */}
          <Fieldset title="💰 Fundraising Details">
            <div className={styles.grid}>
              <TextInput
                label="Token Price (QU)"
                type="number"
                step="0.01"
                placeholder="1.00"
                value={formData.tokenPrice.toString()}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tokenPrice: parseFloat((e.target as HTMLInputElement).value) || 0,
                  }))
                }
                error={errors.tokenPrice}
                description="Price per token in QU"
                required
              />
              <TextInput
                label="Tokens for Sale"
                type="number"
                placeholder="500000"
                value={formData.soldAmount.toString()}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, soldAmount: parseInt((e.target as HTMLInputElement).value) || 0 }))
                }
                error={errors.soldAmount}
                description={`Max: ${project.supply.toLocaleString()} tokens`}
                required
              />
              <TextInput
                label="Required Funds (QU)"
                type="number"
                placeholder="500000"
                value={formData.requiredFunds.toString()}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    requiredFunds: parseInt((e.target as HTMLInputElement).value) || 0,
                  }))
                }
                error={errors.requiredFunds}
                description="Total funds to raise"
                required
              />
            </div>

            {/* Disclaimer about token amount rule */}
            <div
              style={{
                marginTop: "1.5rem",
                padding: "1rem",
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "8px",
              }}
            >
              <div style={{ marginBottom: "0.5rem" }}>
                <Typography variant="label" size="small">
                  ⚠️ Important Rule:
                </Typography>
              </div>
              <Typography variant="body" size="small">
                <strong>Token Price × Tokens for Sale</strong> must be greater than{" "}
                <strong>Required Funds + (Required Funds × Threshold / 100)</strong>
              </Typography>
              <div style={{ marginTop: "0.5rem", opacity: 0.8 }}>
                <Typography variant="body" size="small">
                  Current calculation: {formData.tokenPrice.toLocaleString()} × {formData.soldAmount.toLocaleString()} ={" "}
                  {(formData.tokenPrice * formData.soldAmount).toLocaleString()} QU
                  <br />
                  Required minimum:{" "}
                  {(formData.requiredFunds + (formData.requiredFunds * formData.threshold) / 100).toLocaleString()} QU
                </Typography>
              </div>
            </div>
          </Fieldset>

          {/* Phase 1: ICO */}
          <Fieldset title="🚀 Phase 1: ICO (Initial Coin Offering)">
            <div className={styles.phaseGrid}>
              <div className={styles.dateTimeGroup}>
                <DateInput
                  name="firstPhaseStartDate"
                  label="Start Date (UTC)"
                  value={formData.firstPhaseStartDate}
                  onChange={(date) => setFormData((prev) => ({ ...prev, firstPhaseStartDate: date || new Date() }))}
                  error={errors.firstPhaseStartDate}
                />
                <TextInput
                  label="Hour (UTC)"
                  type="number"
                  min="0"
                  max="23"
                  value={formData.firstPhaseStartHour.toString()}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      firstPhaseStartHour: parseInt((e.target as HTMLInputElement).value) || 0,
                    }))
                  }
                />
              </div>
              <div className={styles.dateTimeGroup}>
                <DateInput
                  name="firstPhaseEndDate"
                  label="End Date (UTC)"
                  value={formData.firstPhaseEndDate}
                  onChange={(date) => setFormData((prev) => ({ ...prev, firstPhaseEndDate: date || new Date() }))}
                  error={errors.firstPhaseEndDate}
                />
                <TextInput
                  label="Hour (UTC)"
                  type="number"
                  min="0"
                  max="23"
                  value={formData.firstPhaseEndHour.toString()}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      firstPhaseEndHour: parseInt((e.target as HTMLInputElement).value) || 0,
                    }))
                  }
                />
              </div>
            </div>
          </Fieldset>

          {/* Phase 2: Public Sale */}
          <Fieldset title="🌍 Phase 2: Public Sale">
            <div className={styles.phaseGrid}>
              <div className={styles.dateTimeGroup}>
                <DateInput
                  name="secondPhaseStartDate"
                  label="Start Date (UTC)"
                  value={formData.secondPhaseStartDate}
                  onChange={(date) => setFormData((prev) => ({ ...prev, secondPhaseStartDate: date || new Date() }))}
                  error={errors.secondPhaseStartDate}
                />
                <TextInput
                  label="Hour (UTC)"
                  type="number"
                  min="0"
                  max="23"
                  value={formData.secondPhaseStartHour.toString()}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      secondPhaseStartHour: parseInt((e.target as HTMLInputElement).value) || 0,
                    }))
                  }
                />
              </div>
              <div className={styles.dateTimeGroup}>
                <DateInput
                  name="secondPhaseEndDate"
                  label="End Date (UTC)"
                  value={formData.secondPhaseEndDate}
                  onChange={(date) => setFormData((prev) => ({ ...prev, secondPhaseEndDate: date || new Date() }))}
                  error={errors.secondPhaseEndDate}
                />
                <TextInput
                  label="Hour (UTC)"
                  type="number"
                  min="0"
                  max="23"
                  value={formData.secondPhaseEndHour.toString()}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      secondPhaseEndHour: parseInt((e.target as HTMLInputElement).value) || 0,
                    }))
                  }
                />
              </div>
            </div>
          </Fieldset>

          {/* Phase 3: Final Sale */}
          <Fieldset title="🏁 Phase 3: Final Sale">
            <div className={styles.phaseGrid}>
              <div className={styles.dateTimeGroup}>
                <DateInput
                  name="thirdPhaseStartDate"
                  label="Start Date (UTC)"
                  value={formData.thirdPhaseStartDate}
                  onChange={(date) => setFormData((prev) => ({ ...prev, thirdPhaseStartDate: date || new Date() }))}
                  error={errors.thirdPhaseStartDate}
                />
                <TextInput
                  label="Hour (UTC)"
                  type="number"
                  min="0"
                  max="23"
                  value={formData.thirdPhaseStartHour.toString()}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      thirdPhaseStartHour: parseInt((e.target as HTMLInputElement).value) || 0,
                    }))
                  }
                />
              </div>
              <div className={styles.dateTimeGroup}>
                <DateInput
                  name="thirdPhaseEndDate"
                  label="End Date (UTC)"
                  value={formData.thirdPhaseEndDate}
                  onChange={(date) => setFormData((prev) => ({ ...prev, thirdPhaseEndDate: date || new Date() }))}
                  error={errors.thirdPhaseEndDate}
                />
                <TextInput
                  label="Hour (UTC)"
                  type="number"
                  min="0"
                  max="23"
                  value={formData.thirdPhaseEndHour.toString()}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      thirdPhaseEndHour: parseInt((e.target as HTMLInputElement).value) || 0,
                    }))
                  }
                />
              </div>
            </div>
          </Fieldset>

          {/* Token Economics & Vesting Dates */}
          <Fieldset title="📅 Token Listing & Vesting Schedule">
            <div className={styles.phaseGrid}>
              <div className={styles.dateTimeGroup}>
                <DateInput
                  name="listingStartDate"
                  label="Listing Start Date (UTC)"
                  value={formData.listingStartDate}
                  onChange={(date) => setFormData((prev) => ({ ...prev, listingStartDate: date || new Date() }))}
                  error={errors.listingStartDate}
                />
                <TextInput
                  label="Hour (UTC)"
                  type="number"
                  min="0"
                  max="23"
                  value={formData.listingStartHour.toString()}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      listingStartHour: parseInt((e.target as HTMLInputElement).value) || 12,
                    }))
                  }
                />
              </div>
              <div className={styles.dateTimeGroup}>
                <DateInput
                  name="cliffEndDate"
                  label="Cliff End Date (UTC)"
                  value={formData.cliffEndDate}
                  onChange={(date) => setFormData((prev) => ({ ...prev, cliffEndDate: date || new Date() }))}
                  error={errors.cliffEndDate}
                />
                <TextInput
                  label="Hour (UTC)"
                  type="number"
                  min="0"
                  max="23"
                  value={formData.cliffEndHour.toString()}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cliffEndHour: parseInt((e.target as HTMLInputElement).value) || 12,
                    }))
                  }
                />
              </div>
              <div className={styles.dateTimeGroup}>
                <DateInput
                  name="vestingEndDate"
                  label="Vesting End Date (UTC)"
                  value={formData.vestingEndDate}
                  onChange={(date) => setFormData((prev) => ({ ...prev, vestingEndDate: date || new Date() }))}
                  error={errors.vestingEndDate}
                />
                <TextInput
                  label="Hour (UTC)"
                  type="number"
                  min="0"
                  max="23"
                  value={formData.vestingEndHour.toString()}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      vestingEndHour: parseInt((e.target as HTMLInputElement).value) || 12,
                    }))
                  }
                />
              </div>
            </div>
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                borderRadius: "8px",
              }}
            >
              <Typography variant="body" size="small">
                <strong>📅 Timeline Explanation:</strong>
                <br />
                <strong>Listing Start:</strong> Tokens become available. Investors can claim {formData.TGE}% (TGE)
                immediately.
                <br />
                <strong>Cliff End:</strong> Vesting period begins. Remaining tokens start unlocking gradually.
                <br />
                <strong>Vesting End:</strong> All tokens fully unlocked (100% claimable).
                <br />
                <strong>⚠️ SC Constraints:</strong> Each date must be strictly after the previous one. For testing, you
                can use the same day with different hours (e.g., Listing 10:00, Cliff 11:00, Vesting 12:00).
              </Typography>
            </div>
          </Fieldset>

          {/* Token Economics */}
          <Fieldset title="📈 Token Economics & Vesting">
            <div className={styles.grid}>
              <TextInput
                label="Threshold (%)"
                type="number"
                min="1"
                max="50"
                value={formData.threshold.toString()}
                onChange={(e) => {
                  const value = parseInt((e.target as HTMLInputElement).value) || 50;
                  const clampedValue = Math.min(Math.max(value, 1), 50);
                  setFormData((prev) => ({ ...prev, threshold: clampedValue }));
                }}
                description={`Funding success range: ${formData.requiredFunds - (formData.requiredFunds * formData.threshold) / 100} - ${formData.requiredFunds + (formData.requiredFunds * formData.threshold) / 100} QU`}
                error={errors.threshold}
              />
              <TextInput
                label="TGE (%)"
                type="number"
                min="1"
                max="50"
                value={formData.TGE.toString()}
                onChange={(e) => {
                  const value = parseInt((e.target as HTMLInputElement).value) || 25;
                  const clampedValue = Math.min(Math.max(value, 1), 50);
                  setFormData((prev) => ({ ...prev, TGE: clampedValue }));
                }}
                description={`${formData.TGE}% of tokens unlock at listing start (before cliff)`}
                error={errors.TGE}
              />
              <TextInput
                label="Vesting Steps"
                type="number"
                min="1"
                max="12"
                value={formData.stepOfVesting.toString()}
                onChange={(e) => {
                  const value = parseInt((e.target as HTMLInputElement).value) || 10;
                  const clampedValue = Math.min(Math.max(value, 1), 12);
                  setFormData((prev) => ({
                    ...prev,
                    stepOfVesting: clampedValue,
                  }));
                }}
                description={`${formData.stepOfVesting} periods to unlock remaining ${100 - formData.TGE}% (${((100 - formData.TGE) / formData.stepOfVesting).toFixed(1)}% per step)`}
                error={errors.stepOfVesting}
              />
            </div>
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "8px",
              }}
            >
              <Typography variant="body" size="small">
                <strong>📊 How Vesting Works:</strong>
                <br />
                <strong>1. Threshold ({formData.threshold}%):</strong> Defines acceptable funding range. If you need 1M
                QU with 50% threshold, success range is 500K-1.5M QU.
                <br />
                <strong>2. TGE ({formData.TGE}%):</strong> Unlocks immediately at listing start. Investors can claim{" "}
                {formData.TGE}% of tokens right away.
                <br />
                <strong>3. Vesting Steps ({formData.stepOfVesting}):</strong> Divides remaining {100 - formData.TGE}%
                into {formData.stepOfVesting} equal periods between cliff end and vesting end.
                <br />
                <strong>Timeline:</strong> Listing → Cliff End → Vesting End (gradual unlock)
              </Typography>
            </div>
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "rgba(255, 193, 7, 0.1)",
                border: "1px solid rgba(255, 193, 7, 0.3)",
                borderRadius: "8px",
              }}
            >
              <Typography variant="body" size="small">
                <strong>⚠️ Smart Contract Constraints:</strong>
                <br />
                • Threshold: 1-50% (max 50% per SC)
                <br />• TGE: 1-50% (max 50% per SC)
                <br />• Vesting Steps: 1-12 (number of periods, not percentage)
              </Typography>
            </div>
          </Fieldset>

          {createFundraising.isMonitoring && (
            <div className={styles.info}>
              <Typography variant="body">🔄 Processing fundraising creation transaction...</Typography>
            </div>
          )}

          {createFundraising.isError && (
            <div className={styles.error}>
              <Typography variant="body">❌ Error: {createFundraising.errorMessage}</Typography>
            </div>
          )}

          {createFundraising.txHash && (
            <div className={styles.success}>
              <Typography variant="body">✅ Transaction submitted! Hash: {createFundraising.txHash}</Typography>
            </div>
          )}

          <div className={styles.actions}>
            <Button
              caption="Cancel"
              variant="outline"
              color="secondary"
              onClick={() => navigate("/projects/dao-voting")}
              disabled={createFundraising.isLoading || createFundraising.isMonitoring}
            />
            <Button
              caption={
                createFundraising.isLoading || createFundraising.isMonitoring ? "Creating..." : "🚀 Create Fundraising"
              }
              variant="solid"
              color="primary"
              type="submit"
              isLoading={createFundraising.isLoading || createFundraising.isMonitoring}
              disabled={createFundraising.isLoading || createFundraising.isMonitoring}
            />
          </div>
        </form>
      </Card>
    </div>
  );
};
