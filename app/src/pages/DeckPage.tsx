import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import ItemDeck, { getSlotSize } from "../components/ItemDeck";
import type { DeckItem } from "../components/ItemDeck";
import { useCards } from "../hooks/useCards";
import type { CardItem } from "../types";

const TOTAL_SLOTS = 10;
let uidCounter = 0;
const DECK_STORAGE_KEY = "bazaarsim_deck";

const loadDeckFromStorage = (): DeckItem[] => {
  try {
    const stored = localStorage.getItem(DECK_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as DeckItem[];
      // Update uidCounter to avoid collisions
      const maxUid = parsed.reduce((max, item) => {
        const num = parseInt(item.uid.split("-")[1], 10);
        return Math.max(max, isNaN(num) ? 0 : num);
      }, 0);
      uidCounter = maxUid;
      return parsed;
    }
  } catch (e) {
    console.error("Failed to load deck from storage:", e);
  }
  return [];
};

export default function DeckPage() {
  const { cards, loading, error } = useCards();
  const [deckItems, setDeckItems] = useState<DeckItem[]>(loadDeckFromStorage);
  const [showFullWarning, setShowFullWarning] = useState(false);

  // Filter to items only (not skills, encounters, etc.)
  const itemCards = cards.filter((c) => c.Type === "Item");

  const usedSlots = deckItems.reduce((sum, item) => sum + item.slotSize, 0);

  const handleAddItem = useCallback((card: CardItem) => {
    const slotSize = getSlotSize(card);
    setDeckItems((prev) => {
      const currentUsedSlots = prev.reduce((sum, item) => sum + item.slotSize, 0);
      if (currentUsedSlots + slotSize > TOTAL_SLOTS) {
        setShowFullWarning(true);
        setTimeout(() => setShowFullWarning(false), 3000);
        return prev; // Not enough room
      }
      const uid = `deck-${++uidCounter}`;
      return [...prev, { uid, card, slotSize }];
    });
  }, []);

  const handleReorder = useCallback((newItems: DeckItem[]) => {
    setDeckItems(newItems);
  }, []);

  const handleRemove = useCallback((uid: string) => {
    setDeckItems((prev) => prev.filter((item) => item.uid !== uid));
  }, []);

  // Save deck to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deckItems));
  }, [deckItems]);

  return (
    <div className="app deck-page">
      <header className="app-header">
        <h1>Bazaar Battle Simulator</h1>
        <p className="subtitle">Build your item deck and simulate battles</p>
        <nav className="header-nav">
          <Link to="/cards" className="nav-link">Card Database</Link>
        </nav>
      </header>

      <main className="app-main deck-main">
        {loading && <div className="loading">Loading cards...</div>}
        {error && <div className="error">Error: {error}</div>}

        {!loading && !error && (
          <>
            <div className="deck-search-section">
              <SearchBar
                cards={itemCards}
                onSelect={handleAddItem}
                placeholder="Search items to add to deck..."
              />
              {showFullWarning && (
                <div className="deck-full-warning">Not enough room in deck!</div>
              )}
            </div>

            <ItemDeck
              items={deckItems}
              onReorder={handleReorder}
              onRemove={handleRemove}
            />
          </>
        )}
      </main>
    </div>
  );
}
