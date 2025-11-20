import { QubicHelper } from "@qubic-lib/qubic-ts-library/dist/qubicHelper";

import { fetchQuerySC } from "./rpc.service";
import { createSCTx } from "./tx.service";
import {
  NOSTROMO_CREATE_PROJECT_FEE,
  NOSTROMO_QX_TOKEN_ISSUANCE_FEE,
  NOSTROMO_TIER_CHESTBURST_STAKE_AMOUNT,
  NOSTROMO_TIER_DOG_STAKE_AMOUNT,
  NOSTROMO_TIER_FACEHUGGER_STAKE_AMOUNT,
  NOSTROMO_TIER_WARRIOR_STAKE_AMOUNT,
  NOSTROMO_TIER_XENOMORPH_STAKE_AMOUNT,
} from "../constants";
import {
  INostromoStats,
  IUserVoteStatus,
  IProjectInfo,
  IFundraisingInfo,
  IProjectIndexList,
  IUserInvestedInfo,
  IAsset,
  IInvestInfo,
} from "../types/index";
import { base64ToUint8Array, createPayload, uint8ArrayToBase64 } from "../utils/index";

const qHelper = new QubicHelper();

// Helper function to create Asset from string issuer ID
export const createAsset = (issuerId: string | Uint8Array, assetName: number): IAsset => {
  let issuerBytes: Uint8Array;
  if (typeof issuerId === "string") {
    issuerBytes = qHelper.getIdentityBytes(issuerId);
  } else {
    issuerBytes = issuerId;
  }
  return {
    issuer: issuerBytes,
    assetName: assetName,
  };
};

// Query Functions

export const getStats = async (): Promise<INostromoStats> => {
  const res = await fetchQuerySC({
    contractIndex: 14,
    inputType: 1,
    inputSize: 0,
    requestData: "",
  });

  if (!res.responseData) {
    return {
      epochRevenue: 0,
      totalPoolWeight: 0,
      numberOfRegister: 0,
      numberOfCreatedProject: 0,
      numberOfFundraising: 0,
    };
  }

  const responseView = new DataView(base64ToUint8Array(res.responseData).buffer);
  const getValue = (offset: number) => Number(responseView.getBigUint64(offset, true));
  const getUint32Value = (offset: number) => responseView.getUint32(offset, true);

  return {
    epochRevenue: getValue(0),
    totalPoolWeight: getValue(8),
    numberOfRegister: getUint32Value(16),
    numberOfCreatedProject: getUint32Value(20),
    numberOfFundraising: getUint32Value(24),
  };
};

