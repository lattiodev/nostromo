import { Skeleton } from "@/shared/components/Skeleton";

import styles from "./ProjectList.module.scss";
import { Project } from "../../project.types";
import { ProjectCard } from "../ProjectCard";

/**
 * Props interface for the ProjectList component
 * @interface ProjectListProps
 * @property {number} page - The current page number.
 * @property {boolean} isLoading - Indicates if the component is in a loading state.
 * @property {Project[]} projects - An array of projects to display.
 * @property {number} total - The total number of projects available.
 */
interface ProjectListProps {
  readonly page: number;
  readonly isLoading: boolean;
  readonly projects: Project[];
  readonly total: number;
}

/**
 * ProjectList Component
 *
 * Renders a grid of project cards with loading states.
 * Uses a skeleton loader for initial loading.
 * Returns null when no projects are available (hidden instead of showing empty state).
 *
 * @param {ProjectListProps} props - Component props
 * @returns {JSX.Element | null} Rendered component or null if no projects
 */
export const ProjectList: React.FC<ProjectListProps> = ({ isLoading, page, projects }) => {
  /**
   * Renders a grid of ProjectCard components based on the projects array
   *
   * Maps through the projects array and creates individual ProjectCard components
   * with project-specific data like banner URL, currency, dates, etc.
   *
   * @returns {JSX.Element} A div containing the mapped ProjectCard components
   */
  const renderProjectCards = () => (
    <div className={styles.cards}>
      {projects.map((project, index) => (
        <ProjectCard key={`project-${project.slug}-${index}`} {...project} />
      ))}
    </div>
  );

  if (!isLoading && projects.length === 0) {
    return null;
  }

  return (
    <Skeleton gap={42} count={3} height={480} orientation="horizontal" width="full" isLoading={isLoading && page === 0}>
      {renderProjectCards()}
    </Skeleton>
  );
};
