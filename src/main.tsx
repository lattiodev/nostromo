import { StrictMode } from "react";

import * as ReactDOM from "react-dom/client";

import { App } from "@/core/components/App";

// Debug function for development
if (process.env.NODE_ENV === "development") {
  // Import the service functions for debugging
  import("./services/nostromo.service").then((nostromoService) => {
    (window as Window & { checkTierLevel?: (walletAddress: string) => Promise<number | null> }).checkTierLevel = async (
      walletAddress: string,
    ) => {
      try {
        const tierLevel = await nostromoService.getTierLevelByUser(walletAddress);
        console.log(`🎯 Current tier level for ${walletAddress}: ${tierLevel}`);
        return tierLevel;
      } catch (error) {
        console.error("❌ Error checking tier level:", error);
        return null;
      }
    };

    (window as Window & { checkStats?: () => Promise<unknown> }).checkStats = async () => {
      try {
        const stats = await nostromoService.getStats();
        console.log("📊 Current platform stats:", stats);
        return stats;
      } catch (error) {
        console.error("❌ Error checking stats:", error);
        return null;
      }
    };

    (window as Window & { checkProject?: (projectIndex: number) => Promise<unknown> }).checkProject = async (
      projectIndex: number,
    ) => {
      try {
        const project = await nostromoService.getProjectByIndex(projectIndex);
        console.log(`📋 Project ${projectIndex} data:`, project);
        return project;
      } catch (error) {
        console.error("❌ Error checking project:", error);
        return null;
      }
    };

    (window as Window & { checkRawProjectData?: (projectIndex: number) => Promise<unknown> }).checkRawProjectData =
      async (projectIndex: number) => {
        try {
          // Make raw smart contract query to see actual response
          const query = {
            contractIndex: 14,
            inputType: 6,
            inputSize: 4,
            requestData: btoa(
              String.fromCharCode.apply(
                null,
                Array.from(
                  new Uint8Array(
                    new DataView(new ArrayBuffer(4)).setUint32(0, projectIndex, true) &&
                      new Uint8Array(new DataView(new ArrayBuffer(4)).buffer),
                  ),
                ),
              ),
            ),
          };

          const response = await fetch("http://194.247.186.149:8000/v1/querySmartContract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(query),
          });

          const result = await response.json();
          console.log(`🔍 Raw smart contract response for project ${projectIndex}:`, result);

          if (result.responseData) {
            const responseBytes = atob(result.responseData);
            const uint8Array = new Uint8Array(responseBytes.length);
            for (let i = 0; i < responseBytes.length; i++) {
              uint8Array[i] = responseBytes.charCodeAt(i);
            }
            console.log(`🔍 Response data as bytes (length ${uint8Array.length}):`, Array.from(uint8Array));
          }

          return result;
        } catch (error) {
          console.error("❌ Error checking raw project data:", error);
          return null;
        }
      };

    console.log("🔧 Debug functions loaded:");
    console.log("  - window.checkTierLevel('YOUR_WALLET_ADDRESS')");
    console.log("  - window.checkStats()");
    console.log("  - window.checkProject(projectIndex)");
    console.log("  - window.checkRawProjectData(projectIndex)");
  });
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
