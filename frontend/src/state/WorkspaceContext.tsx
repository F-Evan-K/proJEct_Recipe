import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { Page, ModalType, Food, StockItem, WasteRecord } from "../types";
import { initialFoods, initialStock, initialWastes } from "../data/demo";
import { apiMode, kitchenApi } from "../services/api";
import { applyMenuEdit, type MenuEdit } from "../utils/recipe-editor";
import { apiRequest } from "../services/api";
function useWorkspaceState() {
  const [page, setPage] = useState<Page>("Dashboard");
  const [foods, setFoods] = useState<Food[]>(apiMode ? [] : initialFoods);
  const [stock, setStock] = useState<StockItem[]>(apiMode ? [] : initialStock);
  const [wastes, setWastes] = useState<WasteRecord[]>(
    apiMode ? [] : initialWastes,
  );
  const [period, setPeriod] = useState("Minggu ini");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<ModalType>(null);
  const [selected, setSelected] = useState(initialFoods[0]);
  const [approved, setApproved] = useState(false);
  const [forecasted, setForecasted] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [apiReady, setApiReady] = useState(!apiMode);
  const [apiError, setApiError] = useState("");
  const [pending, setPending] = useState(false);
  const mutationLock = useRef(false);
  const requestKeys = useRef(new Map<string, string>());
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 4000);
  };
  const go = (p: Page) => {
    setPage(p);
    setSearch("");
    setMobile(false);
  };
  async function refreshWorkspace() {
    setApiError("");
    try {
      const [menus, inventory, records] = await Promise.all([
        kitchenApi.menus(),
        kitchenApi.inventory(),
        kitchenApi.wastes(),
      ]);
      setFoods((current) =>
        menus
          .filter((m) => m.active)
          .map((m) => ({
            id: m.id,
            name: m.name,
            category: m.category,
            price: Number(m.price),
            emoji: m.emoji,
            forecast: 0,
            portions: current.find((f) => f.id === m.id)?.portions ?? 0,
            chicken: Number(
              m.recipe.find((l) => l.ingredient.name === "Daging ayam")
                ?.quantity ?? 0,
            ),
            rice: Number(
              m.recipe.find((l) => l.ingredient.name === "Beras premium")
                ?.quantity ?? 0,
            ),
            recipe: m.recipe.map((l) => ({
              ingredientId: l.ingredientId,
              name: l.ingredient.name,
              unit: l.ingredient.unit,
              quantity: Number(l.quantity),
            })),
          })),
      );
      setStock(
        inventory.map((i) => ({
          id: i.id,
          name: i.name,
          category: i.category,
          unit: i.unit,
          qty: Number(i.quantity),
          min: Number(i.minimum),
        })),
      );
      setWastes(
        records.map((r) => ({
          name: r.ingredient.name,
          qty: Number(r.quantity),
          unit: r.ingredient.unit,
          reason: r.reason,
        })),
      );
      setApiReady(true);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Gagal memuat API");
      throw error;
    }
  }
  useEffect(() => {
    if (apiMode) void refreshWorkspace().catch(() => {});
  }, []);
  function requestKey(fingerprint: string) {
    if (!requestKeys.current.has(fingerprint))
      requestKeys.current.set(fingerprint, crypto.randomUUID());
    return requestKeys.current.get(fingerprint)!;
  }
  async function submitApiData(type: ModalType, data: FormData) {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setPending(true);
    const name = String(data.get("name"));
    const fingerprint = JSON.stringify([type, ...data.entries()]);
    try {
      if (type === "menu")
        await kitchenApi.post("/menus", {
          name,
          category: "Menu baru",
          price: Number(data.get("price")),
          emoji: "🍽️",
        });
      else {
        const ingredient = stock.find((s) => s.name === name);
        if (!ingredient?.id)
          throw Error("Pilih bahan yang sudah terdaftar di inventory.");
        await kitchenApi.post(
          type === "stock" ? "/stock-movements" : "/waste-records",
          {
            ingredientId: ingredient.id,
            quantity: Number(data.get("qty")),
            reason:
              type === "stock"
                ? "Penerimaan stok dari frontend"
                : String(data.get("reason")),
            idempotencyKey: requestKey(fingerprint),
          },
        );
      }
      await refreshWorkspace();
      requestKeys.current.delete(fingerprint);
      notify("Data tersimpan di MySQL lokal.");
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menyimpan data");
      return false;
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  }
  async function saveMenuEdit(food: Food, edit: MenuEdit) {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setPending(true);
    try {
      if (apiMode) {
        await apiRequest("/menus/" + food.id + "/details", {
          method: "PUT",
          body: JSON.stringify({
            name: edit.name,
            category: edit.category,
            price: edit.price,
            emoji: food.emoji,
            recipe: { lines: edit.lines },
          }),
        });
      } else {
        const updated = applyMenuEdit(food, edit, stock);
        setFoods((current) =>
          current.map((f) => (f.id === food.id ? updated : f)),
        );
        setSelected(updated);
      }
      setApproved(false);
      for (const key of requestKeys.current.keys())
        if (key.startsWith('["plan"')) requestKeys.current.delete(key);
      if (apiMode) {
        try {
          await refreshWorkspace();
        } catch {
          notify(
            "Menu tersimpan, tetapi data terbaru gagal dimuat. Gunakan Coba lagi.",
          );
          return true;
        }
      }
      notify(
        apiMode
          ? "Menu dan resep tersimpan di MySQL."
          : "Menu dan resep demo diperbarui.",
      );
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gagal menyimpan menu");
      return false;
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  }
  async function archiveMenu(food: Food) {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setPending(true);
    try {
      if (apiMode) await apiRequest("/menus/" + food.id, { method: "DELETE" });
      setFoods((current) => current.filter((f) => f.id !== food.id));
      setApproved(false);
      if (apiMode) {
        try {
          await refreshWorkspace();
        } catch {
          notify(
            "Menu diarsipkan, tetapi daftar terbaru gagal dimuat. Gunakan Coba lagi.",
          );
          return true;
        }
      }
      notify("Menu diarsipkan. Riwayat di database tetap tersimpan.");
      return true;
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Gagal mengarsipkan menu",
      );
      return false;
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  }
  async function approvePlan() {
    if (approved) {
      for (const key of requestKeys.current.keys())
        if (key.startsWith('["plan"')) requestKeys.current.delete(key);
      setApproved(false);
      return;
    }
    if (!apiMode) {
      setApproved(true);
      notify("Rencana demo disetujui. Tidak ada stok aktual yang berubah.");
      return;
    }
    if (mutationLock.current) return;
    mutationLock.current = true;
    setPending(true);
    const items = foods.map((f) => ({ menuId: f.id, portions: f.portions }));
    const fingerprint = JSON.stringify(["plan", items]);
    try {
      const plan = await kitchenApi.post<{ id: number }>("/kitchen-plans", {
        businessDate: "2026-11-16",
        items,
        idempotencyKey: requestKey(fingerprint),
      });
      await kitchenApi.post("/kitchen-plans/" + plan.id + "/approve", {});
      setApproved(true);
      notify("Rencana tersimpan di MySQL. Stok belum dikonsumsi.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Gagal menyetujui rencana",
      );
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  }
  const total = foods.reduce((a, b) => a + b.portions, 0),
    chicken = foods.reduce((a, b) => a + b.chicken * b.portions, 0),
    rice = foods.reduce((a, b) => a + b.rice * b.portions, 0);
  const required = new Map<
    string,
    { name: string; unit: string; need: number; have: number }
  >();
  for (const food of foods) {
    const lines = food.recipe ?? [
      {
        ingredientId: 0,
        name: "Daging ayam",
        unit: "kg",
        quantity: food.chicken,
      },
      {
        ingredientId: 1,
        name: "Beras premium",
        unit: "kg",
        quantity: food.rice,
      },
    ];
    for (const line of lines) {
      const key = line.name + "|" + line.unit;
      const entry = required.get(key) ?? {
        name: line.name,
        unit: line.unit,
        need: 0,
        have:
          stock.find((s) => s.name === line.name && s.unit === line.unit)
            ?.qty ?? 0,
      };
      entry.need = Number(
        (entry.need + food.portions * line.quantity).toFixed(6),
      );
      required.set(key, entry);
    }
  }
  const requirements = [...required.values()];
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
    stock,
    setStock,
    wastes,
    setWastes,
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
    notify,
    go,
    total,
    chicken,
    rice,
    download,
    apiMode,
    apiReady,
    apiError,
    pending,
    refreshWorkspace,
    submitApiData,
    saveMenuEdit,
    archiveMenu,
    approvePlan,
    requirements,
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
  if (!state) throw Error("useWorkspace must be used inside WorkspaceProvider");
  return state;
}
