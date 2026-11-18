import { useEffect, useState } from "react";
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
import { apiRequest, kitchenApi } from "../services/api";
import { jakartaToday, tomorrowDate, type ForecastResult, type Sale } from "../types/forecast";
import { SalesCsvImport } from "../components/SalesCsvImport";
import { ForecastBacktests } from "../components/ForecastBacktests";

export function ForecastingPage() {
  const { foods, setFoods, go, notify, apiMode, setApproved, setPlanDate } = useWorkspace();
  const [sales, setSales] = useState<Sale[]>([]);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuId, setMenuId] = useState("");
  const [day, setDay] = useState(jakartaToday());
  const [quantity, setQuantity] = useState("0");
  const [flag, setFlag] = useState("normal");
  const target = tomorrowDate();
  async function loadSales() {
    setLoading(true);
    try { setSales(await apiRequest<Sale[]>("/sales")); }
    catch (e) { setError(e instanceof Error ? e.message : "Riwayat gagal dimuat"); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (apiMode) void loadSales(); }, [apiMode]);
  async function refreshAfterSale() {
    setResult(null);
    setFoods(current => current.map(f => ({ ...f, forecast: 0 })));
    await loadSales();
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setSaved("");
    try {
      await kitchenApi.post("/sales", { menuId: Number(menuId), businessDate: day,
        quantity: flag === "closed" ? 0 : Number(quantity), closed: flag === "closed", stockout: flag === "stockout" });
      setSaved("Penjualan tersimpan. Jalankan ulang estimasi setelah pencatatan hari ini selesai.");
      await refreshAfterSale();
    } catch (e) { setError(e instanceof Error ? e.message : "Penjualan gagal disimpan"); }
    finally { setBusy(false); }
  }
  async function run() {
    if (busy) return;
    setBusy(true); setError(""); setResult(null); setSaved("");
    try {
      setResult(await apiRequest<ForecastResult>("/forecast-runs", {
        method: "POST", body: JSON.stringify({ targetDate: target }), signal: AbortSignal.timeout(40000),
      }));
    } catch (e) { setError(e instanceof Error ? e.message : "Estimasi gagal diproses"); }
    finally { setBusy(false); }
  }
  function usePlan() {
    if (!result || result.status !== "READY") return;
    if (result.targetDate !== tomorrowDate()) { setError("Tanggal sudah berganti. Jalankan estimasi kembali."); return; }
    setFoods(current => current.map(f => {
      const row = result.items.find(i => i.menuId === f.id);
      return row?.quantity != null ? { ...f, forecast: row.quantity, portions: row.quantity } : f;
    }));
    setPlanDate(result.targetDate); setApproved(false);
    notify("Estimasi disalin ke draft. Tinjau porsi dan resep sebelum menyetujui.");
    go("Kitchen Planner");
  }
  if (!apiMode) return <section className="card forecast-panel"><h3>Forecasting membutuhkan data penjualan</h3><p>Gunakan mode API untuk mencatat penjualan dan menjalankan model Python. Data demo tidak dipakai sebagai hasil prediksi.</p></section>;
  const ready = result?.items.filter(i => i.status === "READY") ?? [];
  const canPlan = result?.status === "READY" && result.items.length === foods.length && ready.every(i => foods.some(f => f.id === i.menuId) && i.quantity != null && i.quantity <= 9999);
  return <>
    <div className="notice"><Sparkles size={22} /><div><b>Dari riwayat menjadi persiapan</b><p>Estimasi penjualan besok · {target} · Asia/Jakarta. Jalankan setelah seluruh penjualan hari ini dicatat. Tutup dan stockout dipisahkan dari data latihan.</p></div><span className="badge green">Python ML</span></div>
    {error && <div className="forecast-alert" role="alert">{error}</div>}
    {saved && <div className="notice" role="status">{saved}</div>}
    <div className="dashboard-grid">
      <section className="card forecast-panel">
        <div className="card-header"><div><h3>Catat penjualan harian</h3><p>Total akhir per menu per tanggal. Tanggal yang sama mengganti catatan sebelumnya.</p></div></div>
        <form onSubmit={save} className="forecast-form">
          <label>Menu<select required value={menuId} onChange={e => setMenuId(e.target.value)}><option value="">Pilih menu</option>{foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          <label>Tanggal<input required type="date" max={jakartaToday()} value={day} onChange={e => setDay(e.target.value)} /></label>
          <label>Kondisi hari<select value={flag} onChange={e => setFlag(e.target.value)}><option value="normal">Buka · stok mencukupi</option><option value="stockout">Buka · kehabisan stok</option><option value="closed">Tutup</option></select></label>
          <label>Porsi terjual<input required type="number" min="0" max="1000000" step="1" disabled={flag === "closed"} value={flag === "closed" ? "0" : quantity} onChange={e => setQuantity(e.target.value)} /></label>
          <button disabled={busy || foods.length === 0} className="button primary">{busy ? "Memproses…" : "Simpan penjualan"}</button>
        </form>
      </section>
      <section className="card forecast-panel forecast-summary">
        <Sparkles size={28} /><h3>Estimasi besok</h3><p>Minimal 42 catatan hari buka tanpa stockout dalam 84 hari terakhir untuk setiap menu. Data terakhir maksimal 7 hari lalu.</p>
        <h2>{ready.length ? ready.reduce((sum, i) => sum + (i.quantity ?? 0), 0) : "—"} <span>porsi{result?.status === "PARTIAL" ? " · sebagian menu" : ""}</span></h2>
        <button className="button primary full" disabled={busy || foods.length === 0} onClick={() => void run()}><RefreshCw size={16} />{busy ? "Memproses…" : "Jalankan estimasi"}</button>
        <p>Random Forest dibandingkan dengan rata-rata hari sejenis. Model sederhana dipilih bila peningkatan MAE oleh ML kurang dari 5%.</p>
        <button className="button white full" disabled={!canPlan || busy} onClick={usePlan}>Salin ke draft rencana <ArrowRight size={16} /></button>
        {result && !canPlan && <small>Draft otomatis tersedia setelah semua menu memiliki estimasi dan masing-masing tidak melebihi 9.999 porsi. Rencana manual tetap tersedia.</small>}
      </section>
    </div>
    <section className="card">
      <div className="card-header"><div><h3>Hasil per menu</h3><p>{result ? `${result.windowStart} s.d. ${result.windowEnd} · ${result.version}` : "Belum ada hasil. Estimasi tidak dibuat dari angka ilustratif."}</p></div>{result && <span className="badge">{result.status === "READY" ? "Siap ditinjau" : "Data belum lengkap"}</span>}</div>
      {result && <div className="table-wrap"><table><thead><tr><th>Menu</th><th>Hari valid</th><th>Estimasi</th><th>Model & evaluasi</th></tr></thead><tbody>{result.items.map(i => <tr key={i.menuId}>
        <td><b>{i.name}</b><p>{i.reason}</p><details><summary>Catatan data</summary>{i.warnings.map(w => <p key={w}>{w}</p>)}</details></td><td>{i.observations}/42 minimum</td><td>{i.quantity == null ? "Belum tersedia" : `${i.quantity} porsi`}</td><td>{i.evaluation ? <><b>{i.method === "random_forest" ? "Random Forest" : "Rata-rata hari sejenis"}</b><p>MAE baseline: {i.evaluation.baseline.mae} · RF: {i.evaluation.randomForest.mae}</p><p>WAPE baseline: {i.evaluation.baseline.wape == null ? "N/A" : i.evaluation.baseline.wape + "%"} · RF: {i.evaluation.randomForest.wape == null ? "N/A" : i.evaluation.randomForest.wape + "%"}</p><small>Uji {i.evaluation.testCount} hari: {i.evaluation.testStart} – {i.evaluation.testEnd}. MAE dalam porsi; WAPE lebih kecil lebih baik. Bukan persentase akurasi.</small></> : "Evaluasi belum tersedia"}</td>
      </tr>)}</tbody></table></div>}
    </section>
    <ForecastBacktests menus={foods} />
    <SalesCsvImport menus={foods} busy={busy || loading} setBusy={setBusy} onImported={refreshAfterSale} />
    <section className="card"><div className="card-header"><div><h3>Riwayat penjualan terbaru</h3><p>Model membaca 84 hari langsung dari database. Tampilan di bawah menampilkan 30 dari maksimal 365 catatan terbaru.</p></div><button className="button white" disabled={loading || busy} onClick={() => void loadSales()}>Muat ulang</button></div>
      <div className="table-wrap"><table><thead><tr><th>Tanggal</th><th>Menu</th><th>Porsi</th><th>Kondisi</th></tr></thead><tbody>{sales.slice(0, 30).map(s => <tr key={s.menuId + s.businessDate}><td>{s.businessDate.slice(0, 10)}</td><td>{s.menu.name}</td><td>{s.quantity}</td><td>{s.closed ? "Tutup" : s.stockout ? "Kehabisan stok" : "Normal"}</td></tr>)}{!sales.length && <tr><td colSpan={4}>{loading ? "Memuat riwayat…" : "Belum ada penjualan. Mulai catat data aktual melalui formulir di atas."}</td></tr>}</tbody></table></div>
    </section>
  </>;
}
