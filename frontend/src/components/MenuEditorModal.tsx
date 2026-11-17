import { useEffect, useRef, useState } from "react";
import { X, Plus, Trash2, Check, Archive } from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
import {
  recipeDraft,
  stockId,
  validateMenuEdit,
  type RecipeDraft,
} from "../utils/recipe-editor";
export function MenuEditorModal() {
  const {
    selected,
    stock,
    pending,
    setModal,
    saveMenuEdit,
    archiveMenu,
    apiMode,
  } = useWorkspace();
  const [name, setName] = useState(selected.name),
    [category, setCategory] = useState(selected.category),
    [price, setPrice] = useState(String(selected.price));
  const [rows, setRows] = useState<RecipeDraft[]>(() =>
      recipeDraft(selected, stock),
    ),
    [error, setError] = useState(""),
    [confirmArchive, setConfirmArchive] = useState(false),
    [confirmDiscard, setConfirmDiscard] = useState(false);
  const formRef = useRef<HTMLFormElement>(null),
    previousFocus = useRef<HTMLElement | null>(null);
  const initial = useRef(
    JSON.stringify([
      selected.name,
      selected.category,
      String(selected.price),
      recipeDraft(selected, stock),
    ]),
  );
  const dirty =
    JSON.stringify([name, category, price, rows]) !== initial.current;
  function close() {
    if (pending) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    setModal(null);
  }
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    formRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => previousFocus.current?.focus();
  }, []);
  function trapKeys(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (confirmArchive) setConfirmArchive(false);
      else if (confirmDiscard) setConfirmDiscard(false);
      else close();
    }
    if (event.key === "Tab") {
      const elements = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ),
      );
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal menu-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-editor-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapKeys}
      >
        <button
          className="modal-close icon-btn"
          aria-label="Tutup editor menu"
          onClick={close}
          disabled={pending}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">
          MENU & RESEP · {apiMode ? "TERSIMPAN DI DATABASE" : "MODE DEMO"}
        </span>
        <h2 id="menu-editor-title">Racik setiap porsi.</h2>
        <p>
          Edit informasi menu dan bahan untuk satu porsi. Perubahan resep tidak
          langsung mengurangi stok.
        </p>
        {confirmArchive ? (
          <div className="editor-confirm">
            <h3>Arsipkan {selected.name}?</h3>
            <p>
              Menu tidak lagi muncul pada daftar aktif dan rencana baru. Riwayat
              yang sudah tersimpan tetap tersedia.
            </p>
            <div className="editor-actions">
              <button
                className="button white"
                disabled={pending}
                onClick={() => setConfirmArchive(false)}
              >
                Kembali
              </button>
              <button
                className="button danger"
                disabled={pending}
                onClick={async () => {
                  if (await archiveMenu(selected)) setModal(null);
                }}
              >
                {pending ? "Menyimpan..." : "Ya, arsipkan"}
              </button>
            </div>
          </div>
        ) : confirmDiscard ? (
          <div className="editor-confirm">
            <h3>Buang perubahan yang belum disimpan?</h3>
            <p>Perubahan di formulir ini belum tersimpan.</p>
            <div className="editor-actions">
              <button
                className="button white"
                onClick={() => setConfirmDiscard(false)}
              >
                Lanjut mengedit
              </button>
              <button className="button danger" onClick={() => setModal(null)}>
                Buang perubahan
              </button>
            </div>
          </div>
        ) : (
          <form
            ref={formRef}
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              try {
                const edit = validateMenuEdit(
                  name,
                  category,
                  price,
                  rows,
                  stock,
                );
                if (await saveMenuEdit(selected, edit)) setModal(null);
                else
                  setError(
                    "Belum tersimpan. Periksa notifikasi, lalu coba lagi.",
                  );
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Periksa kembali formulir.",
                );
              }
            }}
          >
            <fieldset disabled={pending} className="editor-fieldset">
              <div className="editor-fields">
                <label>
                  Nama menu
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={100}
                  />
                </label>
                <label>
                  Kategori
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    maxLength={60}
                  />
                </label>
                <label>
                  Harga per porsi (Rp)
                  <input
                    type="number"
                    min="0"
                    max="100000000"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="editor-section">
                <div>
                  <h3>Bahan untuk 1 porsi</h3>
                  <p>
                    Gunakan satuan inventory: 150 g = 0.15 kg; 20 ml = 0.02
                    liter.
                  </p>
                </div>
                <button
                  className="button white"
                  type="button"
                  disabled={rows.length >= 100 || rows.length >= stock.length}
                  onClick={() => {
                    const next = stock.find(
                      (s, i) =>
                        !rows.some(
                          (r) => Number(r.ingredientId) === stockId(s, i),
                        ),
                    );
                    setRows([
                      ...rows,
                      {
                        ingredientId: next
                          ? String(stockId(next, stock.indexOf(next)))
                          : "",
                        quantity: "",
                      },
                    ]);
                  }}
                >
                  <Plus size={14} />
                  Tambah bahan
                </button>
              </div>
              {rows.length === 0 && (
                <div className="editor-empty">
                  Belum ada bahan. Resep kosong boleh disimpan sebagai draft,
                  tetapi menu tidak bisa diproduksi sampai resep diisi.
                </div>
              )}
              {stock.length === 0 && (
                <p role="status">
                  Belum ada bahan inventory. Tambahkan bahan terlebih dahulu.
                </p>
              )}
              <div className="editor-lines">
                {rows.map((row, index) => {
                  const item = stock.find(
                    (s, i) => stockId(s, i) === Number(row.ingredientId),
                  );
                  return (
                    <div className="editor-line" key={index}>
                      <label>
                        Bahan {index + 1}
                        <select
                          aria-label={"Bahan " + (index + 1)}
                          value={row.ingredientId}
                          required
                          onChange={(e) =>
                            setRows(
                              rows.map((r, i) =>
                                i === index
                                  ? {
                                      ...r,
                                      ingredientId: e.target.value,
                                      quantity: "",
                                    }
                                  : r,
                              ),
                            )
                          }
                        >
                          <option value="">Pilih bahan</option>
                          {stock.map((s, i) => (
                            <option
                              key={stockId(s, i)}
                              value={stockId(s, i)}
                              disabled={rows.some(
                                (r, j) =>
                                  j !== index &&
                                  Number(r.ingredientId) === stockId(s, i),
                              )}
                            >
                              {s.name} ({s.unit})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Jumlah / porsi
                        <div className="quantity-with-unit">
                          <input
                            aria-label={"Jumlah bahan " + (index + 1)}
                            type="number"
                            min="0.000001"
                            max="1000000"
                            step="0.000001"
                            required
                            value={row.quantity}
                            onChange={(e) =>
                              setRows(
                                rows.map((r, i) =>
                                  i === index
                                    ? { ...r, quantity: e.target.value }
                                    : r,
                                ),
                              )
                            }
                          />
                          <span>{item?.unit ?? "—"}</span>
                        </div>
                      </label>
                      <button
                        className="icon-btn"
                        type="button"
                        aria-label={"Hapus bahan " + (index + 1)}
                        onClick={() =>
                          setRows(rows.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {error && (
                <p className="editor-error" role="alert">
                  {error}
                </p>
              )}
              <div className="editor-footer">
                <button
                  type="button"
                  className="text-btn archive-button"
                  onClick={() => setConfirmArchive(true)}
                >
                  <Archive size={15} />
                  Arsipkan menu
                </button>
                <div className="editor-actions">
                  <button
                    className="button white"
                    type="button"
                    onClick={close}
                  >
                    Batal
                  </button>
                  <button className="button primary" type="submit">
                    <Check size={15} />
                    {pending ? "Menyimpan..." : "Simpan menu & resep"}
                  </button>
                </div>
              </div>
            </fieldset>
          </form>
        )}
      </section>
    </div>
  );
}
