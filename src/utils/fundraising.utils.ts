import { IFundraisingInfo } from "@/types";

export type FundraisingPhase = "upcoming" | "phase1" | "phase2" | "phase3" | "closed" | "claimable";

export interface PhaseInfo {
  phase: FundraisingPhase;
  label: string;
  canInvest: boolean;
  canClaim: boolean;
  startDate: Date | null;
  endDate: Date | null;
  description: string;
}

/**
 * Converts smart contract date format (year-2000, month, day, hour) to JavaScript Date
 */
export const scDateToDate = (year: number, month: number, day: number, hour: number): Date => {
  return new Date(Date.UTC(year + 2000, month - 1, day, hour, 0, 0));
};

/**
 * Gets the current phase of a fundraising campaign
 */
export const getFundraisingPhase = (fundraising: IFundraisingInfo): FundraisingPhase => {
  const now = new Date();

  const phase1Start = scDateToDate(
    fundraising.firstPhaseStartYear,
    fundraising.firstPhaseStartMonth,
    fundraising.firstPhaseStartDay,
    fundraising.firstPhaseStartHour,
  );
  const phase1End = scDateToDate(
    fundraising.firstPhaseEndYear,
    fundraising.firstPhaseEndMonth,
    fundraising.firstPhaseEndDay,
    fundraising.firstPhaseEndHour,
  );

  const phase2Start = scDateToDate(
    fundraising.secondPhaseStartYear,
    fundraising.secondPhaseStartMonth,
    fundraising.secondPhaseStartDay,
    fundraising.secondPhaseStartHour,
  );
  const phase2End = scDateToDate(
    fundraising.secondPhaseEndYear,
    fundraising.secondPhaseEndMonth,
    fundraising.secondPhaseEndDay,
    fundraising.secondPhaseEndHour,
  );

  const phase3Start = scDateToDate(
    fundraising.thirdPhaseStartYear,
    fundraising.thirdPhaseStartMonth,
    fundraising.thirdPhaseStartDay,
    fundraising.thirdPhaseStartHour,
  );
  const phase3End = scDateToDate(
    fundraising.thirdPhaseEndYear,
    fundraising.thirdPhaseEndMonth,
    fundraising.thirdPhaseEndDay,
    fundraising.thirdPhaseEndHour,
  );

  const listingStart = scDateToDate(
    fundraising.listingStartYear,
    fundraising.listingStartMonth,
    fundraising.listingStartDay,
    fundraising.listingStartHour,
  );

  // Check phases in order - investment phases take priority over listing date
  if (now >= phase1Start && now < phase1End) {
    return "phase1";
  } else if (now >= phase2Start && now < phase2End) {
    return "phase2";
  } else if (now >= phase3Start && now < phase3End) {
    return "phase3";
  } else if (now < phase1Start) {
    return "upcoming";
  } else if (now >= listingStart) {
    // Only return claimable if we're past all phases AND past listing start
    return "claimable";
  } else {
    // Between phase3 end and listing start = closed (fundraising ended but tokens not yet claimable)
    return "closed";
  }
};

/**
 * Gets detailed phase information for a fundraising
 */
