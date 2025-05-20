import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChecklistProvider } from './context/ChecklistContext';
import { ChatProvider } from './context/ChatContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Motoristas from './pages/Motoristas';
import Veiculos from './pages/Veiculos';
import Hodometros from './pages/Hodometros';
import Checklist from './pages/Checklist';
import Clientes from './pages/Clientes';
import Unauthorized from './pages/Unauthorized';
import Admin from './pages/Admin'; 

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

function App() {
  return (
    <ThemeProvider>
      <ChecklistProvider>
        <Router>
          <AuthProvider>
            <ChatProvider>
              <Routes>
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/*" element={
                  <ProtectedRoute>
                    <div className="min-h-screen bg-background relative">
                      <Navbar />
                      <main className="relative ml-20 transition-all duration-300 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
                        <div className="max-w-[2000px] mx-auto p-8">
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/motoristas/*" element={<Motoristas />} />
                            <Route path="/veiculos/*" element={<Veiculos />} />
                            <Route path="/hodometros/*" element={<Hodometros />} />
                            <Route path="/checklist/*" element={<Checklist />} />
                            <Route path="/clientes" element={<Clientes />} />
                          </Routes>
                        </div>
                      </main>
                      <Toaster 
                        position="top-right"
                        toastOptions={{
                          className: 'z-[60]'
                        }}
                      />
                    </div>
                  </ProtectedRoute>
                } />
              </Routes>
            </ChatProvider>
          </AuthProvider>
        </Router>
      </ChecklistProvider>
    </ThemeProvider>
  );
}

export default App;