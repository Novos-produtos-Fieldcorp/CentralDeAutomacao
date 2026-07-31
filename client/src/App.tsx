import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { CustomToaster } from "./components/CustomToaster";
import { Toaster } from "react-hot-toast";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ChecklistProvider } from "./context/ChecklistContext";
import { ChatProvider } from "./context/ChatContext";
import { WiseAppAccessProvider } from "./context/WiseAppAccessContext";
import SidebarLayout from "./components/SidebarLayout";
import Version from "./components/Version";
import Unauthorized from "./pages/Unauthorized";
import Admin from "./pages/Admin";

// Lazy loading para páginas não críticas
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Motoristas = lazy(() => import("./pages/Motoristas"));
const Veiculos = lazy(() => import("./pages/Veiculos"));
const Hodometros = lazy(() => import("./pages/Hodometros"));
const Checklist = lazy(() => import("./pages/Checklist"));
const Clientes = lazy(() => import("./pages/Clientes"));
const ResumosGrupo = lazy(() => import("./pages/ResumosGrupo"));
const TagsAdmin = lazy(() => import("./pages/TagsAdmin"));
const Comprovantes = lazy(() => import("./pages/Comprovantes"));
const Vagas = lazy(() => import("./pages/Vagas"));
const ComprovRota = lazy(() => import("./pages/ComprovRota"));
const Operacoes = lazy(() => import("./pages/Operacoes"));
const Logs = lazy(() => import("./pages/Logs"));
const JpdTransportes = lazy(() => import("./pages/JpdTransportes"));
const FormularioAbastecimentoPublico = lazy(
  () => import("./pages/jpd-transportes/FormularioAbastecimentoPublico"),
);
const BlixxGrupos = lazy(() => import("./pages/BlixxGrupos"));
const PainelControleBlixx = lazy(() => import("./pages/PainelControleBlixx"));

// Componente de loading para lazy loading
const PageLoader = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

const AppRoutes = () => {
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return <Navigate to="/unauthorized" />;
    }

    return <>{children}</>;
  };
  return (
    <Routes>
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/admin" element={<Admin />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <SidebarLayout>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route
                    path="/comprov-rota/*"
                    element={<ComprovRota />}
                  />
                  <Route
                    path="/motoristas/*"
                    element={<Motoristas />}
                  />
                  <Route
                    path="/veiculos/*"
                    element={<Veiculos />}
                  />
                  <Route
                    path="/hodometros/*"
                    element={<Hodometros />}
                  />
                  <Route
                    path="/checklist/*"
                    element={<Checklist />}
                  />
                  <Route
                    path="/clientes"
                    element={<Clientes />}
                  />
                  <Route
                    path="/resumos-grupo"
                    element={<ResumosGrupo />}
                  />
                  <Route
                    path="/tags-admin"
                    element={<TagsAdmin />}
                  />
                  <Route
                    path="/comprovantes/*"
                    element={<Comprovantes />}
                  />
                  <Route
                    path="/vagas/*"
                    element={<Vagas />}
                  />
                  <Route
                    path="/operacoes/*"
                    element={<Operacoes />}
                  />
                  <Route
                    path="/logs"
                    element={<Logs />}
                  />
                  <Route
                    path="/jpd-transportes/*"
                    element={<JpdTransportes />}
                  />
                  <Route
                    path="/blixx-grupos/*"
                    element={<BlixxGrupos />}
                  />
                  <Route
                    path="/painel-controle-blixx/*"
                    element={<PainelControleBlixx />}
                  />
                </Routes>
              </Suspense>
              <Version />
              <CustomToaster />
              <Toaster containerStyle={{ display: "none" }} toastOptions={{ duration: 12000 }} />
            </SidebarLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ChecklistProvider>
          <Router>
            <Routes>
              {/* Rota pública: sem AuthProvider/WiseAppAccessProvider, não deve
                  exigir login nem e-mail do WiseApp — qualquer um com o link acessa. */}
              <Route
                path="/formulario-abastecimento/:id"
                element={
                  <Suspense fallback={<PageLoader />}>
                    <FormularioAbastecimentoPublico />
                  </Suspense>
                }
              />
              <Route
                path="/*"
                element={
                  <AuthProvider>
                    <WiseAppAccessProvider>
                      <ChatProvider>
                        <AppRoutes />
                      </ChatProvider>
                    </WiseAppAccessProvider>
                  </AuthProvider>
                }
              />
            </Routes>
          </Router>
        </ChecklistProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;