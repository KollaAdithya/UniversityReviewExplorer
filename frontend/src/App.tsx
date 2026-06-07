import { HashRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AuthBar } from "./components/AuthBar";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { SearchPage } from "./pages/SearchPage";
import { UniversitySearchPage } from "./pages/UniversitySearchPage";

export default function App() {
  return (
    <AuthProvider>
      {/* HashRouter: required for GCS static hosting (pathname includes /bucket/index.html) */}
      <HashRouter>
        <AuthBar />
        <Routes>
          <Route path="/" element={<UniversitySearchPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/universities/:uniId" element={<SearchPage />} />
          <Route path="/universities/:uniId/courses/:courseId" element={<DashboardPage />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
