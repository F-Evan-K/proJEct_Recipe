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
];
export function Sidebar() {
  const { page, mobile, go, notify } = useWorkspace();
  return (
    <aside className={mobile ? "sidebar open" : "sidebar"}>
      <a className="brand" onClick={() => go("Dashboard")}>
        <span className="brand-icon">
          <ChefHat size={25} />
        </span>
        <div>
          kitchenflow<span>BY CULINA LABS</span>
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
        {pages.map((p, i) => {
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
        <div className="profile">
          <div className="avatar">CL</div>
          <div>
            Culina Labs<small>Workspace admin</small>
          </div>
          <span className="online" />
        </div>
      </div>
    </aside>
  );
}
