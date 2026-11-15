import { ChartNoAxesCombined, ClipboardList, Leaf } from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
import { Metric } from "../components/Metric";
export function WasteAnalyticsPage() {
  const { wastes, apiMode } = useWorkspace();
  return (
    <>
      <div className="notice">
        <Leaf size={20} />
        <div>
          <b>Setiap catatan adalah langkah perbaikan.</b>
          <p>
            Data ilustratif. Belum ada bukti pengurangan waste dari penggunaan
            KitchenFlow.
          </p>
        </div>
      </div>
      <div className="metrics three">
        <Metric
          title="Waste tercatat"
          value={wastes
            .filter((w) => (w.unit ?? "kg") === "kg")
            .reduce((a, b) => a + b.qty, 0)
            .toFixed(1)}
          unit="kg"
          note="Total dari catatan demo"
          icon={<Leaf size={18} />}
        />
        <Metric
          title="Catatan waste"
          value={String(wastes.length)}
          unit="catatan"
          note={
            apiMode
              ? "Semua catatan · MySQL lokal"
              : "Minggu ini · workspace demo"
          }
          icon={<ClipboardList size={18} />}
        />
        <Metric
          title="Dampak penghematan"
          value="—"
          unit=""
          note="Belum diukur di lapangan"
          icon={<ChartNoAxesCombined size={18} />}
        />
      </div>
      <section className="card">
        <div className="card-header">
          <div>
            <h3>Kenali yang tersisa</h3>
            <p>Catatan bahan terbuang dan alasannya.</p>
          </div>
          <span className="badge">Data demo</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bahan</th>
                <th>Jumlah</th>
                <th>Alasan</th>
                <th>Periode</th>
              </tr>
            </thead>
            <tbody>
              {wastes.map((w, i) => (
                <tr key={i}>
                  <td>
                    <b>{w.name}</b>
                  </td>
                  <td>
                    {w.qty} {w.unit ?? "kg"}
                  </td>
                  <td>{w.reason}</td>
                  <td>{apiMode ? "Semua periode" : "Minggu ini"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
