import { useState } from "react";
import { Download } from "lucide-react";
import type { BacktestDetail, BacktestResult, BacktestSummary, ModelKey, SkipReason } from "../types/backtest";

const models: [ModelKey, string][] = [
  ["baseline", "Rata-rata hari sejenis"],
  ["randomForest", "Random Forest"],
  ["selected", "Strategi KitchenFlow"],
];
const reasons: Record<SkipReason, string> = {
  MISSING_ACTUAL: "Belum dicatat",
  CLOSED: "Hari tutup",
  STOCKOUT: "Kehabisan stok",
  INSUFFICIENT_HISTORY: "Riwayat kurang dari 42 hari valid",
  STALE_HISTORY: "Catatan terakhir terlalu lama",
};
const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });

function Scores({ summary }: { summary: BacktestSummary }) {
  return (
    <div className="backtest-scores">
      <p><b>{summary.scored} dari {summary.expected}</b> pasangan menu dan tanggal bisa dinilai.</p>
      {summary.scores ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Strategi</th><th>MAE (porsi)</th><th>WAPE</th><th>Bias (porsi)</th></tr></thead>
            <tbody>
              {models.map(([key, name]) => {
                const score = summary.scores![key];
                return (
                  <tr key={key}>
                    <th scope="row">{name}</th>
                    <td>{number.format(score.mae)}</td>
                    <td>{score.wape === null ? "—" : number.format(score.wape) + "%"}</td>
                    <td>{score.bias > 0 ? "+" : ""}{number.format(score.bias)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p>Belum ada penjualan yang memenuhi syarat untuk dihitung galatnya.</p>}
      {Object.keys(summary.skipped).length > 0 && (
        <ul className="backtest-skip-list">
          {Object.entries(summary.skipped).map(([key, count]) => (
            <li key={key}>{reasons[key as SkipReason]} · {count}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PredictionsChart({ menu }: { menu: BacktestResult["menus"][number] }) {
  const maximum = Math.max(1, ...menu.days.map(day => (
    day.status === "SCORED" ? Math.max(day.actual, day.selected) : 0
  )));
  if (!menu.summary.scored) return null;
  return (
    <div className="backtest-chart" role="img" aria-label={`Grafik aktual dan prediksi KitchenFlow untuk ${menu.name}. Rincian tersedia di tabel.`}>
      <div className="backtest-chart-legend" aria-hidden="true">
        <span className="legend-actual">Aktual</span>
        <span className="legend-prediction">Strategi KitchenFlow</span>
        <span>0–{number.format(maximum)} porsi</span>
      </div>
      <div className="backtest-chart-bars" aria-hidden="true">
        {menu.days.map(day => (
          <div className="backtest-chart-day" key={day.date} title={day.status === "SCORED" ?
            `${day.date} · aktual ${day.actual} · prediksi ${day.selected}` : `${day.date} · ${reasons[day.status]}`}>
            <div className="backtest-chart-pair">
              {day.status === "SCORED" && (
                <>
                  <span style={{ height: `${day.actual / maximum * 100}%` }} />
                  <span style={{ height: `${day.selected / maximum * 100}%` }} />
                </>
              )}
            </div>
            <small>{day.date.slice(8)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function exportCsv(run: BacktestDetail, result: BacktestResult) {
  const header = "run_id,source_hash,versi_model,menu_id,tanggal,status,riwayat_valid,riwayat_terakhir,aktual,baseline,random_forest,kitchenflow,model_terpilih";
  const rows = result.menus.flatMap(menu => menu.days.map(day => [
    run.id, run.sourceHash, result.modelVersion, menu.menuId, day.date, day.status,
    day.historyCount, day.lastHistoryDate, day.actual,
    ...(day.status === "SCORED" ? [day.baseline, day.randomForest, day.selected, day.selectedMethod] : ["", "", "", ""]),
  ].join(",")));
  const url = URL.createObjectURL(new Blob([[header, ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `kitchenflow-backtest-${run.id}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BacktestReport({ run, result }: { run: BacktestDetail; result: BacktestResult }) {
  const [menuId, setMenuId] = useState(result.menus[0]?.menuId);
  const [onlyScored, setOnlyScored] = useState(false);
  const menu = result.menus.find(item => item.menuId === menuId);
  return (
    <div className="backtest-report">
      <div className="backtest-report-heading">
        <div>
          <h4>Ringkasan evaluasi #{run.id}</h4>
          <p>{result.startDate} s.d. {result.endDate} · {result.modelVersion}</p>
        </div>
        <button type="button" className="button white" onClick={() => exportCsv(run, result)}>
          <Download size={16} /> Unduh hasil CSV
        </button>
      </div>
      <Scores summary={result.summary} />
      <p className="backtest-caption">
        MAE adalah rata-rata selisih dalam porsi. WAPE kosong jika total penjualan aktual nol.
        Bias positif berarti prediksi cenderung terlalu tinggi. KitchenFlow memilih model di setiap tanggal memakai riwayat sebelum tanggal itu.
      </p>
      {menu && (
        <>
          <div className="backtest-report-heading">
            <label>Rincian menu{" "}
              <select value={menuId} onChange={event => setMenuId(Number(event.target.value))}>
                {result.menus.map(item => <option key={item.menuId} value={item.menuId}>{item.name}</option>)}
              </select>
            </label>
            <label><input type="checkbox" checked={onlyScored} onChange={event => setOnlyScored(event.target.checked)} /> Hanya tanggal yang dinilai</label>
          </div>
          {result.menus.length > 1 && <Scores summary={menu.summary} />}
          <PredictionsChart menu={menu} />
          <div className="table-wrap">
            <table>
              <caption>Validasi harian · {menu.name}</caption>
              <thead><tr><th>Tanggal</th><th>Aktual</th><th>Baseline</th><th>Random Forest</th><th>KitchenFlow</th><th>Riwayat valid</th><th>Hasil</th></tr></thead>
              <tbody>
                {menu.days.filter(day => !onlyScored || day.status === "SCORED").map(day => (
                  <tr key={day.date}>
                    <th scope="row">{day.date}</th><td>{day.actual ?? "—"}</td>
                    <td>{day.status === "SCORED" ? day.baseline : "—"}</td>
                    <td>{day.status === "SCORED" ? day.randomForest : "—"}</td>
                    <td>{day.status === "SCORED" ? day.selected : "—"}</td>
                    <td>{day.historyCount}{day.lastHistoryDate && <small> · hingga {day.lastHistoryDate}</small>}</td>
                    <td>{day.status === "SCORED" ?
                      (day.selectedMethod === "random_forest" ? "Pilih Random Forest" : "Pilih baseline") : reasons[day.status]}</td>
                  </tr>
                ))}
                {onlyScored && !menu.summary.scored && <tr><td colSpan={7}>Tidak ada tanggal yang dapat dinilai.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      <details className="backtest-source">
        <summary>Identitas data saat evaluasi</summary>
        <p>{run.protocol} · SHA-256 <code>{run.sourceHash}</code></p>
        <p>Perubahan catatan penjualan akan menghasilkan rangkaian evaluasi baru saat diuji ulang.</p>
      </details>
    </div>
  );
}
