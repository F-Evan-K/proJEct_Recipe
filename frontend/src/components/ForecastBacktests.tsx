import { useEffect, useState, type FormEvent } from "react";
import { FlaskConical } from "lucide-react";
import { apiRequest } from "../services/api";
import { jakartaToday } from "../types/forecast";
import type { BacktestDetail, BacktestRun } from "../types/backtest";
import { BacktestReport } from "./BacktestReport";

type Menu = { id: number; name: string };
type RunList = { items: BacktestRun[]; next: number | null };
const statusText = {
  QUEUED: "Dalam antrean",
  RUNNING: "Sedang menghitung",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
};

function previousDate(days: number) {
  const date = new Date(jakartaToday() + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function ForecastBacktests({ menus }: { menus: Menu[] }) {
  const [startDate, setStartDate] = useState(() => previousDate(14));
  const [endDate, setEndDate] = useState(() => previousDate(1));
  const [menuIds, setMenuIds] = useState<number[]>(() => menus.length ? [menus[0].id] : []);
  const [runId, setRunId] = useState<number>();
  const [detail, setDetail] = useState<BacktestDetail>();
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [failure, setFailure] = useState("");
  const [detailError, setDetailError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const period = (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1;

  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const history = await apiRequest<RunList>("/forecast-backtests", { signal: abort.signal });
        setRuns(current => {
          const known = new Set(current.map(run => run.id));
          return [...current, ...history.items.filter(run => !known.has(run.id))].sort((a, b) => b.id - a.id);
        });
        setNext(history.next);
        setRunId(current => current ?? history.items[0]?.id);
      } catch (error) {
        if (!abort.signal.aborted) setFailure(error instanceof Error ? error.message : "Riwayat gagal dimuat.");
      } finally {
        if (!abort.signal.aborted) setLoadingHistory(false);
      }
    }
    void load();
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (runId === undefined) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const run = await apiRequest<BacktestDetail>(`/forecast-backtests/${runId}`, {
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]),
        });
        if (abort.signal.aborted) return;
        setDetailError("");
        setDetail(run);
        setRuns(current => current.map(item => item.id === run.id ? run : item));
        if (run.status === "QUEUED" || run.status === "RUNNING")
          timer = setTimeout(() => void poll(), 2000);
      } catch (error) {
        if (!abort.signal.aborted)
          setDetailError(error instanceof Error ? error.message : "Hasil evaluasi gagal dimuat.");
      }
    }
    void poll();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [runId, refresh]);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !menuIds.length || period < 7 || period > 42) return;
    setSubmitting(true);
    setFailure("");
    try {
      const run = await apiRequest<BacktestRun>("/forecast-backtests", {
        method: "POST", body: JSON.stringify({ startDate, endDate, menuIds }),
      });
      setRuns(current => [run, ...current.filter(item => item.id !== run.id)].sort((a, b) => b.id - a.id));
      setDetail(undefined);
      setDetailError("");
      setRunId(run.id);
      setRefresh(value => value + 1);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Evaluasi gagal dijadwalkan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function retry(id: number) {
    setSubmitting(true);
    setFailure("");
    try {
      const run = await apiRequest<BacktestDetail>(`/forecast-backtests/${id}/retry`, { method: "POST" });
      setDetail(run);
      setRefresh(value => value + 1);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Evaluasi gagal dijadwalkan ulang.");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadMore() {
    setLoadingHistory(true);
    setFailure("");
    try {
      const history = await apiRequest<RunList>(`/forecast-backtests?before=${next}`);
      setRuns(current => [...current, ...history.items.filter(run => !current.some(item => item.id === run.id))]);
      setNext(history.next);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Riwayat gagal dimuat.");
    } finally {
      setLoadingHistory(false);
    }
  }

  const selected = detail?.id === runId ? detail : undefined;
  const periodIsValid = period >= 7 && period <= 42;
  return (
    <section className="card forecast-backtests" aria-labelledby="forecast-backtests-title">
      <div className="card-header">
        <div>
          <h3 id="forecast-backtests-title">Uji forecast dari riwayat</h3>
          <p>Simulasikan prediksi pada tanggal lampau dan bandingkan hasilnya dengan penjualan aktual.</p>
        </div>
      </div>
      <div className="backtest-body">
        <div className="backtest-controls">
          <form className="backtest-form" onSubmit={start}>
            <div className="forecast-form">
              <label>Mulai uji<input required type="date" max={previousDate(1)} value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
              <label>Akhir uji<input required type="date" min={startDate} max={previousDate(1)} value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
            </div>
            <fieldset>
              <legend>Menu yang diuji · {menuIds.length}/5</legend>
              <div className="backtest-menu-options">
                {menus.map(menu => (
                  <label key={menu.id}>
                    <input
                      type="checkbox"
                      checked={menuIds.includes(menu.id)}
                      disabled={!menuIds.includes(menu.id) && menuIds.length >= 5}
                      onChange={event => setMenuIds(previous => event.target.checked ?
                        [...previous, menu.id] : previous.filter(id => id !== menu.id))}
                    />
                    {menu.name}
                  </label>
                ))}
                {!menus.length && <p>Tambahkan menu dari Menu &amp; Resep.</p>}
              </div>
            </fieldset>
            <p className="backtest-caption">Pilih 7–42 hari. Evaluasi tetap berjalan jika kamu berpindah halaman.</p>
            <button className="button primary" disabled={submitting || !periodIsValid || !menuIds.length}>
              <FlaskConical size={18} /> {submitting ? "Menjadwalkan…" : "Jalankan backtest"}
            </button>
          </form>
          <div className="backtest-history">
            <h4>Riwayat evaluasi</h4>
            {runs.length ? (
              <ul>
                {runs.map(run => (
                  <li key={run.id}>
                    <button type="button" aria-pressed={run.id === runId} onClick={() => {
                      setDetailError("");
                      setRunId(run.id);
                      setRefresh(value => value + 1);
                    }}>
                      <span><b>#{run.id} · {run.menuCount} menu</b><small>{run.startDate.slice(0, 10)} — {run.endDate.slice(0, 10)}</small></span>
                      <span className="badge">{statusText[run.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p>{loadingHistory ? "Memuat riwayat…" : "Belum ada evaluasi tersimpan."}</p>}
            {next !== null && <button type="button" className="button white" disabled={loadingHistory} onClick={() => void loadMore()}>Muat riwayat lama</button>}
          </div>
        </div>
        {failure && <p role="alert" className="forecast-alert">{failure}</p>}
        {detailError && (
          <div role="alert" className="forecast-alert">
            <p>{detailError}</p>
            <button type="button" className="button white" onClick={() => setRefresh(value => value + 1)}>Muat ulang hasil</button>
          </div>
        )}
        {selected && (
          <div className="backtest-run">
            {selected.status === "COMPLETED" && selected.result ?
              <BacktestReport key={selected.id} run={selected} result={selected.result} /> :
              <div className="backtest-status" role="status">
                <b>Evaluasi #{selected.id} · {statusText[selected.status]}</b>
                <p>{selected.error ?? "Perhitungan berjalan di backend. Hasil tersimpan akan tampil di sini."}</p>
                {selected.status === "FAILED" && (
                  <button type="button" className="button white" disabled={submitting} onClick={() => void retry(selected.id)}>Coba ulang dengan data yang sama</button>
                )}
              </div>}
          </div>
        )}
      </div>
    </section>
  );
}
