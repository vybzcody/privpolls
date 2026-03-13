import { createBrowserRouter } from "react-router";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { CreateVote } from "./pages/CreateVote";
import { CreatePoll } from "./pages/CreatePoll";
import { VotePage } from "./pages/VotePage";
import { PollPage } from "./pages/PollPage";
import { NotFound } from "./pages/NotFound";
import { VoteAnalytics } from "./pages/VoteAnalytics";
import { PollAnalytics } from "./pages/PollAnalytics";
import { Notifications } from "./pages/Notifications";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Landing />,
  },
  {
    path: "/dashboard",
    element: <Dashboard />,
  },
  {
    path: "/create-vote",
    element: <CreateVote />,
  },
  {
    path: "/create-poll",
    element: <CreatePoll />,
  },
  {
    path: "/vote/:id",
    element: <VotePage />,
  },
  {
    path: "/vote/:id/analytics",
    element: <VoteAnalytics />,
  },
  {
    path: "/poll/:id",
    element: <PollPage />,
  },
  {
    path: "/poll/:id/analytics",
    element: <PollAnalytics />,
  },
  {
    path: "/notifications",
    element: <Notifications />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);