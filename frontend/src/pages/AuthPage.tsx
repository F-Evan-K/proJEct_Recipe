import { useState } from "react";
import {
  ChefHat,
  ArrowRight,
  Eye,
  EyeOff,
  Leaf,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
export function AuthPage() {
  const { login, register, busy, error, setError, checkSession } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [show, setShow] = useState(false),
    [message, setMessage] = useState("");
  function change(next: "login" | "register") {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setConfirm("");
  }
  return (
    <main className="auth-screen">
      <section className="auth-story">
        <a className="auth-brand">
          <span>
            <ChefHat size={26} />
          </span>
          <div>
            kitchenflow<small>by proJEct_Recipe</small>
          </div>
        </a>
        <div className="auth-story-copy">
          <span className="eyebrow">A THOUGHTFULLY RUN KITCHEN</span>
          <h1>
            Good food starts
            <br />
            with a good flow.
          </h1>
          <p>
            Satu ruang untuk tim, resep andalan, dan dapur yang lebih terencana.
            Masuk, lalu siapkan hari yang lebih baik bersama.
          </p>
          <div className="auth-features">
            <span>
              <Leaf size={18} />
              Lebih terencana, lebih sedikit terbuang.
            </span>
            <span>
              <ShieldCheck size={18} />
              Akses sesuai peran dalam tim.
            </span>
          </div>
        </div>
        <div className="auth-story-footer">
          KitchenFlow <span>·</span> by proJEct_Recipe
        </div>
        <div className="auth-orbit" />
        <div className="auth-orbit second" />
      </section>
      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <span className="eyebrow">WELCOME TO YOUR KITCHEN</span>
          <h2>
            {mode === "login"
              ? "Selamat datang kembali."
              : "Mulai bersama timmu."}
          </h2>
          <p>
            {mode === "login"
              ? "Masuk untuk melanjutkan pekerjaan dapurmu."
              : "Daftar sebagai staf. Pemilik akan meninjau aksesmu sebelum kamu bisa masuk."}
          </p>
          <div className="auth-tabs">
            <button
              disabled={busy}
              className={mode === "login" ? "active" : ""}
              onClick={() => change("login")}
            >
              Masuk
            </button>
            <button
              disabled={busy}
              className={mode === "register" ? "active" : ""}
              onClick={() => change("register")}
            >
              Daftar akun
            </button>
          </div>
          {message && (
            <div className="auth-success" role="status">
              {message}
            </div>
          )}
          {error && (
            <div className="auth-error" role="alert">
              {error}
              <button type="button" onClick={() => void checkSession()}>
                Cek koneksi lagi
              </button>
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMessage("");
              setError("");
              if (mode === "register") {
                if (password !== confirm) {
                  setError("Konfirmasi password belum sama.");
                  return;
                }
                if (await register(name, email, password)) {
                  setMode("login");
                  setPassword("");
                  setConfirm("");
                  setMessage(
                    "Akun berhasil didaftarkan. Tunggu persetujuan pemilik, lalu masuk dengan email dan passwordmu.",
                  );
                }
              } else await login(email, password);
            }}
          >
            <fieldset disabled={busy}>
              {mode === "register" && (
                <label>
                  Nama lengkap
                  <input
                    name="name"
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama yang dikenal timmu"
                  />
                </label>
              )}
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                />
              </label>
              <label>
                Password
                <div className="auth-password">
                  <input
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={mode === "register" ? 12 : 1}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === "register"
                        ? "Minimal 12 karakter"
                        : "Masukkan password"
                    }
                  />
                  <button
                    type="button"
                    aria-label={
                      show ? "Sembunyikan password" : "Tampilkan password"
                    }
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {mode === "register" && (
                <label>
                  Konfirmasi password
                  <input
                    name="confirmPassword"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Ulangi password"
                  />
                </label>
              )}
              <button className="button primary full auth-submit" type="submit">
                {busy
                  ? "Mohon tunggu..."
                  : mode === "login"
                    ? "Masuk ke KitchenFlow"
                    : "Daftar sebagai staf"}
                <ArrowRight size={17} />
              </button>
            </fieldset>
          </form>
          <p className="auth-account-note">
            Akun pemilik/admin dibuat secara internal oleh developer. Role admin
            tidak tersedia melalui pendaftaran umum.
          </p>
        </div>
        <footer>Cook with care. Work in flow.</footer>
      </section>
    </main>
  );
}
