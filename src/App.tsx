import type { ComponentType } from "react";
import type { Page } from "./types";
import { WorkspaceProvider, useWorkspace } from "./state/WorkspaceContext";
import { DashboardPage } from "./pages/DashboardPage";
import { InventoryPage } from "./pages/InventoryPage";
import { MenuRecipesPage } from "./pages/MenuRecipesPage";
import { ForecastingPage } from "./pages/ForecastingPage";
import { KitchenPlannerPage } from "./pages/KitchenPlannerPage";
import { WasteAnalyticsPage } from "./pages/WasteAnalyticsPage";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { PageHeading } from "./components/PageHeading";
import { Footer } from "./components/Footer";
import { Toast } from "./components/Toast";
import { WorkspaceModal } from "./components/WorkspaceModal";
const pageComponents: Record<Page, ComponentType> = {
  Dashboard: DashboardPage,
  Inventory: InventoryPage,
  "Menu & Resep": MenuRecipesPage,
  "AI Forecasting": ForecastingPage,
  "Kitchen Planner": KitchenPlannerPage,
  "Waste Analytics": WasteAnalyticsPage,
};
function Workspace() {
  const { page } = useWorkspace();
  const ActivePage = pageComponents[page];
  return (
    <div className="app">
      <Sidebar />
      <main>
        <Header />
        <div className="content">
          <PageHeading />
          <ActivePage />
          <Footer />
        </div>
      </main>
      <Toast />
      <WorkspaceModal />
    </div>
  );
}
export default function App() {
  return (
    <WorkspaceProvider>
      <Workspace />
    </WorkspaceProvider>
  );
}
