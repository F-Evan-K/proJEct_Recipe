import { useEffect, useState } from "react";
import { useAuth, type Account } from "../auth/AuthContext";
import { apiRequest } from "../services/api";
export function AccountsPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<Account[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState<number | null>(null),
    [confirm, setConfirm] = useState<Account | null>(null);
  async function load() {
    setError("");
    setLoading(true);
    try {
      setUsers(await apiRequest<Account[]>("/auth/users"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat akun.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);
  async function access(user: Account) {
    setBusy(user.id);
    setError("");
    try {
      await apiRequest("/auth/users/" + user.id + "/access", {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active }),
      });
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan akses.");
    } finally {
      setBusy(null);
    }
  }
  if (!isAdmin)
    return <div className="notice">Halaman ini khusus pemilik/admin.</div>;
  return (
    <>
      <div className="notice">
        <div>
          <b>Tim yang tepat, akses yang sesuai.</b>
          <p>
            Setujui staf baru atau nonaktifkan aksesnya. Akun pemilik/admin
            dikelola developer dan tidak dapat diubah di sini.
          </p>
        </div>
      </div>
      {error && (
        <div className="auth-error" role="alert">
          {error}
          <button onClick={() => void load()}>Coba lagi</button>
        </div>
      )}
      <section className="card">
        <div className="card-header">
          <h3>Akun anggota tim</h3>
          <span className="badge">
            {users.filter((u) => !u.active).length} belum aktif
          </span>
        </div>
        {loading ? (
          <div className="empty">Memuat akun...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Peran</th>
                  <th>Status</th>
                  <th>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <b>{u.name}</b>
                    </td>
                    <td>{u.email}</td>
                    <td>{u.role === "ADMIN" ? "Pemilik / Admin" : "Staf"}</td>
                    <td>
                      <span
                        className={"badge " + (u.active ? "green" : "amber")}
                      >
                        {u.active ? "Aktif" : "Belum aktif"}
                      </span>
                    </td>
                    <td>
                      {u.role === "ADMIN" ? (
                        <span className="muted">Dikelola developer</span>
                      ) : (
                        <button
                          className="button white"
                          disabled={busy !== null}
                          onClick={() =>
                            u.active ? setConfirm(u) : void access(u)
                          }
                        >
                          {busy === u.id
                            ? "Menyimpan..."
                            : u.active
                              ? "Nonaktifkan"
                              : "Setujui akses"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Konfirmasi nonaktifkan akun"
          >
            <h2>Nonaktifkan {confirm.name}?</h2>
            <p>
              Seluruh sesi akun ini akan dicabut. Kamu bisa mengaktifkannya lagi
              nanti.
            </p>
            <div className="editor-actions">
              <button
                className="button white"
                disabled={busy !== null}
                onClick={() => setConfirm(null)}
              >
                Batal
              </button>
              <button
                className="button danger"
                disabled={busy !== null}
                onClick={() => void access(confirm)}
              >
                Ya, nonaktifkan
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
