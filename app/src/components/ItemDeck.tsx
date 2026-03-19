import { useState, useRef, useCallback } from "react";
import type { CardItem } from "../types";

export interface ItemSimSnapshot {
  time: number;
  stats: ItemSimStats;
}

export interface ItemSimStats {
  weaponDamage: number;
  burnApplied: number;
  poisonApplied: number;
  itemUsed: number;
  cooldown: number | null;
}

export interface DeckItem {
  uid: string; // unique instance id
  card: CardItem;
  slotSize: number; // 1, 2, or 3
  startSlot: number; // 0-indexed starting slot position
  tier: string;
  attributes: Record<string, number>;
  abilityIds: string[];
  tooltipIds: number[];
}

export type SimDeckItem = DeckItem & {
  simStats: ItemSimStats;
  snapshots: ItemSimSnapshot[];
};

interface ItemDeckProps {
  items: DeckItem[];
  onApplyLayout: (items: DeckItem[]) => void;
  onRemove: (uid: string) => void;
  onSelect?: (uid: string) => void;
  selectedUid?: string;
  isSimulating?: boolean;
  showFullWarning?: boolean;
}

const TOTAL_SLOTS = 10;

function getSlotSize(card: CardItem): number {
  const size = card.Size?.toLowerCase();
  if (size === "small") return 1;
  if (size === "medium") return 2;
  if (size === "large") return 3;
  return 1;
}

function buildOccupancy(items: DeckItem[], excludeUid?: string): boolean[] {
  const occupied = new Array(TOTAL_SLOTS).fill(false);
  for (const item of items) {
    if (item.uid === excludeUid) continue;
    for (let i = 0; i < item.slotSize; i++) {
      if (item.startSlot + i < TOTAL_SLOTS) {
        occupied[item.startSlot + i] = true;
      }
    }
  }
  return occupied;
}

function collectSpaceAtStart(
  currentLayout: Map<string, DeckItem>,
  requiredSize: number
): Map<string, DeckItem> | null {
  const layout = new Map(currentLayout);
  for (let cursorStart = 0; cursorStart < requiredSize; cursorStart++) {
    const movedIds = new Set<string>();
    let cursor = cursorStart;
    while (true) {
      let findNext = false;
      if (cursor >= TOTAL_SLOTS) {
        console.warn("Cannot shift item, reached end of deck");
        return null;
      }
      for (const [uid, item] of layout) {
        // console.log(
        //   `Checking item ${item.card.Localization?.Title?.Text} at slot ${item.startSlot} against cursor ${cursor}`
        // );
        if (movedIds.has(uid)) continue;
        if (item.startSlot == cursor) {
          // console.log(
          //   `Shifting item ${item.card.Localization?.Title?.Text} from slot ${
          //     item.startSlot
          //   } to ${cursor + 1}`
          // );
          layout.set(uid, { ...item, startSlot: cursor + 1 });
          cursor = cursor + item.slotSize;
          movedIds.add(uid);
          findNext = true;
          break;
        }
      }
      if (!findNext) {
        break;
      }
    }
  }
  return layout;
}

/**
 * Handle drag repositioning with directional shifting logic.
 * Dragging right: shift left items right. Dragging left: shift right items left.
 * If boundary overlaps partially, extend target to fully cover that item.
 */