export const getPhaseInfo = (fundraising: IFundraisingInfo): PhaseInfo => {
  const phase = getFundraisingPhase(fundraising);

  const phase1Start = scDateToDate(
    fundraising.firstPhaseStartYear,
    fundraising.firstPhaseStartMonth,
    fundraising.firstPhaseStartDay,
    fundraising.firstPhaseStartHour,
  );
  const phase1End = scDateToDate(
    fundraising.firstPhaseEndYear,
    fundraising.firstPhaseEndMonth,
    fundraising.firstPhaseEndDay,
    fundraising.firstPhaseEndHour,
  );

  const phase2Start = scDateToDate(
    fundraising.secondPhaseStartYear,
    fundraising.secondPhaseStartMonth,
    fundraising.secondPhaseStartDay,
    fundraising.secondPhaseStartHour,
  );
  const phase2End = scDateToDate(
    fundraising.secondPhaseEndYear,
    fundraising.secondPhaseEndMonth,
    fundraising.secondPhaseEndDay,
    fundraising.secondPhaseEndHour,
  );

  const phase3Start = scDateToDate(
    fundraising.thirdPhaseStartYear,
    fundraising.thirdPhaseStartMonth,
    fundraising.thirdPhaseStartDay,
    fundraising.thirdPhaseStartHour,
  );
  const phase3End = scDateToDate(
    fundraising.thirdPhaseEndYear,
    fundraising.thirdPhaseEndMonth,
    fundraising.thirdPhaseEndDay,
    fundraising.thirdPhaseEndHour,
  );

  const listingStart = scDateToDate(
    fundraising.listingStartYear,
    fundraising.listingStartMonth,
    fundraising.listingStartDay,
    fundraising.listingStartHour,
  );

  switch (phase) {
    case "upcoming":
      return {
        phase: "upcoming",
        label: "⏰ Upcoming",
        canInvest: false,
        canClaim: false,
        startDate: phase1Start,
        endDate: null,
        description: `Fundraising starts on ${phase1Start.toLocaleString()}`,
      };
    case "phase1":
      return {
        phase: "phase1",
        label: "🚀 Phase 1: ICO (All Tiers)",
        canInvest: true,
        canClaim: false,
        startDate: phase1Start,
        endDate: phase1End,
        description: "All tier levels can participate",
      };
    case "phase2":
      return {
        phase: "phase2",
        label: "🌍 Phase 2: Public Sale (Tier 4-5)",
        canInvest: true,
        canClaim: false,
        startDate: phase2Start,
        endDate: phase2End,
        description: "Only Xenomorph (Tier 4) and Warrior (Tier 5) can participate",
      };
    case "phase3":
      return {
        phase: "phase3",
        label: "🏁 Phase 3: Final Sale (Open)",
        canInvest: true,
        canClaim: false,
        startDate: phase3Start,
        endDate: phase3End,
        description: "Open to all participants",
      };
    case "claimable":
      return {
        phase: "claimable",
        label: "✅ Tokens Available",
        canInvest: false,
        canClaim: true,
        startDate: listingStart,
        endDate: null,
        description: "Tokens can be claimed based on vesting schedule",
      };
    case "closed":
      return {
        phase: "closed",
        label: "🔒 Closed",
        canInvest: false,
        canClaim: false,
        startDate: null,
        endDate: phase3End,
        description: "Fundraising period has ended",
      };
    default:
      return {
        phase: "closed",
        label: "🔒 Closed",
        canInvest: false,
        canClaim: false,
        startDate: null,
        endDate: null,
        description: "Unknown status",
      };
  }
};

/**
 * Checks if a user can invest in the current phase based on their tier
 */
export const canUserInvestInPhase = (fundraising: IFundraisingInfo, userTier: number): boolean => {
  const phase = getFundraisingPhase(fundraising);

  if (phase === "phase1") {
    // Phase 1: All tiers can invest (including tier 0/unregistered users)
    return true;
  } else if (phase === "phase2") {
    // Phase 2: Only tier 4 and 5 can invest
    return userTier === 4 || userTier === 5;
  } else if (phase === "phase3") {
    // Phase 3: Open to all (no tier requirement)
    return true;
  }

  return false;
};

/**
 * Calculates progress percentage for fundraising
 */
export const getFundraisingProgress = (fundraising: IFundraisingInfo): number => {
  if (fundraising.requiredFunds === 0) return 0;
  return Math.min((fundraising.raisedFunds / fundraising.requiredFunds) * 100, 100);
};

/**
 * Calculates min/max cap for fundraising based on threshold
 */
export const getFundraisingCaps = (
  fundraising: IFundraisingInfo,
): {
  minCap: number;
  maxCap: number;
} => {
  const thresholdPercent = fundraising.threshold / 100;
  const minCap = fundraising.requiredFunds * (1 - thresholdPercent);
  const maxCap = fundraising.requiredFunds * (1 + thresholdPercent);
  return { minCap, maxCap };
};

// Cache for project index to fundraising index mapping
const fundraisingIndexCache: Map<number, number> = new Map();
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * Gets the fundraising index for a project index with caching
 * @param projectIndex The project index
 * @param getFundraisingIndexByProjectIndex Function to fetch the index (from service)
 * @returns The fundraising index or -1 if not found
 */
export const getCachedFundraisingIndex = async (
  projectIndex: number,
  getFundraisingIndexByProjectIndex: (projectIndex: number) => Promise<number>,
): Promise<number> => {
  // Check cache first
  if (fundraisingIndexCache.has(projectIndex)) {
    const cachedIndex = fundraisingIndexCache.get(projectIndex);
    if (cachedIndex !== undefined) {
      return cachedIndex;
    }
  }

  // Cache expired or not found, fetch fresh
  const now = Date.now();
  if (now - cacheTimestamp > CACHE_DURATION) {
    fundraisingIndexCache.clear();
    cacheTimestamp = now;
  }

  const fundraisingIndex = await getFundraisingIndexByProjectIndex(projectIndex);
  if (fundraisingIndex >= 0) {
    fundraisingIndexCache.set(projectIndex, fundraisingIndex);
  }
  return fundraisingIndex;
};

/**
 * Clears the fundraising index cache
 */
export const clearFundraisingIndexCache = (): void => {
  fundraisingIndexCache.clear();
  cacheTimestamp = 0;
};
