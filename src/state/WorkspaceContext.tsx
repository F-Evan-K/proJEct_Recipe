import { createContext, useContext, useState, type ReactNode } from "react";
import type { Page, ModalType } from "../types";
import { initialFoods, initialStock, initialWastes } from "../data/demo";
// A single provider preserves shared demo state while navigating between pages.
function useWorkspaceState() {
  const [page, setPage] = useState<Page>("Dashboard"),
    [foods, setFoods] = useState(initialFoods),
    [period, setPeriod] = useState("Minggu ini"),
    [search, setSearch] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<ModalType>(null),
    [selected, setSelected] = useState(initialFoods[0]),
    [approved, setApproved] = useState(false),
    [forecasted, setForecasted] = useState(false),
    [mobile, setMobile] = useState(false),
    [stock, setStock] = useState(initialStock),
    [wastes, setWastes] = useState(initialWastes);
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 4000);
  };
  const go = (p: Page) => {
    setPage(p);
    setSearch("");
    setMobile(false);
  };
  const total = foods.reduce((a, b) => a + b.portions, 0),
    chicken = foods.reduce((a, b) => a + b.chicken * b.portions, 0),
    rice = foods.reduce((a, b) => a + b.rice * b.portions, 0);
  const download = () => {
    const rows = [
      "menu,forecast_demo,porsi_rencana",
      ...foods.map((f) => `${f.name},${f.forecast},${f.portions}`),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "kitchenflow-rencana-demo.csv";
    a.click();
    URL.revokeObjectURL(url);
    notify("Rencana demo berhasil diekspor");
  };
  return {
    page,
    setPage,
    foods,
    setFoods,
    period,
    setPeriod,
    search,
    setSearch,
    toast,
    setToast,
    modal,
    setModal,
    selected,
    setSelected,
    approved,
    setApproved,
    forecasted,
    setForecasted,
    mobile,
    setMobile,
    stock,
    setStock,
    wastes,
    setWastes,
    notify,
    go,
    total,
    chicken,
    rice,
    download,
  };
}
type WorkspaceState = ReturnType<typeof useWorkspaceState>;
const WorkspaceContext = createContext<WorkspaceState | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const state = useWorkspaceState();
  return (
    <WorkspaceContext.Provider value={state}>
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const state = useContext(WorkspaceContext);
  if (!state)
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return state;
}
