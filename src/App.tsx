import { createContext, useContext } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ManualReview from "./pages/ManualReview";
import AuditLog from "./pages/AuditLog";
import ProductDetail from "./pages/ProductDetail";

type AuthCtx = ReturnType<typeof useAuth>;
const AuthContext = createContext<AuthCtx | null>(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useAuthCtx = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuthCtx außerhalb des Providers");
  return c;
};

export default function App() {
  const auth = useAuth();

  if (auth.loading) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Lädt…</div>;
  }

  return (
    <AuthContext.Provider value={auth}>
      {!auth.session ? (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      ) : (
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/manual" element={<ManualReview />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
    </AuthContext.Provider>
  );
}
