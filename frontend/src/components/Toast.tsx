import { X, Check } from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
export function Toast() {
  const { toast, setToast } = useWorkspace();
  return (
    toast && (
      <div className="toast" role="status">
        <Check size={17} />
        {toast}
        <button aria-label="Tutup notifikasi" onClick={() => setToast("")}>
          <X size={15} />
        </button>
      </div>
    )
  );
}
