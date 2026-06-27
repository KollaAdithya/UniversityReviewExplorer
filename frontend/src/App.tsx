import { HashRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AuthBar } from "./components/AuthBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { BigQueryDashboardPage } from "./pages/BigQueryDashboardPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DataCatalogPage } from "./pages/DataCatalogPage";
import { ImportAdminPage } from "./pages/ImportAdminPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfessorPage } from "./pages/ProfessorPage";
import { SearchPage } from "./pages/SearchPage";
import { TopTopicsPage } from "./pages/TopTopicsPage";
import { UniversitySearchPage } from "./pages/UniversitySearchPage";

export default function App() {
  return (
    <AuthProvider>
      {/* HashRouter: required for GCS static hosting (pathname includes /bucket/index.html) */}
      <HashRouter>
        <AuthBar />
        <UpdateBanner />
        <Routes>
          <Route path="/" element={<UniversitySearchPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/analytics/top-topics" element={<TopTopicsPage />} />
          <Route path="/analytics/bigquery" element={<BigQueryDashboardPage />} />
          <Route path="/data/catalog" element={<DataCatalogPage />} />
          <Route path="/admin/imports" element={<ImportAdminPage />} />
          <Route path="/universities/:uniId" element={<SearchPage />} />
          <Route path="/universities/:uniId/professors/:professorId" element={<ProfessorPage />} />
          <Route path="/universities/:uniId/courses/:courseId" element={<DashboardPage />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
