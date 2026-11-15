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
    requirements,
    apiMode,
    pending,
    approvePlan,
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
          {approved
            ? apiMode
              ? "Disetujui · Lokal"
              : "Disetujui · Demo"
            : apiMode
              ? "Draft · Lokal"
              : "Draft · Demo"}
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
                          disabled={pending || approved || f.portions === 0}
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
                          disabled={pending || approved}
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
                          disabled={pending || approved}
                          aria-label={"Tambah " + f.name}
                          onClick={() =>
                            setFoods(
                              foods.map((x) =>
                                x.id === f.id
                                  ? {
                                      ...x,
                                      portions: Math.min(9999, x.portions + 1),
                                    }
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
            <CircleHelp size={15} /> Persetujuan rencana tidak mengurangi atau
            mereservasi stok.
          </div>
        </section>
        <section className="card requirements">
          <h3>Kebutuhan bahan</h3>
          <p>
            {apiMode
              ? "Dihitung dari resep tersimpan; diverifikasi server saat menyimpan."
              : "Dihitung dari resep contoh."}
          </p>
          {requirements.map((s) => (
            <div className="requirement" key={s.name}>
              <b>{s.name}</b>
              <div>
                <span>Kebutuhan</span>
                <strong>
                  {s.need.toFixed(2)} {s.unit}
                </strong>
              </div>
              <div>
                <span>Tersedia</span>
                <span>
                  {s.have.toFixed(2)} {s.unit}
                </span>
              </div>
              <div className={s.need > s.have ? "shortage" : "enough"}>
                {s.need > s.have
                  ? `Kurang ${(s.need - s.have).toFixed(2)} ${s.unit}`
                  : "Stok mencukupi"}
              </div>
            </div>
          ))}
          <small className="muted">
            Resep seed hanya contoh. Lengkapi resep sebelum dipakai operasional.
          </small>
          <button
            className="button primary full"
            disabled={pending}
            onClick={() => void approvePlan()}
          >
            {approved ? (
              "Edit ulang rencana"
            ) : (
              <>
                <Check size={16} />
                {pending
                  ? "Menyimpan..."
                  : apiMode
                    ? "Simpan & setujui rencana"
                    : "Setujui rencana demo"}
              </>
            )}
          </button>
        </section>
      </div>
    </>
  );
}
