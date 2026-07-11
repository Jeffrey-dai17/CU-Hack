import { BrowserRouter, Route, Routes } from "react-router-dom";
import GoalEntryPage from "./pages/GoalEntryPage.jsx";
import RecipeDetailPage from "./pages/RecipeDetailPage.jsx";
import SwipeDeckPage from "./pages/SwipeDeckPage.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GoalEntryPage />} />
        <Route path="/deck" element={<SwipeDeckPage />} />
        <Route path="/recipe/:id" element={<RecipeDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
