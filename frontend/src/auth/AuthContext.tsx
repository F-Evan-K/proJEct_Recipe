import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, ApiError } from "../services/api";
export type Account = {
  id: number;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  active: boolean;
};
function useAuthState() {
  const [user, setUser] = useState<Account | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function checkSession() {
    setError("");
    setLoading(true);
    try {
      setUser((await apiRequest<{ user: Account }>("/auth/me")).user);
    } catch (e) {
      setUser(null);
      if (!(e instanceof ApiError && e.status === 401))
        setError(
          "Tidak dapat menghubungi server. Pastikan backend sedang berjalan.",
        );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void checkSession();
    const expired = () => {
      setUser(null);
      setError("Sesi berakhir. Silakan masuk kembali.");
    };
    window.addEventListener("kitchenflow:unauthorized", expired);
    return () =>
      window.removeEventListener("kitchenflow:unauthorized", expired);
  }, []);
  async function login(email: string, password: string) {
    setBusy(true);
    setError("");
    try {
      setUser(
        (
          await apiRequest<{ user: Account }>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          })
        ).user,
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal masuk.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function register(name: string, email: string, password: string) {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mendaftar.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await apiRequest("/auth/logout", { method: "POST", body: "{}" });
      setUser(null);
      setError("");
    } catch {
      setError("Belum berhasil keluar dari server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }
  return {
    user,
    loading,
    error,
    setError,
    busy,
    login,
    register,
    logout,
    checkSession,
    isAdmin: user?.role === "ADMIN",
  };
}
const AuthContext = createContext<ReturnType<typeof useAuthState> | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthState();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw Error("Missing AuthProvider");
  return auth;
}
