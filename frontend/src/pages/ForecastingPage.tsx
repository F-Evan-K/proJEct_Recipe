import { ArrowRight, Sparkles } from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
import { Chart } from "../components/Chart";
import { FoodTable } from "../components/FoodTable";
export function ForecastingPage() {
  const { forecasted, foods, go } = useWorkspace();
  return (
    <>
      <div className="notice">
        <Sparkles size={20} />
        <div>
          <b>Forecast preview</b>
          <p>
            {forecasted ? "Simulasi diperbarui. " : " "}Angka ini data demo
            untuk mencoba tampilan. Belum terhubung dengan model machine
            learning.
          </p>
        </div>
        <span className="badge green">Demo</span>
      </div>
      <div className="dashboard-grid">
        <section className="card trend">
          <div className="card-header">
            <div>
              <h3>Riwayat & estimasi permintaan</h3>
              <p>Contoh visual · bukan hasil evaluasi model</p>
            </div>
            <span className="badge">Harian</span>
          </div>
          <Chart period="Minggu ini" />
        </section>
        <section className="card forecast-summary">
          <Sparkles size={24} />
          <p>ESTIMASI BESOK</p>
          <h2>
            {foods.reduce((a, b) => a + b.forecast, 0)} <span>porsi</span>
          </h2>
          <p>Senin, 16 November 2026</p>
          <hr />
          <small>
            Model: belum terhubung
            <br />
            Evaluasi MAE / WAPE: belum tersedia
            <br />
            Sumber: data ilustratif
          </small>
          <button
            className="button primary full"
            onClick={() => go("Kitchen Planner")}
          >
            Buat rencana dapur <ArrowRight size={16} />
          </button>
        </section>
      </div>
      <section className="card">
        <div className="card-header">
          <div>
            <h3>Estimasi per menu</h3>
            <p>Gunakan sebagai titik awal, tinjau sebelum menyetujui.</p>
          </div>
        </div>
        <FoodTable foods={foods} />
      </section>
    </>
  );
}