function handleDragLayout(
  items: DeckItem[],
  dragUid: string,
  targetStart: number
): DeckItem[] | null {
  const dragItem = items.find((i) => i.uid === dragUid);
  if (!dragItem) return null;

  targetStart = Math.max(
    0,
    Math.min(targetStart, TOTAL_SLOTS - dragItem.slotSize)
  );
  const currentPos = dragItem.startSlot;

  if (targetStart === currentPos) {
    return items;
  }

  const layout = new Map(items.map((i) => [i.uid, i]));
  const dragEnd = targetStart + dragItem.slotSize;

  if (targetStart > currentPos) {
    // Dragging RIGHT
    let finalTarget = targetStart;

    // Check if right boundary partially overlaps with any item
    // If so, extend target to fully cover that item
    for (const item of items) {
      if (item.uid === dragUid) continue;
      if (
        dragEnd > item.startSlot &&
        dragEnd < item.startSlot + item.slotSize
      ) {
        finalTarget = item.startSlot + item.slotSize - dragItem.slotSize;
        break;
      }
    }

    const initialDragEnd = currentPos + dragItem.slotSize;
    const finalDragEnd = finalTarget + dragItem.slotSize;
    const shiftSlotSize = dragItem.slotSize;

    // Shift items in the path of the drag
    for (const item of items) {
      if (item.uid === dragUid) continue;
      if (
        item.startSlot >= initialDragEnd &&
        item.startSlot + item.slotSize <= finalDragEnd
      ) {
        layout.set(item.uid, {
          ...item,
          startSlot: item.startSlot - shiftSlotSize,
        });
      }
    }

    // Place dragged item at final position
    layout.set(dragUid, { ...dragItem, startSlot: finalTarget });
    return Array.from(layout.values());
  } else {
    // Dragging LEFT
    let finalTarget = targetStart;

    // Check if left boundary partially overlaps with any item
    // If so, adjust target to fully cover that item
    for (const item of items) {
      if (item.uid === dragUid) continue;
      if (
        targetStart > item.startSlot &&
        targetStart < item.startSlot + item.slotSize
      ) {
        finalTarget = item.startSlot;
        break;
      }
    }

    const initialDragStart = currentPos;
    const finalDragStart = finalTarget;
    const shiftSlotSize = dragItem.slotSize;

    // Shift items in the path of the drag
    for (const item of items) {
      if (item.uid === dragUid) continue;
      if (
        item.startSlot >= finalDragStart &&
        item.startSlot + item.slotSize <= initialDragStart
      ) {
        layout.set(item.uid, {
          ...item,
          startSlot: item.startSlot + shiftSlotSize,
        });
      }
    }

    // Place dragged item at final position
    layout.set(dragUid, { ...dragItem, startSlot: finalTarget });

    return Array.from(layout.values());
  }
}

/**
 * Handle adding a new item to the deck.
 * First tries to find continuous space at the leftmost position.
 * If no space found, places at leftmost and shifts overlapping items right.
 */
function handleAddItemLayout(
  items: DeckItem[],
  newItem: Omit<DeckItem, "uid" | "startSlot">,
  uid: string
): DeckItem[] | null {
  const requiredSize = newItem.slotSize;

  // Find leftmost continuous space of required size
  for (let pos = 0; pos <= TOTAL_SLOTS - requiredSize; pos++) {
    let isAvailable = true;
    for (const item of items) {
      if (
        item.startSlot < pos + requiredSize &&
        item.startSlot + item.slotSize > pos
      ) {
        isAvailable = false;
        break;
      }
    }
    if (isAvailable) {
      return [...items, { ...newItem, uid, startSlot: pos }];
    }
  }

  // No continuous space found, place at leftmost (position 0) and shift right
  let layout = new Map(items.map((i) => [i.uid, i]));
  let result = collectSpaceAtStart(layout, requiredSize);
  if (!result) {
    return null;
  }
  layout = result;
  layout.set(uid, { ...newItem, uid, startSlot: 0 });
  return Array.from(layout.values());
}

export { getSlotSize, buildOccupancy, handleDragLayout, handleAddItemLayout };

