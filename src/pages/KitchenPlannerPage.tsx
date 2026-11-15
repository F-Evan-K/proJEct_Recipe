import { Plus, Check, Menu, CircleHelp, Minus } from "lucide-react";
import { useWorkspace } from "../state/WorkspaceContext";
export function KitchenPlannerPage() {
  const {
    foods,
    setFoods,
    approved,
    setApproved,
    total,
    chicken,
    rice,
    stock,
    notify,
  } = useWorkspace();
  return (
    <>
      <div className="plan-banner">
        <div>
          <span className="eyebrow">TOMORROW'S KITCHEN PLAN</span>
          <h2>Senin, 16 November 2026</h2>
          <p>Atur porsi, cek kebutuhan, lalu setujui rencana.</p>
        </div>
        <span className={"badge " + (approved ? "green" : "amber")}>
          {approved ? "Disetujui · Demo" : "Draft · Demo"}
        </span>
      </div>
      <div className="planner-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <h3>Rencana produksi</h3>
              <p>Sesuaikan porsi dengan kebutuhan dapurmu.</p>
            </div>
            <span className="badge">{total} porsi</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Menu</th>
                  <th>Forecast demo</th>
                  <th>Porsi rencana</th>
                </tr>
              </thead>
              <tbody>
                {foods.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div className="menu-cell">
                        <span>{f.emoji}</span>
                        <b>{f.name}</b>
                      </div>
                    </td>
                    <td>{f.forecast} porsi</td>
                    <td>
                      <div className="stepper">
                        <button
                          disabled={approved || f.portions === 0}
                          aria-label={"Kurangi " + f.name}
                          onClick={() =>
                            setFoods(
                              foods.map((x) =>
                                x.id === f.id
                                  ? {
                                      ...x,
                                      portions: Math.max(0, x.portions - 1),
                                    }
                                  : x,
                              ),
                            )
                          }
                        >
                          <Minus size={13} />
                        </button>
                        <input
                          aria-label={"Porsi " + f.name}
                          type="number"
                          min="0"
                          max="9999"
                          disabled={approved}
                          value={f.portions}
                          onChange={(e) =>
                            setFoods(
                              foods.map((x) =>
                                x.id === f.id
                                  ? {
                                      ...x,
                                      portions: Math.max(
                                        0,
                                        Math.min(
                                          9999,
                                          Number(e.target.value) || 0,
                                        ),
                                      ),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                        <button
                          disabled={approved}
                          aria-label={"Tambah " + f.name}
                          onClick={() =>
                            setFoods(
                              foods.map((x) =>
                                x.id === f.id
                                  ? { ...x, portions: x.portions + 1 }
                                  : x,
                              ),
                            )
                          }
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <CircleHelp size={15} /> Persetujuan demo tidak mengurangi stok.
          </div>
        </section>
        <section className="card requirements">
          <h3>Kebutuhan bahan</h3>
          <p>Dihitung dari resep contoh.</p>
          {[
            { name: "Daging ayam", need: chicken, have: stock[0].qty },
            { name: "Beras premium", need: rice, have: stock[1].qty },
          ].map((s) => (
            <div className="requirement" key={s.name}>
              <b>{s.name}</b>
              <div>
                <span>Kebutuhan</span>
                <strong>{s.need.toFixed(2)} kg</strong>
              </div>
              <div>
                <span>Tersedia</span>
                <span>{s.have.toFixed(2)} kg</span>
              </div>
              <div className={s.need > s.have ? "shortage" : "enough"}>
                {s.need > s.have
                  ? `Kurang ${(s.need - s.have).toFixed(2)} kg`
                  : "Stok mencukupi"}
              </div>
            </div>
          ))}
          <small className="muted">
            Preview mencakup ayam & beras. Lengkapi seluruh resep sebelum
            dipakai operasional.
          </small>
          <button
            className="button primary full"
            onClick={() => {
              if (approved) {
                setApproved(false);
              } else {
                setApproved(true);
                notify(
                  "Rencana demo disetujui. Tidak ada stok aktual yang berubah.",
                );
              }
            }}
          >
            {approved ? (
              "Edit ulang rencana"
            ) : (
              <>
                <Check size={16} />
                Setujui rencana demo
              </>
            )}
          </button>
        </section>
      </div>
    </>
  );
}
