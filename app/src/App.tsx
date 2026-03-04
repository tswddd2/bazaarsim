import { useState, useEffect } from "react";
import SearchBar from "./components/SearchBar";
import CardDetail from "./components/CardDetail";
import type { CardItem } from "./types";
import "./App.css";

function App() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/cards.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load cards.json: ${res.status}`);
        return res.json();
      })
      .then((data: Record<string, CardItem[]> | CardItem[]) => {
        // cards.json may be { "5.0.0": [...] } or a plain array
        const list = Array.isArray(data)
          ? data
          : Object.values(data).flat();
        setCards(list);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Bazaar Battle Simulator</h1>
        <p className="subtitle">Search and inspect card data</p>
      </header>

      <main className="app-main">
        {loading && <div className="loading">Loading cards...</div>}
        {error && <div className="error">Error: {error}</div>}

        {!loading && !error && (
          <>
            <SearchBar cards={cards} onSelect={setSelectedCard} />
            <div className="card-count">{cards.length} cards loaded</div>

            {selectedCard ? (
              <CardDetail card={selectedCard} />
            ) : (
              <div className="placeholder">
                <p>Select a card from the search to view its JSON data.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
