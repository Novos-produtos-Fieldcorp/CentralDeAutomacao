import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ChecklistProvider } from "./context/ChecklistContext";
import { ChatProvider } from "./context/ChatContext";
import { WiseAppAccessProvider } from "./context/WiseAppAccessContext";
import Navbar from "./components/Navbar";
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
import Vagas from "./pages/Vagas";
import Comprovantes from "./pages/Comprovantes";

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

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/admin" element={<Admin />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="min-h-screen bg-background relative theme-transition">
              <Navbar />
              <main className="relative ml-20 transition-all duration-300 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
                <div className="max-w-[2000px] mx-auto p-8">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
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
                    <Route path="/vagas/*" element={<Vagas />} />
                    <Route
                      path="/comprovantes/*"
                      element={<Comprovantes />}
                    />
                  </Routes>
                </div>
              </main>
              <Version />
              <Toaster
                position="top-right"
                toastOptions={{
                  className: "z-[60]",
                }}
              />
            </div>
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