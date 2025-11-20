import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Project } from "@/project/project.types";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { DateInput } from "@/shared/components/DateInput";
import { Fieldset } from "@/shared/components/Fieldset";
import { TextInput } from "@/shared/components/TextInput";
import { Typography } from "@/shared/components/Typography";
import { UserTypes } from "@/user/user.types";
import { useCreateProject } from "@/wallet/hooks/useCreateProject";
import { useQubicConnect } from "@/wallet/qubic/QubicConnectContext";

import styles from "./CreateProjectSCPage.module.scss";

interface ProjectSCFormData {
  tokenName: string;
  supply: number;
  startDate: Date;
  endDate: Date;
  startHour: number;
  endHour: number;
}

interface FormErrors {
  tokenName?: string;
  supply?: string;
  startDate?: string;
  endDate?: string;
  startHour?: string;
  endHour?: string;
}

/**
 * Simple Smart Contract Project Creation Page
 * Only collects fields needed for the smart contract
 */
export const CreateProjectSCPage: React.FC = () => {
  const navigate = useNavigate();
  const { wallet } = useQubicConnect();
  const createProject = useCreateProject();

  const [formData, setFormData] = useState<ProjectSCFormData>({
    tokenName: "",
    supply: 1000000,
    startDate: new Date(), // Today
    endDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    startHour: new Date().getUTCHours(), // Current UTC hour
    endHour: (new Date().getUTCHours() + 2) % 24, // 2 hours later
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.tokenName.trim()) {
      newErrors.tokenName = "Token name is required";
    } else if (formData.tokenName.length > 8) {
      newErrors.tokenName = "Token name must be 8 characters or less";
    }

    if (formData.supply <= 0) {
      newErrors.supply = "Supply must be greater than 0";
    }

    // Allow same-day testing - give 1 minute buffer for testing
    const startDateTime = new Date(formData.startDate);
    startDateTime.setUTCHours(formData.startHour, 0, 0, 0);
    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000); // 1 minute buffer

    if (startDateTime < oneMinuteFromNow) {
      newErrors.startDate = "Start time must be at least 1 minute in the future";
    }

    // Check if end time is after start time
    const endDateTime = new Date(formData.endDate);
    endDateTime.setUTCHours(formData.endHour, 0, 0, 0);

    if (endDateTime <= startDateTime) {
      newErrors.endDate = "End time must be after start time";
    }

    if (formData.startHour < 0 || formData.startHour > 23) {
      newErrors.startHour = "Start hour must be between 0 and 23";
    }

    if (formData.endHour < 0 || formData.endHour > 23) {
      newErrors.endHour = "End hour must be between 0 and 23";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!wallet?.publicKey) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      console.log("🚀 Creating project with data:", formData);

      // Combine date and hour into proper UTC Date objects
      const startDateTime = new Date(formData.startDate);
      startDateTime.setUTCHours(formData.startHour, 0, 0, 0);

      const endDateTime = new Date(formData.endDate);
      endDateTime.setUTCHours(formData.endHour, 0, 0, 0);

      console.log("🕐 Creating project with UTC times:", {
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString(),
        startHour: formData.startHour,
        endHour: formData.endHour,
      });

      // Convert the form data to the format expected by the smart contract hook
      // The useCreateProject hook expects a Project type with these specific fields
      const projectData = {
        tokenName: formData.tokenName, // Will be converted to uint64 in the hook
        tokensForSale: formData.supply,
        startDate: startDateTime, // Now includes the UTC hour
        // Required fields for the Project type
        id: 0,
        name: `SC Project ${formData.tokenName}`,
        slug: formData.tokenName.toLowerCase(),
        description: `Smart contract project for ${formData.tokenName} token`,
        email: "sc@example.com",
        websiteUrl: "https://example.com",
        tokensSupply: formData.supply,
        amountToRaise: formData.supply * 0.1,
        threshold: 50,
        cliff: 30,
        TGEDate: endDateTime,
        unlockTokensTGE: 10,
        vestingDays: 365,
        state: 0, // Draft state
        smartContractId: 0,
        tokenPrice: 1,
        photoUrl: "",
        bannerUrl: "",
        whitepaperUrl: "",
        litepaperUrl: "",
        tokenomicsUrl: "",
        tokenImageUrl: "",
        comments: "",
        social: {
          instagramUrl: "",
          xUrl: "",
          discordUrl: "",
          telegramUrl: "",
          mediumUrl: "",
        },
        currency: { id: 1, name: "QUBIC" },
        owner: { id: wallet.publicKey, wallet: wallet.publicKey, type: UserTypes.USER },
      };

      await createProject.mutate(projectData as Project);
    } catch (error) {
      console.error("❌ Error creating project:", error);
    }
  };

  if (!wallet?.publicKey) {
    return (
      <div className={styles.container}>
        <Card>
          <Typography variant="heading" size="large">
            Create Smart Contract Project
          </Typography>
          <Typography variant="body">
            Please connect your wallet first to create a project on the smart contract.
          </Typography>
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Card>
        <Typography variant="heading" size="large">
          Create Smart Contract Project
        </Typography>
        <Typography variant="body" className={styles.subtitle}>
          Simple form to create a project directly on the Nostromo smart contract
        </Typography>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Fieldset title="Smart Contract Project Details">
            <TextInput
              label="Token Name"
              placeholder="e.g., MYTOKEN (max 8 chars)"
              value={formData.tokenName}
              onChange={(e) => setFormData((prev) => ({ ...prev, tokenName: (e.target as HTMLInputElement).value }))}
              error={errors.tokenName}
              required
              upperCase
            />

            <TextInput
              label="Token Supply"
              type="number"
              placeholder="e.g., 1000000"
              value={formData.supply.toString()}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, supply: parseInt((e.target as HTMLInputElement).value) || 0 }))
              }
              error={errors.supply}
              required
            />

            <div className={styles.dateTimeGroup}>
              <DateInput
                name="startDate"
                label="Start Date (UTC)"
                value={formData.startDate}
                onChange={(date) => setFormData((prev) => ({ ...prev, startDate: date || new Date() }))}
                error={errors.startDate}
              />
              <TextInput
                label="Start Hour (UTC)"
                type="number"
                min="0"
                max="23"
                placeholder="12"
                value={formData.startHour.toString()}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, startHour: parseInt((e.target as HTMLInputElement).value) || 0 }))
                }
                description="Hour in 24-hour format (0-23)"
                error={errors.startHour}
              />
            </div>

            <div className={styles.dateTimeGroup}>
              <DateInput
                name="endDate"
                label="End Date (UTC)"
                value={formData.endDate}
                onChange={(date) => setFormData((prev) => ({ ...prev, endDate: date || new Date() }))}
                error={errors.endDate}
              />
              <TextInput
                label="End Hour (UTC)"
                type="number"
                min="0"
                max="23"
                placeholder="12"
                value={formData.endHour.toString()}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, endHour: parseInt((e.target as HTMLInputElement).value) || 0 }))
                }
                description="Hour in 24-hour format (0-23)"
                error={errors.endHour}
              />
            </div>
          </Fieldset>

          <div className={styles.info}>
            <Typography variant="body" size="small">
              ⚠️ Requirements:
            </Typography>
            <ul>
              <li>Must be registered in a tier</li>
              <li>Costs 100M QU to create project</li>
              <li>Transaction will be signed with MetaMask</li>
            </ul>
          </div>

          <div className={styles.actions}>
            <Button type="button" variant="outline" color="secondary" caption="Cancel" onClick={() => navigate(-1)} />
            <Button
              type="submit"
              variant="solid"
              color="primary"
              caption="Create Project on Smart Contract"
              isLoading={createProject.isLoading || createProject.isMonitoring}
              disabled={createProject.isLoading || createProject.isMonitoring}
            />
          </div>

          {createProject.isMonitoring && (
            <div className={styles.monitoring}>
              <Typography variant="body" size="small">
                🔄 Monitoring transaction confirmation...
              </Typography>
            </div>
          )}

          {createProject.isError && (
            <div className={styles.error}>
              <Typography variant="body" size="small">
                ❌ Error: {createProject.errorMessage}
              </Typography>
            </div>
          )}

          {createProject.txHash && (
            <div className={styles.success}>
              <Typography variant="body" size="small">
                ✅ Transaction Hash: {createProject.txHash}
              </Typography>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
};
