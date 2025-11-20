import { ProjectStates } from "@/project/project.types";

/**
 * The module name for the home feature.
 * @constant {string}
 */
export const MODULE_HOME = "home";

/**
 * Routes related to the home feature.
 * @constant {Object}
 * @property {string} HOME - The main route for the home.
 */
export const HOME_ROUTES = {
  HOME: "/",
};

/**
 * Tabs representing different project states in the home page.
 * @constant {Array<{ id: ProjectStates, label: string }>}
 * @typedef {Object} ProjectTab
 * @property {ProjectStates} id - The state of the project.
 * @property {string} label - The display label for the tab.
 */
export const homeProjectTabs: Array<{ id: ProjectStates; label: string }> = [
  {
    id: ProjectStates.FUNDING_PHASE_1,
    label: "Active",
  },
  {
    id: ProjectStates.FUNDING_PHASE_2,
    label: "On-going",
  },
  {
    id: ProjectStates.CLOSED,
    label: "Closed",
  },
  {
    id: ProjectStates.READY_TO_VOTE,
    label: "Set Project",
  },
  {
    id: ProjectStates.FUNDING_PHASE_3,
    label: "Fund",
  },
];
