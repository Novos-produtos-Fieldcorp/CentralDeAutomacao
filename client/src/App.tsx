import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { CustomToaster } from "./components/CustomToaster";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ChecklistProvider } from "./context/ChecklistContext";
import { ChatProvider } from "./context/ChatContext";
import { WiseAppAccessProvider } from "./context/WiseAppAccessContext";
import SidebarLayout from "./components/SidebarLayout";
import Version from "./components/Version";
import Dashboard from "./pages/Dashboard";
import Motoristas from "./pages/Motoristas";
import Veiculos from "./pages/Veiculos";
import Hodometros from "./pages/Hodometros";
import Checklist from "./pages/Checklist";
import Clientes from "./pages/Clientes";
import Unauthorized from "./pages/Unauthorized";
import Admin from "./pages/Admin";
import ResumosGrupo from "./pages/ResumosGrupo";
import TagsAdmin from "./pages/TagsAdmin";
import Comprovantes from "./pages/Comprovantes";
import Vagas from "./pages/Vagas";
import ComprovRota from "./pages/ComprovRota";
import Operacoes from "./pages/Operacoes";
import Logs from "./pages/Logs";

const AppRoutes = () => {
  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-gray-600 dark:text-gray-400">Carregando...</div>
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
              </Routes>
              <Version />
              <CustomToaster />
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
            <AuthProvider>
              <WiseAppAccessProvider>
                <ChatProvider>
                  <AppRoutes />
                </ChatProvider>
              </WiseAppAccessProvider>
            </AuthProvider>
          </Router>
        </ChecklistProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;