import { useState, type ChangeEvent } from "react";
import { Download, Upload } from "lucide-react";
import { ApiError, apiRequest } from "../services/api";

type Condition = "normal" | "stockout" | "tutup";
type Action = "create" | "update" | "unchanged";
type Values = { quantity: number; condition: Condition };
type Counts = Record<Action, number>;
type Preview = {
  rows: (Values & {
    line: number;
    menuName: string;
    businessDate: string;
    action: Action;
    previous: Values | null;
  })[];
  issues: { line: number; message: string }[];
  counts: Counts;
  fingerprint: string | null;
};
type Props = {
  menus: { id: number; name: string }[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onImported: () => Promise<void>;
};

const actions: Record<Action, string> = { create: "Tambah", update: "Ganti", unchanged: "Sama" };
const conditions: Record<Condition, string> = { normal: "Normal", stockout: "Kehabisan stok", tutup: "Tutup" };
const pageSize = 25;
const template = "data:text/csv;charset=utf-8," + encodeURIComponent("menu_id,tanggal,porsi,kondisi\r\n");

export function SalesCsvImport({ menus, busy, setBusy, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Counts | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<Action | "all">("all");

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setPreview(null);
    setCsv("");
    setError("");
    setDone(null);
  }

  async function inspect() {
    if (!file || busy) return;
    setBusy(true);
    setPreview(null);
    setDone(null);
    setError("");
    try {
      if (file.size > 60000) throw Error("Ukuran CSV maksimal 60 KB.");
      let source: string;
      try {
        source = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      } catch {
        throw Error("File tidak dapat dibaca. Simpan sebagai CSV UTF-8 lalu coba lagi.");
      }
      const result = await apiRequest<Preview>("/sales/import/preview", {
        method: "POST",
        body: JSON.stringify({ csv: source }),
      });
      setCsv(source);
      setPage(0);
      setFilter(result.counts.update > 0 ? "update" : "all");
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pratinjau gagal dibuat.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview?.fingerprint || busy) return;
    setBusy(true);
    setError("");
    try {
      const counts = await apiRequest<Counts>("/sales/import", {
        method: "POST",
        body: JSON.stringify({ csv, fingerprint: preview.fingerprint }),
        signal: AbortSignal.timeout(40000),
      });
      setPreview(null);
      setDone(counts);
      await onImported();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setPreview(null);
      setError(err instanceof Error ? err.message : "Impor gagal.");
    } finally {
      setBusy(false);
    }
  }

  const rows = preview?.rows.filter(row => filter === "all" || row.action === filter) ?? [];
  const visibleRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const visibleIssues = preview?.issues.slice(0, 20) ?? [];
  const changes = preview ? preview.counts.create + preview.counts.update : 0;

  return (
    <section className="card sales-import" aria-labelledby="sales-import-title">
      <div className="card-header">
        <div>
          <h3 id="sales-import-title">Impor riwayat penjualan</h3>
          <p>Masukkan hingga 1.000 total harian per file. Periksa perubahan sebelum menyimpan.</p>
        </div>
        <a className="button white" href={template} download="template-penjualan.csv">
          <Download size={16} /> Unduh template
        </a>
      </div>
      <div className="sales-import-body">
        <p>
          Isi tanggal dalam format YYYY-MM-DD. Gunakan <code>normal</code>, <code>stockout</code>,
          {" "}atau <code>tutup</code> pada kolom kondisi. Hari tutup harus berisi 0 porsi.
          Simpan sebagai CSV UTF-8.
        </p>
        <details>
          <summary>Lihat ID menu aktif</summary>
          {menus.length ? (
            <ul className="sales-menu-ids">
              {menus.map(menu => <li key={menu.id}><b>{menu.id}</b> · {menu.name}</li>)}
            </ul>
          ) : <p>Tambahkan menu dari Menu &amp; Resep.</p>}
        </details>
        <div className="sales-import-actions">
          <label>File CSV
            <input type="file" accept=".csv,text/csv" disabled={busy} onChange={chooseFile} />
          </label>
          <button type="button" className="button white" disabled={!file || busy} onClick={() => void inspect()}>
            <Upload size={16} /> Periksa CSV
          </button>
        </div>
        {error && <p className="forecast-alert" role="alert">{error}</p>}
        {done && <p className="notice" role="status">
          Impor selesai. {done.create} ditambah, {done.update} diganti, {done.unchanged} sama.
          Jalankan ulang estimasi untuk memakai catatan terbaru.
        </p>}
        {preview && (
          <div className="sales-preview">
            <p role="status">
              {preview.counts.create} tambah · {preview.counts.update} ganti · {preview.counts.unchanged} sama · {preview.issues.length} bermasalah
            </p>
            {visibleIssues.length > 0 && (
              <div className="forecast-alert" role="alert">
                <b>Perbaiki CSV sebelum menyimpan.</b>
                <ul>{visibleIssues.map(issue => <li key={issue.line}>Baris {issue.line} · {issue.message}</li>)}</ul>
                {preview.issues.length > visibleIssues.length && <p>{preview.issues.length - visibleIssues.length} baris bermasalah lainnya.</p>}
              </div>
            )}
            {preview.rows.length > 0 && (
              <>
                <label>Tampilkan{" "}
                  <select value={filter} onChange={event => {
                    setFilter(event.target.value as typeof filter);
                    setPage(0);
                  }}>
                    <option value="all">Semua baris valid</option>
                    <option value="create">Catatan baru</option>
                    <option value="update">Catatan yang diganti</option>
                    <option value="unchanged">Catatan yang sama</option>
                  </select>
                </label>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Baris</th><th>Menu</th><th>Tanggal</th><th>Sebelumnya</th><th>Dari CSV</th><th>Aksi</th></tr></thead>
                    <tbody>
                      {visibleRows.map(row => (
                        <tr key={row.line}>
                          <td>{row.line}</td><td>{row.menuName}</td><td>{row.businessDate}</td>
                          <td>{row.previous ? `${row.previous.quantity} · ${conditions[row.previous.condition]}` : "—"}</td>
                          <td>{row.quantity} · {conditions[row.condition]}</td><td>{actions[row.action]}</td>
                        </tr>
                      ))}
                      {visibleRows.length === 0 && <tr><td colSpan={6}>Tidak ada baris pada pilihan ini.</td></tr>}
                    </tbody>
                  </table>
                </div>
                {rows.length > pageSize && (
                  <div className="sales-import-actions">
                    <button type="button" className="button white" disabled={page === 0} onClick={() => setPage(page - 1)}>Sebelumnya</button>
                    <span>{page + 1} dari {Math.ceil(rows.length / pageSize)}</span>
                    <button type="button" className="button white" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage(page + 1)}>Berikutnya</button>
                  </div>
                )}
              </>
            )}
            {preview.fingerprint && (
              <button type="button" className="button primary" disabled={busy || !changes} onClick={() => void commit()}>
                {changes ? `Simpan ${changes} perubahan` : "Semua catatan sudah sama"}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
