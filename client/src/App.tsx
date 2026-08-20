import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ProjectsPage from "./pages/ProjectsPage";

// The plan viewer and the project shell pull in pdf.js and the takeoff engine, which the
// landing page and the projects list never need. Splitting them keeps the first load small.
const ProjectPage = lazy(() => import("./pages/ProjectPage"));
const WorkspacePage = lazy(() => import("./pages/WorkspacePage"));

function RouteFallback() {
  return <div className="workspace-loading">جارٍ التحميل…</div>;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/projects"}><DashboardLayout><ProjectsPage /></DashboardLayout></Route>
        <Route path={"/projects/:projectId"}><DashboardLayout><ProjectPage /></DashboardLayout></Route>
        <Route path={"/workspace/:projectId"}><DashboardLayout><WorkspacePage /></DashboardLayout></Route>
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
