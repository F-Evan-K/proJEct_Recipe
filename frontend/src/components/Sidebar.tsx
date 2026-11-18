import { useAuth } from "../auth/AuthContext";
import { Users, LogOut } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  UtensilsCrossed,
  ChartNoAxesCombined,
  ClipboardList,
  Leaf,
  ArrowUpRight,
  ChevronDown,
  ChefHat,
  CircleHelp,
} from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
import { pages } from "../data/navigation";
const icons = [
  LayoutDashboard,
  Package,
  UtensilsCrossed,
  ChartNoAxesCombined,
  ClipboardList,
  Leaf,
  Users,
];
export function Sidebar() {
  const { user, isAdmin, logout, busy, error } = useAuth();
  const { page, mobile, go, notify } = useWorkspace();
  return (
    <aside className={mobile ? "sidebar open" : "sidebar"}>
      <a className="brand" onClick={() => go("Dashboard")}>
        <span className="brand-icon">
          <ChefHat size={25} />
        </span>
        <div>
          kitchenflow<span>by proJEct_Recipe</span>
        </div>
      </a>
      <button
        className="workspace"
        onClick={() =>
          notify("Workspace demo menggunakan satu outlet: Dapur Nusantara.")
        }
      >
        <span className="outlet">D</span>
        <span>
          Dapur Nusantara<small>Jakarta Selatan · Outlet 01</small>
        </span>
        <ChevronDown size={15} />
      </button>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        {pages
          .filter((p) => p !== "Kelola Akun" || isAdmin)
          .map((p, i) => {
            const Icon = icons[i];
            return (
              <button
                key={p}
                className={p === page ? "active" : ""}
                onClick={() => go(p)}
              >
                <Icon size={19} />
                {p}
                {p === "AI Forecasting" && <span className="tiny">AI</span>}
              </button>
            );
          })}
      </nav>
      <div className="side-bottom">
        <div className="side-promo">
          <span className="mini-leaf">
            <Leaf size={18} />
          </span>
          <b>Less waste. More possibility.</b>
          <p>Langkah kecil untuk dapur yang lebih berkelanjutan.</p>
          <span>
            Cook smarter, every day <ArrowUpRight size={13} />
          </span>
        </div>
        <button
          className="help"
          onClick={() =>
            notify(
              "Mode demo: jelajahi halaman dan coba buat rencana produksi.",
            )
          }
        >
          <CircleHelp size={18} /> Pusat bantuan <ArrowUpRight size={14} />
        </button>
        {error && (
          <p className="editor-error" role="alert">
            {error}
          </p>
        )}
        <div className="profile">
          <div className="avatar">{user?.name.slice(0, 2).toUpperCase()}</div>
          <div>
            {user?.name}
            <small>{isAdmin ? "Pemilik / Admin" : "Staf"}</small>
          </div>
          <button
            className="icon-btn"
            aria-label="Keluar akun"
            disabled={busy}
            onClick={() => void logout()}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
