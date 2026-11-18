import { useAuth } from "../auth/AuthContext";
import { UtensilsCrossed, ArrowUpRight, Search, Pencil } from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
import { money } from "../utils/format";
export function MenuRecipesPage() {
  const { isAdmin } = useAuth();
  const { foods, search, setSearch, setSelected, setModal, apiMode } =
    useWorkspace();
  return (
    <>
      <div className="section-toolbar">
        <span>{foods.length} menu di dapurmu</span>
        <label className="search">
          <Search size={16} />
          <input
            placeholder="Cari menu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {foods.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
        .length === 0 && (
        <div className="empty">
          Tidak ada menu yang cocok. Tambahkan menu atau ubah pencarian.
        </div>
      )}
      <div className="recipe-grid">
        {foods
          .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
          .map((f) => (
            <section className="card recipe-card" key={f.id}>
              <div className={"recipe-art food-" + f.id}>
                {f.emoji}
                <span className="badge">
                  {apiMode ? "Aktif · Tersimpan" : "Aktif · Demo"}
                </span>
              </div>
              <div className="recipe-body">
                <span className="eyebrow">{f.category}</span>
                <h3>{f.name}</h3>
                <p>
                  {money(f.price)} <span>/ porsi</span>
                </p>
                <button
                  disabled={!isAdmin}
                  title={
                    isAdmin
                      ? "Edit menu dan resep"
                      : "Hanya pemilik/admin dapat mengubah menu"
                  }
                  className="button white full menu-edit-button"
                  onClick={() => {
                    setSelected(f);
                    setModal("edit-menu");
                  }}
                >
                  <Pencil size={14} />
                  Edit menu & resep
                </button>
                <div className="recipe-bottom">
                  <span>
                    <UtensilsCrossed size={14} /> Resep per porsi
                  </span>
                  <button
                    className="text-btn"
                    onClick={() => {
                      setSelected(f);
                      setModal("recipe");
                    }}
                  >
                    Lihat resep <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
            </section>
          ))}
      </div>
    </>
  );
}
