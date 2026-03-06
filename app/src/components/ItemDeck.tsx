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
 * Compute a new full layout where the dragged item is placed at targetStart
 * and all other items are shifted to make room, minimizing total displacement.
 *
 * Returns null when the items physically cannot all fit.
 */
function computeOptimalLayout(
  items: DeckItem[],
  dragUid: string,
  targetStart: number,
  newItem?: Omit<DeckItem, "uid" | "startSlot">
): DeckItem[] | null {
  const dragItem = newItem
    ? { ...newItem, uid: dragUid, startSlot: -1 }
    : items.find((i) => i.uid === dragUid);
  if (!dragItem) return null;

  const clampedTarget = Math.min(
    Math.max(0, targetStart),
    TOTAL_SLOTS - dragItem.slotSize
  );

  const others = items
    .filter((i) => i.uid !== dragUid)
    .sort((a, b) => a.startSlot - b.startSlot);

  const dragEnd = clampedTarget + dragItem.slotSize;

  // Items that are now overlapping with the dragged item's target position
  const colliding = others.filter(
    (i) => i.startSlot < dragEnd && i.startSlot + i.slotSize > clampedTarget
  );

  // Items that are not overlapping
  const nonColliding = others.filter(
    (i) => !(i.startSlot < dragEnd && i.startSlot + i.slotSize > clampedTarget)
  );

  const occupiedSlots = new Array(TOTAL_SLOTS).fill(false);
  for (const item of nonColliding) {
    for (let i = 0; i < item.slotSize; i++) {
      occupiedSlots[item.startSlot + i] = true;
    }
  }
  // Mark dragged item's slots as occupied for collision detection
  for (let i = 0; i < dragItem.slotSize; i++) {
    occupiedSlots[clampedTarget + i] = true;
  }

  // Recursive function to find a valid placement for a list of items
  function solve(
    itemsToPlace: DeckItem[],
    occupied: boolean[]
  ): DeckItem[] | null {
    if (itemsToPlace.length === 0) return [];

    const [currentItem, ...remainingItems] = itemsToPlace;
    const originalPos = currentItem.startSlot;

    // Try to place to the right
    for (
      let pos = originalPos;
      pos <= TOTAL_SLOTS - currentItem.slotSize;
      pos++
    ) {
      let canPlace = true;
      for (let i = 0; i < currentItem.slotSize; i++) {
        if (occupied[pos + i]) {
          canPlace = false;
          break;
        }
      }
      if (canPlace) {
        const newOccupied = [...occupied];
        for (let i = 0; i < currentItem.slotSize; i++)
          newOccupied[pos + i] = true;
        const solution = solve(remainingItems, newOccupied);
        if (solution !== null) {
          return [{ ...currentItem, startSlot: pos }, ...solution];
        }
      }
    }

    // Try to place to the left
    for (let pos = originalPos - 1; pos >= 0; pos--) {
      let canPlace = true;
      for (let i = 0; i < currentItem.slotSize; i++) {
        if (occupied[pos + i]) {
          canPlace = false;
          break;
        }
      }
      if (canPlace) {
        const newOccupied = [...occupied];
        for (let i = 0; i < currentItem.slotSize; i++)
          newOccupied[pos + i] = true;
        const solution = solve(remainingItems, newOccupied);
        if (solution !== null) {
          return [{ ...currentItem, startSlot: pos }, ...solution];
        }
      }
    }
    return null;
  }

  const collidingSolution = solve(colliding, occupiedSlots);

  if (collidingSolution === null) return null;

  const finalLayout = [
    ...nonColliding,
    ...collidingSolution,
    { ...dragItem, startSlot: clampedTarget },
  ].sort((a, b) => a.startSlot - b.startSlot);

  // Final check for overlaps and total size
  const totalSize = finalLayout.reduce((sum, i) => sum + i.slotSize, 0);
  if (totalSize > TOTAL_SLOTS) return null;

  for (let i = 0; i < finalLayout.length - 1; i++) {
    if (
      finalLayout[i].startSlot + finalLayout[i].slotSize >
      finalLayout[i + 1].startSlot
    ) {
      return null; // Overlap detected
    }
  }

  return finalLayout;
}

/**
 * Finds the best layout by trying the target slot, and if that fails,
 * searching outwards for the nearest slot that works.
 */
function findNearestValidLayout(
  items: DeckItem[],
  dragUid: string,
  targetSlot: number
): DeckItem[] | null {
  let layout = computeOptimalLayout(items, dragUid, targetSlot);
  if (layout) return layout;

  const dragItem = items.find((i) => i.uid === dragUid);
  if (!dragItem) return null;

  // Search outwards from the target slot
  for (let offset = 1; offset < TOTAL_SLOTS; offset++) {
    // Check right
    const rightSlot = targetSlot + offset;
    if (rightSlot <= TOTAL_SLOTS - dragItem.slotSize) {
      layout = computeOptimalLayout(items, dragUid, rightSlot);
      if (layout) return layout;
    }
    // Check left
    const leftSlot = targetSlot - offset;
    if (leftSlot >= 0) {
      layout = computeOptimalLayout(items, dragUid, leftSlot);
      if (layout) return layout;
    }
  }

  return null;
}

export { getSlotSize, buildOccupancy, computeOptimalLayout };

export default function ItemDeck({
  items,
  onApplyLayout,
  onRemove,
  onSelect,
  selectedUid,
}: ItemDeckProps) {
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const dragOutside = useRef(false);

  const usedSlots = items.reduce((sum, item) => sum + item.slotSize, 0);

  // Live layout – drives both the preview rendering and the drop commit
  const previewLayout =
    dragUid !== null && hoverSlot !== null
      ? findNearestValidLayout(items, dragUid, hoverSlot)
      : null;

  const isValidPreview = previewLayout !== null;

  // uid → previewItem for O(1) lookup
  const previewMap = previewLayout
    ? new Map(previewLayout.map((item) => [item.uid, item]))
    : null;

  const handleDragStart = useCallback((e: React.DragEvent, uid: string) => {
    setDragUid(uid);
    dragOutside.current = false;
    e.dataTransfer.effectAllowed = "move";
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
  }, []);

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
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                gridColumn: `${display.startSlot + 1} / span ${item.slotSize}`,
                cursor: onSelect ? "pointer" : "grab",
              }}
              draggable
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
