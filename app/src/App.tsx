import { BrowserRouter, Routes, Route } from "react-router-dom";
import DeckPage from "./pages/DeckPage";
import CardsPage from "./pages/CardsPage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DeckPage />} />
        <Route path="/cards" element={<CardsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