export const getTierLevelByUser = async (userId: Uint8Array | string): Promise<number> => {
  let userIdBytes: Uint8Array;
  if (typeof userId === "string") {
    userIdBytes = qHelper.getIdentityBytes(userId);
  } else {
    userIdBytes = userId;
  }

  const view = new DataView(new Uint8Array(32).buffer);
  userIdBytes.forEach((byte, index) => view.setUint8(index, byte));

  const res = await fetchQuerySC({
    contractIndex: 14,
    inputType: 2,
    inputSize: 32,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  if (!res.responseData) return 0;

  return new DataView(base64ToUint8Array(res.responseData).buffer).getUint8(0);
};

export const getUserVoteStatus = async (userId: Uint8Array | string): Promise<IUserVoteStatus> => {
  let userIdBytes: Uint8Array;
  if (typeof userId === "string") {
    userIdBytes = qHelper.getIdentityBytes(userId);
  } else {
    userIdBytes = userId;
  }

  const view = new DataView(new Uint8Array(32).buffer);
  userIdBytes.forEach((byte, index) => view.setUint8(index, byte));

  const res = await fetchQuerySC({
    contractIndex: 14,
    inputType: 3,
    inputSize: 32,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  if (!res.responseData) {
    return {
      numberOfVotedProjects: 0,
      projectIndexList: [],
    };
  }

  const responseView = new DataView(base64ToUint8Array(res.responseData).buffer);
  const numberOfVotedProjects = responseView.getUint32(0, true);

  // Only read the actual number of voted projects, not all 128 slots
  // This prevents uninitialized 0 values from being included
  const projectIndexList: number[] = [];
  for (let i = 0; i < numberOfVotedProjects; i++) {
    projectIndexList.push(responseView.getUint32(4 + i * 4, true));
  }

  return {
    numberOfVotedProjects,
    projectIndexList,
  };
};

export const checkTokenCreatability = async (tokenName: number): Promise<boolean> => {
  const view = new DataView(new Uint8Array(8).buffer);
  view.setBigUint64(0, BigInt(tokenName), true);

  const res = await fetchQuerySC({
    contractIndex: 14,
    inputType: 4,
    inputSize: 8,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  if (!res.responseData) return false;

  return new DataView(base64ToUint8Array(res.responseData).buffer).getUint8(0) === 1;
};

export const getNumberOfInvestedProjects = async (userId: Uint8Array | string): Promise<number> => {
  let userIdBytes: Uint8Array;
  if (typeof userId === "string") {
    userIdBytes = qHelper.getIdentityBytes(userId);
  } else {
    userIdBytes = userId;
  }

  const view = new DataView(new Uint8Array(32).buffer);
  userIdBytes.forEach((byte, index) => view.setUint8(index, byte));

  const res = await fetchQuerySC({
    contractIndex: 14,
    inputType: 5,
    inputSize: 32,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  if (!res.responseData) return 0;

  return new DataView(base64ToUint8Array(res.responseData).buffer).getUint32(0, true);
};

export const getProjectByIndex = async (indexOfProject: number): Promise<IProjectInfo> => {
  const view = new DataView(new Uint8Array(4).buffer);
  view.setUint32(0, indexOfProject, true);

  const res = await fetchQuerySC({
    contractIndex: 14,
    inputType: 6,
    inputSize: 4,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  if (!res.responseData) {
    return {
      creator: "",
      tokenName: 0,
      supply: 0,
      startYear: 0,
      startMonth: 0,
      startDay: 0,
      startHour: 0,
      endYear: 0,
      endMonth: 0,
      endDay: 0,
      endHour: 0,
      numberOfYes: 0,
      numberOfNo: 0,
      isCreatedFundarasing: false,
    };
  }

  const responseView = new DataView(base64ToUint8Array(res.responseData).buffer);
  const getValue = (offset: number) => Number(responseView.getBigUint64(offset, true));
  const getUint32Value = (offset: number) => responseView.getUint32(offset, true);
  const getUint8Value = (offset: number) => responseView.getUint8(offset);

  // Parse exactly like C++ struct projectInfo (72 bytes total)
  // struct projectInfo: creator[32] + tokenName[8] + supplyOfToken[8] + startDate[4] + endDate[4] + numberOfYes[4] + numberOfNo[4] + isCreatedFundarasing[1]

  const responseLength = base64ToUint8Array(res.responseData).length;

  if (responseLength >= 65) {
    // 72-byte response - parse exactly like C++ struct with PACKED dates
    // Extract creator (first 32 bytes)
    const creatorBytes = new Uint8Array(base64ToUint8Array(res.responseData).buffer, 0, 32);
    const creator = uint8ArrayToBase64(creatorBytes);

    const tokenName = getValue(32); // tokenName at offset 32 (after creator[32])
    const supply = getValue(40); // supplyOfToken at offset 40
    const startDate = getUint32Value(48); // startDate at offset 48 (PACKED format)
    const endDate = getUint32Value(52); // endDate at offset 52 (PACKED format)
    const numberOfYes = getUint32Value(56); // numberOfYes at offset 56
    const numberOfNo = getUint32Value(60); // numberOfNo at offset 60
    const isCreatedFundarasing = getUint8Value(64) === 1; // isCreatedFundarasing at offset 64

    // Convert packed dates using C++ functions
    const getYear = (data: number) => (data >> 26) + 24 + 2000;
    const getMonth = (data: number) => (data >> 22) & 0b1111;
    const getDay = (data: number) => (data >> 17) & 0b11111;
    const getHour = (data: number) => (data >> 12) & 0b11111;

    const result = {
      creator,
      tokenName,
      supply,
      startYear: getYear(startDate),
      startMonth: getMonth(startDate),
      startDay: getDay(startDate),
      startHour: getHour(startDate),
      endYear: getYear(endDate),
      endMonth: getMonth(endDate),
      endDay: getDay(endDate),
      endHour: getHour(endDate),
      startDate,
      endDate,
      numberOfYes,
      numberOfNo,
      isCreatedFundarasing,
    };

    return result;
  } else {
    // Fallback for shorter responses - same as integration scripts
    return {
      creator: "", // Not available in shorter response
      tokenName: getValue(0),
      supply: getValue(8),
      startYear: getUint32Value(16) + 2000,
      startMonth: getUint32Value(20),
      startDay: getUint32Value(24),
      startHour: getUint32Value(28),
      endYear: getUint32Value(32) + 2000,
      endMonth: getUint32Value(36),
      endDay: getUint32Value(40),
      endHour: getUint32Value(44),
      numberOfYes: 0,
      numberOfNo: 0,
      isCreatedFundarasing: false,
    };
  }
};

/**
 * Finds the fundraising index for a given project index
 * @param projectIndex The project index to search for
 * @returns The fundraising index if found, or -1 if not found
 */
export const getFundraisingIndexByProjectIndex = async (projectIndex: number): Promise<number> => {
  try {
    const stats = await getStats();
    const numberOfFundraisings = stats.numberOfFundraising || 0;

    // Search through fundraisings to find the one matching this project
    for (let i = 0; i < numberOfFundraisings; i++) {
      try {
        const fundraising = await getFundraisingByIndex(i);
        if (fundraising.indexOfProject === projectIndex) {
          return i;
        }
      } catch (error) {
        // Continue searching if this fundraising doesn't exist
        continue;
      }
    }
    return -1;
  } catch (error) {
    console.error("Error finding fundraising index:", error);
    return -1;
  }
};

export const getFundraisingByIndex = async (indexOfFundraising: number): Promise<IFundraisingInfo> => {
  const view = new DataView(new Uint8Array(4).buffer);
  view.setUint32(0, indexOfFundraising, true);

  const res = await fetchQuerySC({
    contractIndex: 14,
    inputType: 7,
    inputSize: 4,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  if (!res.responseData) {
    return {
      tokenPrice: 0,
      soldAmount: 0,
      requiredFunds: 0,
      raisedFunds: 0,
      indexOfProject: 0,
      firstPhaseStartYear: 0,
      firstPhaseStartMonth: 0,
      firstPhaseStartDay: 0,
      firstPhaseStartHour: 0,
      firstPhaseEndYear: 0,
      firstPhaseEndMonth: 0,
      firstPhaseEndDay: 0,
      firstPhaseEndHour: 0,
      secondPhaseStartYear: 0,
      secondPhaseStartMonth: 0,
      secondPhaseStartDay: 0,
      secondPhaseStartHour: 0,
      secondPhaseEndYear: 0,
      secondPhaseEndMonth: 0,
      secondPhaseEndDay: 0,
      secondPhaseEndHour: 0,
      thirdPhaseStartYear: 0,
      thirdPhaseStartMonth: 0,
      thirdPhaseStartDay: 0,
      thirdPhaseStartHour: 0,
      thirdPhaseEndYear: 0,
      thirdPhaseEndMonth: 0,
      thirdPhaseEndDay: 0,
      thirdPhaseEndHour: 0,
      listingStartYear: 0,
      listingStartMonth: 0,
      listingStartDay: 0,
      listingStartHour: 0,
      cliffEndYear: 0,
      cliffEndMonth: 0,
      cliffEndDay: 0,
      cliffEndHour: 0,
      vestingEndYear: 0,
      vestingEndMonth: 0,
      vestingEndDay: 0,
      vestingEndHour: 0,
      threshold: 0,
      TGE: 0,
      stepOfVesting: 0,
      isCreatedToken: false,
    };
  }

  const responseView = new DataView(base64ToUint8Array(res.responseData).buffer);
  const getValue = (offset: number) => Number(responseView.getBigUint64(offset, true));
  const getUint32Value = (offset: number) => responseView.getUint32(offset, true);
  const getUint8Value = (offset: number) => responseView.getUint8(offset);

  // Parse struct fundaraisingInfo from C++:
  // uint64 tokenPrice (0-7)
  // uint64 soldAmount (8-15)
  // uint64 requiredFunds (16-23)
  // uint64 raisedFunds (24-31)
  // uint32 indexOfProject (32-35)
  // uint32 firstPhaseStartDate (36-39) - packed date
  // uint32 firstPhaseEndDate (40-43) - packed date
  // uint32 secondPhaseStartDate (44-47) - packed date
  // uint32 secondPhaseEndDate (48-51) - packed date
  // uint32 thirdPhaseStartDate (52-55) - packed date
  // uint32 thirdPhaseEndDate (56-59) - packed date
  // uint32 listingStartDate (60-63) - packed date
  // uint32 cliffEndDate (64-67) - packed date
  // uint32 vestingEndDate (68-71) - packed date
  // uint8 threshold (72)
  // uint8 TGE (73)
  // uint8 stepOfVesting (74)
  // bit isCreatedToken (75) - 1 byte

  // Check if we have packed dates or unpacked dates
  const responseLength = base64ToUint8Array(res.responseData).length;

  if (responseLength >= 76) {
    // New format with packed dates (from nostromo-sc.h)
    const raisedFunds = getValue(24);
    const indexOfProject = getUint32Value(32);

    // Unpack dates (format matches QUOTTERY::packQuotteryDate - same as project parsing)
    // The packed format stores year as (year - 2024), so we add 24 to get (year - 2000)
    // This matches the getYear logic in getProjectByIndex: ((data >> 26) + 24) + 2000
    // But we store as (year - 2000) format to match the interface
    const unpackDate = (packed: number) => {
      const rawYear = (packed >> 26) & 0x3f;
      // Match project parsing: ((data >> 26) + 24) + 2000 gives full year
      // Then subtract 2000 to get (year - 2000) format
      const year = rawYear + 24; // This gives (year - 2000) since rawYear is (year - 2024)
      const month = (packed >> 22) & 0x0f;
      const day = (packed >> 17) & 0x1f;
      const hour = (packed >> 12) & 0x1f;
      return { year, month, day, hour };
    };

    const firstPhaseStart = unpackDate(getUint32Value(36));
    const firstPhaseEnd = unpackDate(getUint32Value(40));
    const secondPhaseStart = unpackDate(getUint32Value(44));
    const secondPhaseEnd = unpackDate(getUint32Value(48));
    const thirdPhaseStart = unpackDate(getUint32Value(52));
    const thirdPhaseEnd = unpackDate(getUint32Value(56));
    const listingStart = unpackDate(getUint32Value(60));
    const cliffEnd = unpackDate(getUint32Value(64));
    const vestingEnd = unpackDate(getUint32Value(68));

    return {
      tokenPrice: getValue(0),
      soldAmount: getValue(8),
      requiredFunds: getValue(16),
      raisedFunds,
      indexOfProject,
      firstPhaseStartYear: firstPhaseStart.year,
      firstPhaseStartMonth: firstPhaseStart.month,
      firstPhaseStartDay: firstPhaseStart.day,
      firstPhaseStartHour: firstPhaseStart.hour,
      firstPhaseEndYear: firstPhaseEnd.year,
      firstPhaseEndMonth: firstPhaseEnd.month,
      firstPhaseEndDay: firstPhaseEnd.day,
      firstPhaseEndHour: firstPhaseEnd.hour,
      secondPhaseStartYear: secondPhaseStart.year,
      secondPhaseStartMonth: secondPhaseStart.month,
      secondPhaseStartDay: secondPhaseStart.day,
      secondPhaseStartHour: secondPhaseStart.hour,
      secondPhaseEndYear: secondPhaseEnd.year,
      secondPhaseEndMonth: secondPhaseEnd.month,
      secondPhaseEndDay: secondPhaseEnd.day,
      secondPhaseEndHour: secondPhaseEnd.hour,
      thirdPhaseStartYear: thirdPhaseStart.year,
      thirdPhaseStartMonth: thirdPhaseStart.month,
      thirdPhaseStartDay: thirdPhaseStart.day,
      thirdPhaseStartHour: thirdPhaseStart.hour,
      thirdPhaseEndYear: thirdPhaseEnd.year,
      thirdPhaseEndMonth: thirdPhaseEnd.month,
      thirdPhaseEndDay: thirdPhaseEnd.day,
      thirdPhaseEndHour: thirdPhaseEnd.hour,
      listingStartYear: listingStart.year,
      listingStartMonth: listingStart.month,
      listingStartDay: listingStart.day,
      listingStartHour: listingStart.hour,
      cliffEndYear: cliffEnd.year,
      cliffEndMonth: cliffEnd.month,
      cliffEndDay: cliffEnd.day,
      cliffEndHour: cliffEnd.hour,
      vestingEndYear: vestingEnd.year,
      vestingEndMonth: vestingEnd.month,
      vestingEndDay: vestingEnd.day,
      vestingEndHour: vestingEnd.hour,
      threshold: getUint8Value(72),
      TGE: getUint8Value(73),
      stepOfVesting: getUint8Value(74),
      isCreatedToken: getUint8Value(75) === 1,
    };
  } else {
    // Fallback: old format with unpacked dates
    return {
      tokenPrice: getValue(0),
      soldAmount: getValue(8),
      requiredFunds: getValue(16),
      raisedFunds: getValue(24),
      indexOfProject: getUint32Value(32),
      firstPhaseStartYear: getUint32Value(36),
      firstPhaseStartMonth: getUint32Value(40),
      firstPhaseStartDay: getUint32Value(44),
      firstPhaseStartHour: getUint32Value(48),
      firstPhaseEndYear: getUint32Value(52),
      firstPhaseEndMonth: getUint32Value(56),
      firstPhaseEndDay: getUint32Value(60),
      firstPhaseEndHour: getUint32Value(64),
      secondPhaseStartYear: getUint32Value(68),
      secondPhaseStartMonth: getUint32Value(72),
      secondPhaseStartDay: getUint32Value(76),
      secondPhaseStartHour: getUint32Value(80),
      secondPhaseEndYear: getUint32Value(84),
      secondPhaseEndMonth: getUint32Value(88),
      secondPhaseEndDay: getUint32Value(92),
      secondPhaseEndHour: getUint32Value(96),
      thirdPhaseStartYear: getUint32Value(100),
      thirdPhaseStartMonth: getUint32Value(104),
      thirdPhaseStartDay: getUint32Value(108),
      thirdPhaseStartHour: getUint32Value(112),
      thirdPhaseEndYear: getUint32Value(116),
      thirdPhaseEndMonth: getUint32Value(120),
      thirdPhaseEndDay: getUint32Value(124),
      thirdPhaseEndHour: getUint32Value(128),
      listingStartYear: getUint32Value(132),
      listingStartMonth: getUint32Value(136),
      listingStartDay: getUint32Value(140),
      listingStartHour: getUint32Value(144),
      cliffEndYear: getUint32Value(148),
      cliffEndMonth: getUint32Value(152),
      cliffEndDay: getUint32Value(156),
      cliffEndHour: getUint32Value(160),
      vestingEndYear: getUint32Value(164),
      vestingEndMonth: getUint32Value(168),
      vestingEndDay: getUint32Value(172),
      vestingEndHour: getUint32Value(176),
      threshold: getUint8Value(180),
      TGE: getUint8Value(181),
      stepOfVesting: getUint8Value(182),
      isCreatedToken: getUint8Value(183) === 1,
    };
  }
};

export const getProjectIndexListByCreator = async (creator: Uint8Array | string): Promise<IProjectIndexList> => {
  let creatorBytes: Uint8Array;
  if (typeof creator === "string") {
    creatorBytes = qHelper.getIdentityBytes(creator);
  } else {
    creatorBytes = creator;
  }

  const view = new DataView(new Uint8Array(32).buffer);
  creatorBytes.forEach((byte, index) => view.setUint8(index, byte));

  const res = await fetchQuerySC({
    contractIndex: 14,
    inputType: 8,
    inputSize: 32,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  if (!res.responseData) {
    return {
      indexListForProjects: [],
    };
  }

  const responseView = new DataView(base64ToUint8Array(res.responseData).buffer);

  const indexListForProjects: number[] = [];
  for (let i = 0; i < 128; i++) {
    indexListForProjects.push(responseView.getUint32(i * 4, true));
  }

  return {
    indexListForProjects,
  };
};

export const getInfoUserInvested = async (investorId: Uint8Array | string): Promise<IUserInvestedInfo> => {
  let investorIdBytes: Uint8Array;
  if (typeof investorId === "string") {
    investorIdBytes = qHelper.getIdentityBytes(investorId);
  } else {
    investorIdBytes = investorId;
  }

  const view = new DataView(new Uint8Array(32).buffer);
  investorIdBytes.forEach((byte, index) => view.setUint8(index, byte));

  const res = await fetchQuerySC({
    contractIndex: 14,
    inputType: 9,
    inputSize: 32,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  if (!res.responseData) {
    return {
      listUserInvested: [],
    };
  }

  const responseView = new DataView(base64ToUint8Array(res.responseData).buffer);

  const listUserInvested: IInvestInfo[] = [];
  for (let i = 0; i < 128; i++) {
    const offset = i * 20;

    // Match C++ struct layout: uint64 investedAmount (0-7), uint64 claimedAmount (8-15), uint32 indexOfFundraising (16-19)
    const investedAmount = Number(responseView.getBigUint64(offset, true));
    const claimedAmount = Number(responseView.getBigUint64(offset + 8, true));
    const indexOfFundraising = responseView.getUint32(offset + 16, true);

    listUserInvested.push({
      indexOfFundraising,
      investedAmount,
      claimedAmount,
    });
  }

  return {
    listUserInvested,
  };
};

export const getMaxClaimAmount = async (
  investorId: Uint8Array | string,
  indexOfFundraising: number,
): Promise<number> => {
  let investorIdBytes: Uint8Array;
  if (typeof investorId === "string") {
    investorIdBytes = qHelper.getIdentityBytes(investorId);
  } else {
    investorIdBytes = investorId;
  }

  const view = new DataView(new Uint8Array(36).buffer);
  investorIdBytes.forEach((byte, index) => view.setUint8(index, byte));
  view.setUint32(32, indexOfFundraising, true);

  const res = await fetchQuerySC({
    contractIndex: 14,
    inputType: 10,
    inputSize: 36,
    requestData: uint8ArrayToBase64(new Uint8Array(view.buffer)),
  });

  if (!res.responseData) return 0;

  return Number(new DataView(base64ToUint8Array(res.responseData).buffer).getBigUint64(0, true));
};

// Procedures
// 1. registerInTier
// 2. logoutFromTier
// 3. createProject
// 4. voteInProject
// 5. createFundraising
// 6. investInProject
// 7. claimToken
// 8. upgradeTier
// 9. TransferShareManagementRights
export const registerInTier = async (sourceID: string, tierLevel: number, tick: number) => {
  const payload = createPayload([{ data: tierLevel, type: "uint32" }]);
  let txAmount = 0;
  if (tierLevel === 1) {
    txAmount = NOSTROMO_TIER_FACEHUGGER_STAKE_AMOUNT;
  } else if (tierLevel === 2) {
    txAmount = NOSTROMO_TIER_CHESTBURST_STAKE_AMOUNT;
  } else if (tierLevel === 3) {
    txAmount = NOSTROMO_TIER_DOG_STAKE_AMOUNT;
  } else if (tierLevel === 4) {
    txAmount = NOSTROMO_TIER_XENOMORPH_STAKE_AMOUNT;
  } else if (tierLevel === 5) {
    txAmount = NOSTROMO_TIER_WARRIOR_STAKE_AMOUNT;
  }
  return await createSCTx(sourceID, 14, 1, payload.getPackageSize(), txAmount, tick, payload);
};

export const logoutFromTier = async (sourceID: string, tick: number) => {
  return await createSCTx(sourceID, 14, 2, 0, 0, tick);
};

export const createProject = async (
  sourceID: string,
  tokenName: number,
  supply: number,
  startYear: number,
  startMonth: number,
  startDay: number,
  startHour: number,
  endYear: number,
  endMonth: number,
  endDay: number,
  endHour: number,
  tick: number,
) => {
  const payload = createPayload([
    { data: tokenName, type: "bigint64" },
    { data: supply, type: "bigint64" },
    { data: startYear, type: "uint32" },
    { data: startMonth, type: "uint32" },
    { data: startDay, type: "uint32" },
    { data: startHour, type: "uint32" },
    { data: endYear, type: "uint32" },
    { data: endMonth, type: "uint32" },
    { data: endDay, type: "uint32" },
    { data: endHour, type: "uint32" },
  ]);
  return await createSCTx(sourceID, 14, 3, payload.getPackageSize(), NOSTROMO_CREATE_PROJECT_FEE, tick, payload);
};

export const voteInProject = async (sourceID: string, indexOfProject: number, decision: boolean, tick: number) => {
  const payload = createPayload([
    { data: indexOfProject, type: "uint32" },
    { data: decision ? 1 : 0, type: "uint8" },
  ]);
  return await createSCTx(sourceID, 14, 4, payload.getPackageSize(), 0, tick, payload);
};

export const createFundraising = async (
  sourceID: string,
  tokenPrice: number,
  soldAmount: number,
  requiredFunds: number,
  indexOfProject: number,
  firstPhaseStartYear: number,
  firstPhaseStartMonth: number,
  firstPhaseStartDay: number,
  firstPhaseStartHour: number,
  firstPhaseEndYear: number,
  firstPhaseEndMonth: number,
  firstPhaseEndDay: number,
  firstPhaseEndHour: number,
  secondPhaseStartYear: number,
  secondPhaseStartMonth: number,
  secondPhaseStartDay: number,
  secondPhaseStartHour: number,
  secondPhaseEndYear: number,
  secondPhaseEndMonth: number,
  secondPhaseEndDay: number,
  secondPhaseEndHour: number,
  thirdPhaseStartYear: number,
  thirdPhaseStartMonth: number,
  thirdPhaseStartDay: number,
  thirdPhaseStartHour: number,
  thirdPhaseEndYear: number,
  thirdPhaseEndMonth: number,
  thirdPhaseEndDay: number,
  thirdPhaseEndHour: number,
  listingStartYear: number,
  listingStartMonth: number,
  listingStartDay: number,
  listingStartHour: number,
  cliffEndYear: number,
  cliffEndMonth: number,
  cliffEndDay: number,
  cliffEndHour: number,
  vestingEndYear: number,
  vestingEndMonth: number,
  vestingEndDay: number,
  vestingEndHour: number,
  threshold: number,
  TGE: number,
  stepOfVesting: number,
  tick: number,
) => {
  const payload = createPayload([
    { data: tokenPrice, type: "bigint64" },
    { data: soldAmount, type: "bigint64" },
    { data: requiredFunds, type: "bigint64" },
    { data: indexOfProject, type: "uint32" },
    { data: firstPhaseStartYear, type: "uint32" },
    { data: firstPhaseStartMonth, type: "uint32" },
    { data: firstPhaseStartDay, type: "uint32" },
    { data: firstPhaseStartHour, type: "uint32" },
    { data: firstPhaseEndYear, type: "uint32" },
    { data: firstPhaseEndMonth, type: "uint32" },
    { data: firstPhaseEndDay, type: "uint32" },
    { data: firstPhaseEndHour, type: "uint32" },
    { data: secondPhaseStartYear, type: "uint32" },
    { data: secondPhaseStartMonth, type: "uint32" },
    { data: secondPhaseStartDay, type: "uint32" },
    { data: secondPhaseStartHour, type: "uint32" },
    { data: secondPhaseEndYear, type: "uint32" },
    { data: secondPhaseEndMonth, type: "uint32" },
    { data: secondPhaseEndDay, type: "uint32" },
    { data: secondPhaseEndHour, type: "uint32" },
    { data: thirdPhaseStartYear, type: "uint32" },
    { data: thirdPhaseStartMonth, type: "uint32" },
    { data: thirdPhaseStartDay, type: "uint32" },
    { data: thirdPhaseStartHour, type: "uint32" },
    { data: thirdPhaseEndYear, type: "uint32" },
    { data: thirdPhaseEndMonth, type: "uint32" },
    { data: thirdPhaseEndDay, type: "uint32" },
    { data: thirdPhaseEndHour, type: "uint32" },
    { data: listingStartYear, type: "uint32" },
    { data: listingStartMonth, type: "uint32" },
    { data: listingStartDay, type: "uint32" },
    { data: listingStartHour, type: "uint32" },
    { data: cliffEndYear, type: "uint32" },
    { data: cliffEndMonth, type: "uint32" },
    { data: cliffEndDay, type: "uint32" },
    { data: cliffEndHour, type: "uint32" },
    { data: vestingEndYear, type: "uint32" },
    { data: vestingEndMonth, type: "uint32" },
    { data: vestingEndDay, type: "uint32" },
    { data: vestingEndHour, type: "uint32" },
    { data: threshold, type: "uint8" },
    { data: TGE, type: "uint8" },
    { data: stepOfVesting, type: "uint8" },
  ]);

  return await createSCTx(sourceID, 14, 5, payload.getPackageSize(), NOSTROMO_QX_TOKEN_ISSUANCE_FEE, tick, payload);
};

export const investInProject = async (sourceID: string, indexOfFundraising: number, amount: number, tick: number) => {
  const payload = createPayload([{ data: indexOfFundraising, type: "uint32" }]);
  return await createSCTx(sourceID, 14, 6, payload.getPackageSize(), amount, tick, payload);
};

export const claimToken = async (sourceID: string, amount: number, indexOfFundraising: number, tick: number) => {
  const payload = createPayload([
    { data: amount, type: "bigint64" },
    { data: indexOfFundraising, type: "uint32" },
  ]);
  return await createSCTx(sourceID, 14, 7, payload.getPackageSize(), 0, tick, payload);
};

export const upgradeTier = async (sourceID: string, newTierLevel: number, deltaTierAmount: number, tick: number) => {
  const payload = createPayload([{ data: newTierLevel, type: "uint32" }]);
  return await createSCTx(sourceID, 14, 8, payload.getPackageSize(), deltaTierAmount, tick, payload);
};

export const transferShareManagementRights = async (
  sourceID: string,
  asset: IAsset,
  numberOfShares: number,
  newManagingContractIndex: number,
  tick: number,
) => {
  // Create the asset data: 32 bytes for issuer + 8 bytes for assetName
  const assetData = new Uint8Array(40);
  asset.issuer.forEach((byte, index) => (assetData[index] = byte));

  const view = new DataView(assetData.buffer);
  view.setBigUint64(32, BigInt(asset.assetName), true);

  // Create payload manually since createPayload doesn't support bytes type
  const payloadSize = 40 + 8 + 4; // assetData + numberOfShares + newManagingContractIndex
  const payload = new Uint8Array(payloadSize);
  let offset = 0;

  // Copy asset data
  payload.set(assetData, offset);
  offset += 40;

  // Add numberOfShares (8 bytes)
  const sharesView = new DataView(payload.buffer, offset);
  sharesView.setBigUint64(0, BigInt(numberOfShares), true);
  offset += 8;

  // Add newManagingContractIndex (4 bytes)
  const contractView = new DataView(payload.buffer, offset);
  contractView.setUint32(0, newManagingContractIndex, true);

  return await createSCTx(sourceID, 14, 9, payloadSize, 100, tick, payload);
};
