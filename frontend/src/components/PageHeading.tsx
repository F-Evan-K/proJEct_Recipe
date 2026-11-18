import { useAuth } from "../auth/AuthContext";
import { ChevronDown, Plus, CalendarDays, Download, Menu } from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
export function PageHeading() {
  const { isAdmin } = useAuth();
  const { page, period, setPeriod, download, setForecasted, notify, setModal } =
    useWorkspace();
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          {page === "Dashboard" ? "YOUR KITCHEN, IN SYNC" : "DAPUR NUSANTARA"}
        </div>
        <h1>
          {page === "Dashboard" ? "A good day starts with a good plan." : page}
        </h1>
        <p>
          {page === "Dashboard"
            ? "Selamat datang, tim KitchenFlow. Mari siapkan dapur untuk hari yang lebih baik."
            : page === "Kitchen Planner"
              ? "Dari prediksi menjadi persiapan. Kamu tetap pegang kendali."
              : page === "AI Forecasting"
                ? "Lihat estimasi permintaan dan rencanakan satu langkah lebih awal."
                : page === "Inventory"
                  ? "Kenali stokmu. Siapkan yang cukup, tanpa berlebih."
                  : page === "Menu & Resep"
                    ? "Resep yang terukur untuk setiap porsi yang istimewa."
                    : page === "Kelola Akun"
                      ? "Kelola akses tim dapurmu dengan jelas dan aman."
                      : "Kenali yang tersisa, perbaiki yang bisa."}
        </p>
      </div>
      <div className="heading-action">
        {page === "Kelola Akun" ? (
          <span className="badge green">Pemilik / Admin</span>
        ) : !isAdmin && (page === "Inventory" || page === "Menu & Resep") ? (
          <span className="badge">Akses baca · Staf</span>
        ) : page === "Dashboard" ? (
          <button
            className="button white"
            onClick={() =>
              setPeriod(period === "Minggu ini" ? "Minggu lalu" : "Minggu ini")
            }
          >
            <CalendarDays size={16} />
            {period}
            <ChevronDown size={14} />
          </button>
        ) : page === "Kitchen Planner" ? (
          <button className="button white" onClick={download}>
            <Download size={16} />
            Ekspor rencana
          </button>
        ) : (
          <button
            className="button primary"
            onClick={() => {
              if (page === "AI Forecasting") {
                setForecasted(true);
                notify(
                  "Simulasi diperbarui. Angka tetap data demo, belum berasal dari model ML.",
                );
              } else
                setModal(
                  page === "Inventory"
                    ? "stock"
                    : page === "Menu & Resep"
                      ? "menu"
                      : "waste",
                );
            }}
          >
            <Plus size={16} />
            {page === "Inventory"
              ? "Tambah stok"
              : page === "Menu & Resep"
                ? "Tambah menu"
                : page === "AI Forecasting"
                  ? "Simulasikan forecast"
                  : "Catat waste"}
          </button>
        )}
      </div>
    </div>
  );
}
