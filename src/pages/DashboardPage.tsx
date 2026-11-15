import {
  Package,
  UtensilsCrossed,
  ChartNoAxesCombined,
  Leaf,
  ArrowUpRight,
  ArrowRight,
  Check,
  Menu,
} from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
import { Metric } from "../components/Metric";
import { Chart } from "../components/Chart";
export function DashboardPage() {
  const { foods, period, stock, wastes, go, setSelected, setModal } =
    useWorkspace();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span /> TOMORROW, THOUGHTFULLY PREPARED
          </span>
          <h2>
            Porsi yang tepat.
            <br />
            Kemungkinan yang lebih besar.
          </h2>
          <p>
            Rencana dapur besok sudah menunggu. Lihat estimasi permintaan, cek
            kebutuhan bahan, dan mulai dengan lebih tenang.
          </p>
          <button
            className="button cream"
            onClick={() => go("Kitchen Planner")}
          >
            Lihat rencana besok <ArrowRight size={17} />
          </button>
          <span className="hero-note">
            16 November 2026 · Ilustrasi data demo
          </span>
        </div>
        <div className="hero-art">
          <div className="orbit one" />
          <div className="orbit two" />
          <div className="plate">
            <div className="plate-inner">
              <span className="rice" />
              <span className="food-leaf l1" />
              <span className="food-leaf l2" />
              <span className="food-leaf l3" />
              <span className="tomato t1" />
              <span className="tomato t2" />
              <span className="chicken c1" />
              <span className="chicken c2" />
              <span className="chicken c3" />
              <span className="garnish" />
            </div>
          </div>
          <div className="floating">
            <span className="float-icon">
              <Check size={18} />
            </span>
            <div>
              Thoughtfully planned<small>A little less waste, every day.</small>
            </div>
          </div>
          <span className="art-caption">GOOD FOOD. BETTER PLANNING.</span>
        </div>
      </section>
      <div className="metrics">
        <Metric
          title="Estimasi porsi besok"
          value={String(foods.reduce((a, b) => a + b.forecast, 0))}
          unit="porsi"
          icon={<UtensilsCrossed size={18} />}
          note="Ilustrasi prediksi, bukan hasil model"
        />
        <Metric
          title="Penjualan minggu ini"
          value={period === "Minggu ini" ? "1.428" : "1.310"}
          unit="porsi"
          icon={<ChartNoAxesCombined size={18} />}
          note="Data contoh · 9–15 Nov 2026"
        />
        <Metric
          title="Bahan perlu perhatian"
          value={String(stock.filter((s) => s.qty < s.min).length).padStart(
            2,
            "0",
          )}
          unit="bahan"
          icon={<Package size={18} />}
          note="Di bawah batas stok minimum"
          amber
        />
        <Metric
          title="Waste tercatat"
          value={wastes.reduce((a, b) => a + b.qty, 0).toFixed(1)}
          unit="kg"
          icon={<Leaf size={18} />}
          note="Pencatatan ilustratif minggu ini"
        />
      </div>
      <div className="dashboard-grid">
        <section className="card trend">
          <div className="card-header">
            <div>
              <h3>Permintaan, dalam perspektif</h3>
              <p>Penjualan aktual & estimasi permintaan harian</p>
            </div>
            <button className="text-btn" onClick={() => go("AI Forecasting")}>
              Lihat detail <ArrowUpRight size={15} />
            </button>
          </div>
          <Chart period={period} />
        </section>
        <section className="card attention">
          <div className="card-header">
            <div>
              <h3>Sedikit perhatian, banyak manfaat.</h3>
              <p>Pastikan bahan siap sebelum mulai.</p>
            </div>
            <span className="badge amber">
              {stock.filter((s) => s.qty < s.min).length} perlu dicek
            </span>
          </div>
          {stock
            .filter((s) => s.qty < s.min)
            .map((s, i) => (
              <div className="stock-alert" key={s.name}>
                <span className="ingredient-emoji">
                  {s.name === "Daging ayam" ? "🍗" : "🌶️"}
                </span>
                <div>
                  <b>{s.name}</b>
                  <small>
                    Tersedia {s.qty} {s.unit}{" "}
                    <span>
                      · Min. {s.min} {s.unit}
                    </span>
                  </small>
                </div>
                <span className="stock-dot" />
              </div>
            ))}
          <div className="attention-note">
            <Leaf size={16} />
            <span>Stok yang cukup dimulai dari rencana yang tepat.</span>
          </div>
          <button className="button white full" onClick={() => go("Inventory")}>
            Kelola inventory <ArrowRight size={15} />
          </button>
        </section>
      </div>
      <section className="card menu-preview">
        <div className="card-header">
          <div>
            <h3>Yang akan disiapkan besok</h3>
            <p>Menu andalan, dengan porsi yang lebih terencana.</p>
          </div>
          <button className="text-btn" onClick={() => go("Kitchen Planner")}>
            Buka kitchen planner <ArrowRight size={15} />
          </button>
        </div>
        <div className="food-grid">
          {foods.map((f) => (
            <button
              className="food-mini"
              key={f.id}
              onClick={() => {
                setSelected(f);
                setModal("recipe");
              }}
            >
              <span className={"food-photo food-" + f.id}>{f.emoji}</span>
              <div>
                <b>{f.name}</b>
                <small>{f.category}</small>
                <span>
                  <strong>{f.forecast}</strong> porsi <ArrowUpRight size={14} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