export default function ItemDeck({
  items,
  onApplyLayout,
  onRemove,
  onSelect,
  selectedUid,
  isSimulating,
  showFullWarning,
}: ItemDeckProps) {
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const dragOutside = useRef(false);

  const usedSlots = items.reduce((sum, item) => sum + item.slotSize, 0);

  // Live layout – drives both the preview rendering and the drop commit
  const previewLayout =
    dragUid !== null && hoverSlot !== null
      ? handleDragLayout(items, dragUid, hoverSlot)
      : null;

  const isValidPreview = previewLayout !== null;

  // uid → previewItem for O(1) lookup
  const previewMap = previewLayout
    ? new Map(previewLayout.map((item) => [item.uid, item]))
    : null;

  const handleDragStart = useCallback(
    (e: React.DragEvent, uid: string) => {
      if (isSimulating) {
        e.preventDefault();
        return;
      }
      setDragUid(uid);
      dragOutside.current = false;
      e.dataTransfer.effectAllowed = "move";
      const el = e.currentTarget as HTMLElement;
      e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
    },
    [isSimulating]
  );

  const handleDeckDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragOutside.current = false;
      const rect = deckRef.current?.getBoundingClientRect();
      if (rect && dragUid) {
        const x = e.clientX - rect.left;
        const slotWidth = rect.width / TOTAL_SLOTS;
        const rawSlot = Math.floor(x / slotWidth);
        setHoverSlot(Math.max(0, Math.min(TOTAL_SLOTS - 1, rawSlot)));
      }
    },
    [dragUid]
  );

  const handleDeckDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (previewLayout) {
        onApplyLayout(previewLayout);
      }
      setDragUid(null);
      setHoverSlot(null);
      dragOutside.current = false;
    },
    [previewLayout, onApplyLayout]
  );

  const handleDragEnd = useCallback(() => {
    if (dragOutside.current && dragUid !== null) {
      onRemove(dragUid);
    }
    setDragUid(null);
    setHoverSlot(null);
    dragOutside.current = false;
  }, [dragUid, onRemove]);

  const handleDeckDragLeave = useCallback((e: React.DragEvent) => {
    const rect = deckRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        dragOutside.current = true;
        setHoverSlot(null);
      }
    }
  }, []);

  // Determine which slots to highlight (the dragged item's preview position)
  const dragPreview = dragUid ? previewMap?.get(dragUid) : undefined;
  const highlightStart = dragPreview?.startSlot ?? -1;
  const highlightEnd = dragPreview
    ? dragPreview.startSlot + dragPreview.slotSize - 1
    : -1;

  return (
    <div className="item-deck-wrapper">
      <div className="deck-header">
        <span className="deck-title">Item Deck</span>
        <span className="deck-slot-count">
          {usedSlots} / {TOTAL_SLOTS} slots
        </span>
      </div>
      <div
        ref={deckRef}
        className={`item-deck ${dragUid !== null ? "dragging" : ""}`}
        onDragOver={handleDeckDragOver}
        onDrop={handleDeckDrop}
        onDragLeave={handleDeckDragLeave}
      >
        {/* Background slot cells */}
        {Array.from({ length: TOTAL_SLOTS }).map((_, slotIndex) => {
          const isHighlighted =
            slotIndex >= highlightStart && slotIndex <= highlightEnd;
          return (
            <div
              key={`slot-${slotIndex}`}
              className={`deck-slot${
                isHighlighted
                  ? isValidPreview
                    ? " hover-valid"
                    : " hover-invalid"
                  : ""
              }`}
              style={{ gridColumn: slotIndex + 1 }}
            />
          );
        })}

        {/* Items – rendered at preview positions while dragging */}
        {items.map((item) => {
          const display = previewMap?.get(item.uid) ?? item;
          const isShifted =
            previewMap !== null && display.startSlot !== item.startSlot;

          return (
            <div
              key={item.uid}
              onClick={onSelect ? () => onSelect(item.uid) : undefined}
              className={[
                "deck-item",
                `size-${item.slotSize}`,
                `tier-${item.tier.toLowerCase()}`,
                dragUid === item.uid ? "is-dragging" : "",
                isShifted ? "is-shifting" : "",
                selectedUid === item.uid ? "is-selected" : "",
                isSimulating ? "is-simulating" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                gridColumn: `${display.startSlot + 1} / span ${item.slotSize}`,
                cursor: onSelect
                  ? "pointer"
                  : isSimulating
                  ? "default"
                  : "grab",
              }}
              draggable={!isSimulating}
              onDragStart={(e) => handleDragStart(e, item.uid)}
              onDragEnd={handleDragEnd}
            >
              <div className="deck-item-inner">
                <span className="deck-item-name">
                  {item.card.Localization?.Title?.Text}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {dragUid !== null ? (
        <div className="deck-hint">Drag outside the deck to remove</div>
      ) : (
        showFullWarning && (
          <div className="deck-hint deck-full-warning">
            Not enough room in deck!
          </div>
        )
      )}
    </div>
  );
}
