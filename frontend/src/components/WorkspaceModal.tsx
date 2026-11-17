import { MenuEditorModal } from "./MenuEditorModal";
import { ArrowRight, X, Check, Menu } from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
export function WorkspaceModal() {
  const {
    modal,
    setModal,
    selected,
    go,
    stock,
    setStock,
    foods,
    setFoods,
    wastes,
    setWastes,
    notify,
    apiMode,
    pending,
    submitApiData,
  } = useWorkspace();
  if (modal === "edit-menu") return <MenuEditorModal key={selected.id} />;
  return (
    modal && (
      <div className="modal-backdrop" onClick={() => setModal(null)}>
        <section
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={modal === "recipe" ? "Detail resep" : "Tambah data demo"}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="modal-close icon-btn"
            aria-label="Tutup"
            onClick={() => setModal(null)}
          >
            <X size={20} />
          </button>
          {modal === "recipe" ? (
            <>
              <span className="recipe-emoji">{selected.emoji}</span>
              <span className="eyebrow">RESEP CONTOH · PER PORSI</span>
              <h2>{selected.name}</h2>
              <p>Preview bahan untuk kalkulasi planner.</p>
              {apiMode ? (
                <>
                  {selected.recipe?.length ? (
                    selected.recipe.map((line) => (
                      <div className="recipe-line" key={line.ingredientId}>
                        <span>{line.name}</span>
                        <b>
                          {line.quantity} {line.unit}
                        </b>
                      </div>
                    ))
                  ) : (
                    <p>
                      Resep belum diisi. Lengkapi melalui API sebelum produksi.
                    </p>
                  )}
                </>
              ) : (
                <>
                  {" "}
                  <div className="recipe-line">
                    <span>Daging ayam</span>
                    <b>{(selected.chicken * 1000).toFixed(0)} g</b>
                  </div>
                  <div className="recipe-line">
                    <span>Beras</span>
                    <b>{(selected.rice * 1000).toFixed(0)} g</b>
                  </div>
                </>
              )}
              <div className="notice compact">
                Resep belum lengkap. Bumbu dan bahan lain belum dimodelkan.
              </div>
              <button
                className="button primary full"
                onClick={() => {
                  setModal(null);
                  go("Kitchen Planner");
                }}
              >
                Buka planner <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <>
              <span className="eyebrow">WORKSPACE DEMO</span>
              <h2>
                {modal === "stock"
                  ? "Tambah stok bahan"
                  : modal === "menu"
                    ? "Tambah menu baru"
                    : "Catat bahan terbuang"}
              </h2>
              <p>
                {apiMode
                  ? "Data disimpan ke MySQL lokal. Waste akan mengurangi stok bahan."
                  : "Perubahan hanya tersimpan selama sesi ini."}
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  if (apiMode) {
                    if (await submitApiData(modal, d)) setModal(null);
                    return;
                  }
                  if (modal === "stock") {
                    const name = String(d.get("name"));
                    setStock(
                      stock.map((s) =>
                        s.name === name
                          ? { ...s, qty: s.qty + Number(d.get("qty")) }
                          : s,
                      ),
                    );
                    notify("Stok demo diperbarui");
                  } else if (modal === "menu") {
                    setFoods([
                      ...foods,
                      {
                        id: Date.now(),
                        name: String(d.get("name")),
                        category: "Menu baru",
                        price: Number(d.get("price")),
                        forecast: 0,
                        portions: 0,
                        chicken: 0,
                        rice: 0,
                        emoji: "🍽️",
                      },
                    ]);
                    notify(
                      "Menu ditambahkan. Lengkapi resep sebelum produksi.",
                    );
                  } else {
                    setWastes([
                      ...wastes,
                      {
                        name: String(d.get("name")),
                        qty: Number(d.get("qty")),
                        reason: String(d.get("reason")),
                      },
                    ]);
                    notify("Catatan waste demo ditambahkan");
                  }
                  setModal(null);
                }}
              >
                <label>
                  {modal === "stock"
                    ? "Bahan"
                    : "Nama " + (modal === "menu" ? "menu" : "bahan")}
                  {modal === "stock" || (apiMode && modal === "waste") ? (
                    <select name="name">
                      {stock.map((s) => (
                        <option key={s.name}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name="name"
                      required
                      maxLength={80}
                      placeholder={
                        modal === "menu" ? "Contoh: Soto Ayam" : "Contoh: Cabai"
                      }
                    />
                  )}
                </label>
                <label>
                  {modal === "menu"
                    ? "Harga per porsi (Rp)"
                    : modal === "waste"
                      ? "Jumlah (kg)"
                      : "Jumlah tambahan (sesuai satuan bahan)"}
                  <input
                    name={modal === "menu" ? "price" : "qty"}
                    type="number"
                    required
                    min="0.01"
                    max="100000000"
                    step="0.01"
                  />
                </label>
                {modal === "waste" && (
                  <label>
                    Alasan
                    <select name="reason">
                      <option>Produksi berlebih</option>
                      <option>Kualitas menurun</option>
                      <option>Sisa persiapan</option>
                      <option>Lainnya</option>
                    </select>
                  </label>
                )}
                <button
                  className="button primary full"
                  type="submit"
                  disabled={pending}
                >
                  <Check size={16} />
                  {pending
                    ? "Menyimpan..."
                    : apiMode
                      ? "Simpan data"
                      : "Simpan data demo"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    )
  );
}
