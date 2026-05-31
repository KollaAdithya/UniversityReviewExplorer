import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { SearchPage } from "./pages/SearchPage";
import { UniversitySearchPage } from "./pages/UniversitySearchPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UniversitySearchPage />} />
        <Route path="/universities/:uniId" element={<SearchPage />} />
        <Route path="/universities/:uniId/courses/:courseId" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}
