import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import ItemDeck, {
  getSlotSize,
  computeOptimalLayout,
} from "../components/ItemDeck";
import type { DeckItem } from "../components/ItemDeck";
import { useCards } from "../hooks/useCards";
import type { CardItem } from "../types";

const TOTAL_SLOTS = 10;
let uidCounter = 0;
const DECK_STORAGE_KEY = "bazaarsim_deck";

/**
 * Calculates the total displacement of items between two layouts.
 */
function calculateDisplacement(
  oldLayout: DeckItem[],
  newLayout: DeckItem[]
): number {
  let totalDistance = 0;
  const oldMap = new Map(oldLayout.map((item) => [item.uid, item]));

  for (const newItem of newLayout) {
    const oldItem = oldMap.get(newItem.uid);
    if (oldItem) {
      totalDistance += Math.abs(newItem.startSlot - oldItem.startSlot);
    }
  }
  return totalDistance;
}

/**
 * Finds the best slot to add a new item to, minimizing displacement of existing items.
 */
function findBestSlotForCard(
  deckItems: DeckItem[],
  newCard: CardItem
): DeckItem[] | null {
  const slotSize = getSlotSize(newCard);
  const tempUid = "temp-new-item";
  let bestLayout: DeckItem[] | null = null;
  let minDisplacement = Infinity;

  // Iterate over all possible start slots
  for (let startSlot = 0; startSlot <= TOTAL_SLOTS - slotSize; startSlot++) {
    const newLayout = computeOptimalLayout(deckItems, tempUid, startSlot, {
      card: newCard,
      slotSize,
    });

    if (newLayout) {
      const displacement = calculateDisplacement(deckItems, newLayout);
      if (displacement < minDisplacement) {
        minDisplacement = displacement;
        bestLayout = newLayout;
      }
    }
  }

  return bestLayout;
}

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
      // Back-fill startSlot for saves that pre-date the slot positioning feature
      let cursor = 0;
      return parsed.map((item) => {
        if (item.startSlot == null) {
          const slot = cursor;
          cursor += item.slotSize;
          return { ...item, startSlot: slot };
        }
        return item;
      });
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

  const handleAddItem = useCallback((card: CardItem) => {
    setDeckItems((prev) => {
      const bestLayout = findBestSlotForCard(prev, card);
      if (bestLayout === null) {
        setShowFullWarning(true);
        setTimeout(() => setShowFullWarning(false), 3000);
        return prev; // No space available
      }
      // Replace the temp UID with a real one
      return bestLayout.map((item) =>
        item.uid === "temp-new-item"
          ? { ...item, uid: `deck-${++uidCounter}` }
          : item
      );
    });
  }, []);

  const handleApplyLayout = useCallback((newItems: DeckItem[]) => {
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
          <Link to="/cards" className="nav-link">
            Card Database
          </Link>
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
                <div className="deck-full-warning">
                  Not enough room in deck!
                </div>
              )}
            </div>

            <ItemDeck
              items={deckItems}
              onApplyLayout={handleApplyLayout}
              onRemove={handleRemove}
            />
          </>
        )}
      </main>
    </div>
  );
}
