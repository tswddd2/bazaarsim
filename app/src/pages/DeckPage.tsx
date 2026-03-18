import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import ItemDeck, {
  getSlotSize,
  handleAddItemLayout,
} from "../components/ItemDeck";
import SimulationPanel from "../components/SimulationPanel";
import type { DeckItem } from "../components/ItemDeck";
import { useCards } from "../hooks/useCards";
import type { CardItem } from "../types";
import {
  simulateBattle,
  type BattleResult,
} from "../simulation/cooldownManager";

const DECK_STORAGE_KEY = "bazaarsim_deck";

function computeTierData(card: CardItem, targetTier: string) {
  const tiers = Object.keys(card.Tiers || {});
  let attributes: Record<string, number> = {};
  let abilityIds: string[] = [];
  let tooltipIds: number[] = [];

  if (card.Tiers) {
    for (const t of tiers) {
      const tierData = card.Tiers[t] as any;
      if (tierData) {
        if (tierData.Attributes) {
          Object.entries(tierData.Attributes).forEach(([k, v]) => {
            if (v !== null && v !== undefined) {
              (attributes as any)[k] = v;
            }
          });
        }
        if (tierData.AbilityIds) {
          abilityIds = tierData.AbilityIds;
        }
        if (tierData.TooltipIds) {
          tooltipIds = tierData.TooltipIds;
        }
      }
      if (t === targetTier) break;
    }
  }

  return { attributes, abilityIds, tooltipIds };
}

/**
 * Add a new item to the deck using the new directional shifting logic.
 * First checks for continuous space at the leftmost position.
 * If not available, places at leftmost and shifts overlapping items right.
 */
function findBestSlotForCard(
  deckItems: DeckItem[],
  newCard: CardItem
): DeckItem[] | null {
  const slotSize = getSlotSize(newCard);
  const tempUid = crypto.randomUUID();

  // Initialize tier and attributes
  const tiers = Object.keys(newCard.Tiers || {});
  const startingTier =
    newCard.StartingTier || (tiers.length > 0 ? tiers[0] : "Bronze");

  const { attributes, abilityIds, tooltipIds } = computeTierData(
    newCard,
    startingTier
  );

  // Use the new add item layout logic
  return handleAddItemLayout(
    deckItems,
    {
      card: newCard,
      slotSize,
      tier: startingTier,
      attributes,
      abilityIds,
      tooltipIds,
    },
    tempUid
  );
}

