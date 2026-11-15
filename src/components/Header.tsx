import { Bell, Menu } from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
export function Header() {
  const { page, mobile, setMobile, notify } = useWorkspace();
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <button
          className="mobile-toggle"
          aria-label="Buka navigasi"
          onClick={() => setMobile(!mobile)}
        >
          <Menu size={20} />
        </button>
        Workspace <span>/</span>
        <b>{page}</b>
      </div>
      <div className="top-actions">
        <span className="demo">
          <i />
          Demo workspace
        </span>
        <button
          className="icon-btn"
          aria-label="Notifikasi"
          onClick={() =>
            notify(
              "2 bahan di bawah batas minimum: daging ayam dan cabai hijau.",
            )
          }
        >
          <Bell size={19} />
          <i />
        </button>
        <div className="avatar small">CL</div>
      </div>
    </header>
  );
}
