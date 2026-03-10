import { useState } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import CardDetail from "../components/CardDetail";
import { useCards } from "../hooks/useCards";
import type { CardItem } from "../types";

export default function CardsPage() {
  const { cards, loading, error } = useCards();
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);

  return (
    <div className="app cards-page">
      <header className="app-header">
        <h1>Card Database</h1>
        <p className="subtitle">Search and inspect card data</p>
        <nav className="header-nav">
          <Link to="/" className="nav-link">
            Deck Builder
          </Link>
        </nav>
      </header>

      <main className="app-main cards-main">
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
