import { RouteObject } from "react-router-dom";

import { registerModule } from "@/core/modules/modules.helpers";
import { AppLayout } from "@/shared/layouts/AppLayout";

import { CreateFundraisingPage } from "./pages/CreateFundraisingPage";
import { CreateOrEditProjectPage } from "./pages/CreateOrEditProjectPage";
import { CreateProjectSCPage } from "./pages/CreateProjectSCPage";
import { DAOVotingPage } from "./pages/DAOVotingPage";
import { FundraisingDetailPage } from "./pages/FundraisingDetailPage";
import { ProjectDetailsPage } from "./pages/ProjectDetailsPage";
import { MODULE_PROJECT, PROJECT_ROUTES } from "./project.constants";

const routes: RouteObject[] = [
  {
    path: PROJECT_ROUTES.MAIN,
    element: <AppLayout />,
    children: [
      {
        path: PROJECT_ROUTES.PROJECT_DETAILS,
        element: <ProjectDetailsPage />,
      },
      {
        path: PROJECT_ROUTES.NEW_PROJECT,
        element: <CreateOrEditProjectPage />,
      },
      {
        path: PROJECT_ROUTES.NEW_PROJECT_SC,
        element: <CreateProjectSCPage />,
      },
      {
        path: PROJECT_ROUTES.DAO_VOTING,
        element: <DAOVotingPage />,
      },
      {
        path: "create-fundraising/:projectIndex",
        element: <CreateFundraisingPage />,
      },
      {
        path: "fundraising/:fundraisingIndex",
        element: <FundraisingDetailPage />,
      },
      {
        path: PROJECT_ROUTES.EDIT_PROJECT,
        element: <CreateOrEditProjectPage />,
      },
    ],
  },
];

registerModule({
  name: MODULE_PROJECT,
  routes,
});
