import { z } from "zod";

import { UserSchema } from "./user.schema";

/**
 * Enum representing the different user types.
 */
export enum UserTypes {
  USER = "user",
  ADMIN = "admin",
}

/**
 * Enum representing the different tabs available in the user settings.
 *
 * @enum {string}
 * @property {string} TIER - Tab for managing user tier settings
 * @property {string} PROJECTS - Tab for viewing and managing all projects (includes fundraisings, voting, investments)
 */
export enum UserSettingsTabs {
  TIER = "tier",
  CHANGE_TIER = "change-tier",
  PROJECTS = "projects",
  // Deprecated: FUNDRAISINGS, INVESTMENTS, VOTING, CLAIM_TOKENS - merged into PROJECTS
  FUNDRAISINGS = "fundraisings",
  INVESTMENTS = "investments",
  VOTING = "voting",
  CLAIM_TOKENS = "claim-tokens",
}

/**
 * Filter types for the Projects tab
 */
export enum ProjectFilterType {
  ALL = "all",
  MY_PROJECTS = "my-projects",
  FUNDRAISINGS = "fundraisings",
  VOTING = "voting",
  INVESTMENTS = "investments",
}

/**
 * Type representing a User, inferred from the UserSchema.
 */
export type User = z.infer<typeof UserSchema>;