const loadDeckFromStorage = (): DeckItem[] => {
  try {
    const stored = localStorage.getItem(DECK_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as DeckItem[];
      // Back-fill startSlot for saves that pre-date the slot positioning feature
      let cursor = 0;
      return parsed.map((item) => {
        let newItem = item;
        if (newItem.startSlot == null) {
          const slot = cursor;
          cursor += newItem.slotSize;
          newItem = { ...newItem, startSlot: slot };
        }
        if (!newItem.tier || !newItem.attributes) {
          const tiers = Object.keys(newItem.card.Tiers || {});
          const startingTier =
            newItem.card.StartingTier ||
            (tiers.length > 0 ? tiers[0] : "Bronze");
          const { attributes, abilityIds, tooltipIds } = computeTierData(
            newItem.card,
            startingTier
          );
          newItem = {
            ...newItem,
            tier: startingTier,
            attributes,
            abilityIds,
            tooltipIds,
          };
        }
        return newItem;
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
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationTime, setSimulationTime] = useState(0);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);

  // Filter to items only (not skills, encounters, etc.)
  const itemCards = cards.filter((c) => c.Type === "Item");

  const handleAddItem = useCallback(
    (card: CardItem) => {
      if (isSimulating) return; // Prevent adding items during simulation
      setDeckItems((prev) => {
        const bestLayout = findBestSlotForCard(prev, card);
        if (bestLayout === null) {
          setShowFullWarning(true);
          setTimeout(() => setShowFullWarning(false), 3000);
          return prev; // No space available
        }
        return bestLayout;
      });
    },
    [isSimulating]
  );

  const handleApplyLayout = useCallback(
    (newItems: DeckItem[]) => {
      if (isSimulating) return; // Prevent dragging/rearranging items during simulation
      setDeckItems(newItems);
    },
    [isSimulating]
  );

  const handleUpdateItemTier = useCallback((uid: string, newTier: string) => {
    setDeckItems((prev) =>
      prev.map((item) => {
        if (item.uid === uid) {
          const { attributes, abilityIds, tooltipIds } = computeTierData(
            item.card,
            newTier
          );
          return { ...item, tier: newTier, attributes, abilityIds, tooltipIds };
        }
        return item;
      })
    );
  }, []);

  const handleUpdateItemAttribute = useCallback(
    (uid: string, attr: string, value: number) => {
      setDeckItems((prev) =>
        prev.map((item) => {
          if (item.uid === uid) {
            return {
              ...item,
              attributes: { ...item.attributes, [attr]: value },
            };
          }
          return item;
        })
      );
    },
    []
  );

  const handleRemove = useCallback(
    (uid: string) => {
      if (isSimulating) return; // Prevent removing items during simulation
      setDeckItems((prev) => prev.filter((item) => item.uid !== uid));
      setSelectedUid((prev) => (prev === uid ? null : prev));
    },
    [isSimulating]
  );

  // Save deck to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(deckItems));
  }, [deckItems]);

  const selectedItem = deckItems.find((item) => item.uid === selectedUid);

  const handleToggleSimulation = useCallback(() => {
    if (isSimulating) {
      setIsSimulating(false);
      return;
    }

    // Run the full battle simulation
    const result = simulateBattle(deckItems, 20); // Simulate 20 seconds
    setBattleResult(result);
    setIsSimulating(true);
    setSimulationTime(0);
    setSelectedUid(null); // Close item detail panel when simulating
  }, [deckItems, isSimulating]);

  const selectedSimulationItem = deckItems.find(
    (item) => item.uid === selectedUid
  );

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
                disabled={isSimulating}
              />
              <button
                className={`simulate-button ${isSimulating ? "active" : ""}`}
                onClick={handleToggleSimulation}
                disabled={deckItems.length === 0}
              >
                {isSimulating ? "Hide Simulation" : "Simulate"}
              </button>
            </div>

            <ItemDeck
              items={deckItems}
              onApplyLayout={handleApplyLayout}
              onRemove={handleRemove}
              onSelect={setSelectedUid}
              selectedUid={selectedUid || undefined}
              isSimulating={isSimulating}
              showFullWarning={showFullWarning}
            />

            {isSimulating && battleResult && (
              <SimulationPanel
                simulationTime={simulationTime}
                setSimulationTime={setSimulationTime}
                battleResult={battleResult}
                selectedSimulationItem={selectedSimulationItem}
              />
            )}

            {selectedItem && !isSimulating && (
              <div className="item-detail-panel">
                <div className="panel-header">
                  <h3 className="panel-title">
                    {selectedItem.card.Localization?.Title?.Text ??
                      selectedItem.card.InternalName}
                  </h3>
                  <button
                    className="panel-close"
                    onClick={() => setSelectedUid(null)}
                    aria-label="Close panel"
                  >
                    ✕
                  </button>
                </div>
                <div className="panel-body">
                  <div className="panel-field">
                    <label className="panel-label">Tier</label>
                    <select
                      className="panel-select"
                      value={selectedItem.tier}
                      onChange={(e) =>
                        handleUpdateItemTier(selectedItem.uid, e.target.value)
                      }
                    >
                      {Object.keys(selectedItem.card.Tiers || {}).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="panel-field">
                    <label className="panel-label">Attributes</label>
                    {Object.keys(selectedItem.attributes).length === 0 ? (
                      <span className="panel-empty">No attributes</span>
                    ) : (
                      <div className="panel-attr-grid">
                        {Object.entries(selectedItem.attributes).map(
                          ([attr, val]) => (
                            <div key={attr} className="panel-attr-row">
                              <span className="panel-attr-name">{attr}</span>
                              <input
                                className="panel-attr-input"
                                type="number"
                                min="0"
                                value={val}
                                onChange={(e) => {
                                  const parsed = parseInt(e.target.value, 10);
                                  if (!isNaN(parsed) && parsed >= 0) {
                                    handleUpdateItemAttribute(
                                      selectedItem.uid,
                                      attr,
                                      parsed
                                    );
                                  } else if (e.target.value === "") {
                                    handleUpdateItemAttribute(
                                      selectedItem.uid,
                                      attr,
                                      0
                                    );
                                  }
                                }}
                              />
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
