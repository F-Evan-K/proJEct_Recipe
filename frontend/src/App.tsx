import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { AccountsPage } from "./pages/AccountsPage";
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
  "Kelola Akun": AccountsPage,
};
function Workspace() {
  const { page, apiMode, apiReady, apiError, refreshWorkspace } =
    useWorkspace();
  const ActivePage = pageComponents[page];
  return (
    <div className="app">
      <Sidebar />
      <main>
        <Header />
        <div className="content">
          <PageHeading />
          {apiMode && (
            <div className="notice">
              <div>
                <b>MySQL lokal · {apiReady ? "terhubung" : "memuat data"}</b>
                <p>
                  Menu, inventory, waste dan rencana memakai API. Grafik dan
                  forecasting tetap ilustrasi, belum memakai model AI.
                </p>
                {apiError && <p role="alert">Gagal memuat: {apiError}</p>}
              </div>
              {apiError && (
                <button
                  className="button white"
                  onClick={() => void refreshWorkspace().catch(() => {})}
                >
                  Coba lagi
                </button>
              )}
            </div>
          )}
          {(!apiMode || apiReady) && <ActivePage />}
          <Footer />
        </div>
      </main>
      <Toast />
      <WorkspaceModal />
    </div>
  );
}
function AuthGate() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="auth-loading" role="status">
        Menyiapkan KitchenFlow...
      </div>
    );
  if (!user) return <AuthPage />;
  return (
    <WorkspaceProvider key={user.id}>
      <Workspace />
    </WorkspaceProvider>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
