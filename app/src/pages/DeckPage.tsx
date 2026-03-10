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
import {
  simulateBattle,
  type BattleResult,
} from "../simulation/cooldownManager";

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

  // Initialize tier and attributes
  const tiers = Object.keys(newCard.Tiers || {});
  const startingTier =
    newCard.StartingTier || (tiers.length > 0 ? tiers[0] : "Bronze");

  const { attributes, abilityIds, tooltipIds } = computeTierData(
    newCard,
    startingTier
  );

  // Iterate over all possible start slots
  for (let startSlot = 0; startSlot <= TOTAL_SLOTS - slotSize; startSlot++) {
    const newLayout = computeOptimalLayout(deckItems, tempUid, startSlot, {
      card: newCard,
      slotSize,
      tier: startingTier,
      attributes,
      abilityIds,
      tooltipIds,
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
        // Replace the temp UID with a real one
        return bestLayout.map((item) =>
          item.uid === "temp-new-item"
            ? { ...item, uid: `deck-${++uidCounter}` }
            : item
        );
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

  // Get damage at the current simulation time
  const getDamageAtTime = (time: number): number => {
    if (!battleResult) return 0;

    // Find the damage at the closest time point
    const closestPoint = battleResult.damageOverTime.reduce((prev, curr) => {
      return Math.abs(curr.time - time) < Math.abs(prev.time - time)
        ? curr
        : prev;
    });

    return closestPoint.cumulativeDamage;
  };

  const totalDamage = getDamageAtTime(simulationTime);
  const selectedSimulationItem = deckItems.find(
    (item) => item.uid === selectedUid
  );
  const selectedItemStats = battleResult
    ? battleResult.cardEvents
        .filter(
          (event) => event.uid === selectedUid && event.time <= simulationTime
        )
        .reduce(
          (acc, event) => {
            acc.hits += 1;
            acc.damage += event.damage;
            return acc;
          },
          { hits: 0, damage: 0 }
        )
    : { hits: 0, damage: 0 };

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
              onSelect={setSelectedUid}
              selectedUid={selectedUid || undefined}
              isSimulating={isSimulating}
            />

            {isSimulating && (
              <div className="simulation-panel">
                <div className="panel-header">
                  <h3 className="panel-title">Battle Simulation</h3>
                </div>
                <div className="simulation-controls">
                  <label className="simulation-label">
                    Time: {simulationTime.toFixed(1)}s
                  </label>
                  <input
                    type="range"
                    className="simulation-slider"
                    min="0"
                    max="20"
                    step="0.5"
                    value={simulationTime}
                    onChange={(e) =>
                      setSimulationTime(parseFloat(e.target.value))
                    }
                  />
                  <div className="simulation-time-markers">
                    <span>0s</span>
                    <span>5s</span>
                    <span>10s</span>
                    <span>15s</span>
                    <span>20s</span>
                  </div>
                </div>
                <div className="panel-body simulation-body">
                  <div className="simulation-layout">
                    <div className="simulation-stats">
                      <div className="stat-card">
                        <div className="stat-label">Total Damage</div>
                        <div className="stat-value">{totalDamage}</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">DPS</div>
                        <div className="stat-value">
                          {simulationTime > 0
                            ? (totalDamage / simulationTime).toFixed(1)
                            : "0"}
                        </div>
                      </div>
                    </div>
                    <div className="simulation-item-stats">
                      <div className="panel-field">
                        <label className="panel-label">Selected Item</label>
                        {selectedSimulationItem ? (
                          <div className="sim-item-name">
                            {selectedSimulationItem.card.Localization?.Title
                              ?.Text ??
                              selectedSimulationItem.card.InternalName}
                          </div>
                        ) : (
                          <span className="panel-empty">
                            Click an item in deck
                          </span>
                        )}
                      </div>
                      <div className="simulation-stats simulation-stats-compact">
                        <div className="stat-card">
                          <div className="stat-label">Hits</div>
                          <div className="stat-value">
                            {selectedItemStats.hits}
                          </div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-label">Damage</div>
                          <div className="stat-value">
                            {selectedItemStats.damage}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
