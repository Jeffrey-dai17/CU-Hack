import { MotionConfig } from "framer-motion";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import RouteEffects from "./components/RouteEffects.jsx";
import GoalEntryPage from "./pages/GoalEntryPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import RecipeDetailPage from "./pages/RecipeDetailPage.jsx";
import SwipeDeckPage from "./pages/SwipeDeckPage.jsx";

function AppRoutes() {
  return (
    <>
      <RouteEffects />
      <Routes>
        <Route path="/" element={<GoalEntryPage />} />
        <Route path="/deck" element={<SwipeDeckPage />} />
        <Route path="/recipe/:id" element={<RecipeDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </MotionConfig>
  );
}

export { AppRoutes };
export default App;
