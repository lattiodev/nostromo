import React from "react";

import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Loader } from "@/shared/components/Loader";
import { Typography } from "@/shared/components/Typography";

import styles from "./TransactionMonitoringModal.module.scss";

interface TransactionMonitoringModalProps {
  readonly isOpen: boolean;
  readonly status: "pending" | "confirming" | "success" | "error";
  readonly txHash?: string;
  readonly message?: string;
  readonly onClose?: () => void;
}

/**
 * Modal component for displaying transaction monitoring status
 */
export const TransactionMonitoringModal: React.FC<TransactionMonitoringModalProps> = ({
  isOpen,
  status,
  txHash,
  message,
  onClose,
}) => {
  if (!isOpen) return null;

  const getStatusContent = () => {
    switch (status) {
      case "pending":
        return {
          icon: "⏳",
          title: "Broadcasting Transaction",
          description: "Your transaction is being broadcast to the network...",
          color: "var(--color-info, #3b82f6)",
        };
      case "confirming":
        return {
          icon: "🔄",
          title: "Confirming Transaction",
          description: "Waiting for blockchain confirmation. This may take a few moments...",
          color: "var(--color-warning, #f59e0b)",
        };
      case "success":
        return {
          icon: "✅",
          title: "Transaction Confirmed!",
          description: message || "Your transaction has been successfully confirmed on the blockchain.",
          color: "var(--color-success, #10b981)",
        };
      case "error":
        return {
          icon: "❌",
          title: "Transaction Failed",
          description: message || "Your transaction could not be completed. Please try again.",
          color: "var(--color-error, #ef4444)",
        };
      default:
        return {
          icon: "⏳",
          title: "Processing",
          description: "Please wait...",
          color: "var(--color-info, #3b82f6)",
        };
    }
  };

  const statusContent = getStatusContent();
  const isLoading = status === "pending" || status === "confirming";

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <Card>
          <div className={styles.content}>
            <div className={styles.icon} style={{ color: statusContent.color }}>
              {isLoading ? <Loader size={48} /> : <span style={{ fontSize: "48px" }}>{statusContent.icon}</span>}
            </div>

            <Typography variant="heading" size="large" className={styles.title}>
              {statusContent.title}
            </Typography>

            <Typography variant="body" className={styles.description}>
              {statusContent.description}
            </Typography>

            {txHash && (
              <div className={styles.txHash}>
                <Typography variant="label" size="small">
                  Transaction Hash:
                </Typography>
                <Typography variant="body" size="small" className={styles.hash}>
                  {txHash}
                </Typography>
              </div>
            )}

            {(status === "success" || status === "error") && onClose && (
              <div className={styles.actions}>
                <Button caption="Close" variant="solid" color="primary" onClick={onClose} />
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
