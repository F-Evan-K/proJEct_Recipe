import { Package, ClipboardList, Leaf, Search, Plus } from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
import { Metric } from "../components/Metric";
export function InventoryPage() {
  const { stock, search, setSearch, setModal } = useWorkspace();
  return (
    <>
      <div className="metrics three">
        <Metric
          title="Bahan tersimpan"
          value={String(stock.length)}
          unit="bahan"
          note="Master bahan demo"
          icon={<Package size={18} />}
        />
        <Metric
          title="Di bawah minimum"
          value={String(stock.filter((s) => s.qty < s.min).length)}
          unit="bahan"
          note="Perlu dicek sebelum produksi"
          icon={<Leaf size={18} />}
          amber
        />
        <Metric
          title="Kategori bahan"
          value="3"
          unit="kategori"
          note="Protein, sayuran, dry goods"
          icon={<ClipboardList size={18} />}
        />
      </div>
      <section className="card">
        <div className="card-header">
          <div>
            <h3>Semua bahan</h3>
            <p>Saldo stok ilustratif untuk perencanaan.</p>
          </div>
          <label className="search">
            <Search size={16} />
            <input
              placeholder="Cari bahan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama bahan</th>
                <th>Kategori</th>
                <th>Stok tersedia</th>
                <th>Minimum</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stock
                .filter((s) =>
                  s.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((s) => (
                  <tr key={s.name}>
                    <td>
                      <b>{s.name}</b>
                    </td>
                    <td>{s.category}</td>
                    <td>
                      {s.qty} {s.unit}
                    </td>
                    <td>
                      {s.min} {s.unit}
                    </td>
                    <td>
                      <span
                        className={
                          "badge " + (s.qty < s.min ? "amber" : "green")
                        }
                      >
                        {s.qty < s.min ? "Perlu restock" : "Cukup"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-btn"
                        onClick={() => setModal("stock")}
                      >
                        Tambah <Plus size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {stock.filter((s) =>
            s.name.toLowerCase().includes(search.toLowerCase()),
          ).length === 0 && (
            <div className="empty">Tidak ada bahan yang cocok.</div>
          )}
        </div>
      </section>
    </>
  );
}
