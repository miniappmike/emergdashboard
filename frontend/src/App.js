import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { OrgProvider } from "@/context/OrgContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Auth from "@/pages/Auth";
import Workspace from "@/pages/Workspace";
import JoinInvite from "@/pages/JoinInvite";

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="h-screen w-screen flex items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AuthRoute() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="bottom-right" richColors />
          <Routes>
            <Route path="/login" element={<AuthRoute />} />
            <Route path="/invite/:token" element={<JoinInvite />} />
            <Route
              path="/"
              element={
                <Protected>
                  <OrgProvider>
                    <Workspace />
                  </OrgProvider>
                </Protected>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
