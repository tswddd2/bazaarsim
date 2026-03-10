import { useState, useRef, useCallback } from "react";
import type { CardItem } from "../types";

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

interface ItemDeckProps {
  items: DeckItem[];
  onApplyLayout: (items: DeckItem[]) => void;
  onRemove: (uid: string) => void;
  onSelect?: (uid: string) => void;
  selectedUid?: string;
  isSimulating?: boolean;
}

const TOTAL_SLOTS = 10;

function getSlotSize(card: CardItem): number {
  const size = card.Size?.toLowerCase();
  if (size === "small") return 1;
  if (size === "large") return 3;
  return 2; // Medium or default
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

/**
 * Shift items to the right iteratively using a queue.
 * Returns the adjusted layout or null if impossible.
 */
function shiftItemsRight(
  items: DeckItem[],
  initialOverlaps: { item: DeckItem; pushedBy: number }[],
  currentLayout: Map<string, DeckItem>
): Map<string, DeckItem> | null {
  const layout = new Map(currentLayout);
  const queue = [...initialOverlaps];

  while (queue.length > 0) {
    const { item, pushedBy } = queue.shift()!;
    
    // Set position to [xB, yB] where xB = yA (pushedBy)
    const newPos = pushedBy;
    if (newPos + item.slotSize > TOTAL_SLOTS) {
      return null; // Cannot shift right, out of bounds
    }

    // Check what's at the new position
    for (const [uid, other] of layout) {
      if (uid === item.uid) continue;
      if (
        other.startSlot < newPos + item.slotSize &&
        other.startSlot + other.slotSize > newPos
      ) {
        queue.push({ item: other, pushedBy: newPos + item.slotSize });
      }
    }

    layout.set(item.uid, { ...item, startSlot: newPos });
  }

  return layout;
}

/**
 * Shift items to the left iteratively using a queue.
 * Returns the adjusted layout or null if impossible.
 */
function shiftItemsLeft(
  items: DeckItem[],
  initialOverlaps: { item: DeckItem; pushedBy: number }[],
  currentLayout: Map<string, DeckItem>
): Map<string, DeckItem> | null {
  const layout = new Map(currentLayout);
  const queue = [...initialOverlaps];

  while (queue.length > 0) {
    const { item, pushedBy } = queue.shift()!;
    
    // Set position to [xB, yB] where yB = xA (pushedBy)
    const newPos = pushedBy - item.slotSize;
    if (newPos < 0) {
      return null; // Cannot shift left, out of bounds
    }

    // Check what's at the new position
    for (const [uid, other] of layout) {
      if (uid === item.uid) continue;
      if (
        other.startSlot < newPos + item.slotSize &&
        other.startSlot + other.slotSize > newPos
      ) {
        queue.push({ item: other, pushedBy: newPos });
      }
    }

    layout.set(item.uid, { ...item, startSlot: newPos });
  }

  return layout;
}

/**
 * Handle drag repositioning with directional shifting logic.
 * Dragging right: shift left items right. Dragging left: shift right items left.
 * If right boundary overlaps partially, extend target to fully cover that item.
 */
function handleDragLayout(
  items: DeckItem[],
  dragUid: string,
  targetStart: number
): DeckItem[] | null {
  console.log("Handling drag layout for", dragUid, "to target slot", targetStart);
  const dragItem = items.find((i) => i.uid === dragUid);
  if (!dragItem) return null;

  const clampedTarget = Math.max(0, Math.min(targetStart, TOTAL_SLOTS - dragItem.slotSize));
  const currentPos = dragItem.startSlot;

  if (clampedTarget === currentPos) {
    // No movement needed
    return items;
  }

  const layout = new Map(items.map((i) => [i.uid, i]));
  const dragEnd = clampedTarget + dragItem.slotSize;

  if (clampedTarget > currentPos) {
    // Dragging RIGHT
    let finalTarget = clampedTarget;

    // Check if right boundary partially overlaps with any item
    // If so, extend target to fully cover that item
    for (const item of items) {
      if (item.uid === dragUid) continue;
      // If right edge of dragged item falls within this item
      if (
        dragEnd > item.startSlot &&
        dragEnd < item.startSlot + item.slotSize
      ) {
        // Extend target to cover the entire item
        finalTarget = item.startSlot + item.slotSize - dragItem.slotSize;
        console.log("Adjusting right drag target to", finalTarget);
        break;
      }
    }

    finalTarget = Math.max(
      clampedTarget,
      Math.min(finalTarget, TOTAL_SLOTS - dragItem.slotSize)
    );
    const finalDragEnd = finalTarget + dragItem.slotSize;

    // Find items to shift left (those that overlap with the new dragged position)
    const toShiftLeft: { item: DeckItem; pushedBy: number }[] = [];
    for (const item of items) {
      if (item.uid === dragUid) continue;
      if (item.startSlot < finalDragEnd && item.startSlot + item.slotSize > finalTarget) {
        toShiftLeft.push({ item, pushedBy: finalTarget });
      }
    }
    console.log("Shifting left items", toShiftLeft.map((i) => i.item.uid), "to accommodate right drag");

    // Place dragged item at final position
    layout.set(dragUid, { ...dragItem, startSlot: finalTarget });

    // Shift left items to the left
    if (toShiftLeft.length > 0) {
      const result = shiftItemsLeft(items, toShiftLeft, layout);
      if (!result) return null;
      return Array.from(result.values());
    }

    return Array.from(layout.values());
  } else {
    // Dragging LEFT
    let finalTarget = clampedTarget;

    // Check if left boundary partially overlaps with any item
    // If so, adjust target to fully cover that item
    for (const item of items) {
      if (item.uid === dragUid) continue;
      // If left edge of dragged item falls within this item
      if (
        clampedTarget > item.startSlot &&
        clampedTarget < item.startSlot + item.slotSize
      ) {
        // Adjust target to start at this item's beginning
        finalTarget = item.startSlot;
        break;
      }
    }

    finalTarget = Math.max(0, Math.min(finalTarget, TOTAL_SLOTS - dragItem.slotSize));
    const finalDragEnd = finalTarget + dragItem.slotSize;

    // Find items to shift right (those that overlap with the new dragged position)
    const toShiftRight: { item: DeckItem; pushedBy: number }[] = [];
    for (const item of items) {
      if (item.uid === dragUid) continue;
      if (item.startSlot < finalDragEnd && item.startSlot + item.slotSize > finalTarget) {
        toShiftRight.push({ item, pushedBy: finalDragEnd });
      }
    }

    // Place dragged item at final position
    layout.set(dragUid, { ...dragItem, startSlot: finalTarget });

    // Shift right items to the right
    if (toShiftRight.length > 0) {
      const result = shiftItemsRight(items, toShiftRight, layout);
      if (!result) return null;
      return Array.from(result.values());
    }

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
      if (item.startSlot < pos + requiredSize && item.startSlot + item.slotSize > pos) {
        isAvailable = false;
        break;
      }
    }
    if (isAvailable) {
      // Found continuous space, add item here
      return [...items, { ...newItem, uid, startSlot: pos }];
    }
  }

  // No continuous space found, place at leftmost (position 0) and shift right
  const layout = new Map(items.map((i) => [i.uid, i]));
  const newItemPos = 0;
  const newItemEnd = newItemPos + requiredSize;

  // Find items that overlap with position 0 to requiredSize
  const toShiftRight: { item: DeckItem; pushedBy: number }[] = [];
  for (const item of items) {
    if (item.startSlot < newItemEnd && item.startSlot + item.slotSize > newItemPos) {
      toShiftRight.push({ item, pushedBy: newItemEnd });
    }
  }

  // Add the new item
  layout.set(uid, { ...newItem, uid, startSlot: newItemPos });

  // Shift overlapping items right
  if (toShiftRight.length > 0) {
    const result = shiftItemsRight(items, toShiftRight, layout);
    if (!result) return null;
    return Array.from(result.values());
  }

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
                  {item.card.Localization?.Title?.Text ??
                    item.card.InternalName}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {dragUid !== null && (
        <div className="deck-hint">Drag outside the deck to remove</div>
      )}
    </div>
  );
}
