import { useState, useRef, useCallback } from "react";
import type { CardItem } from "../types";

interface DeckItem {
  uid: string; // unique instance id
  card: CardItem;
  slotSize: number; // 1, 2, or 3
  startSlot: number; // 0-indexed starting slot position
}

interface ItemDeckProps {
  items: DeckItem[];
  onApplyLayout: (items: DeckItem[]) => void;
  onRemove: (uid: string) => void;
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
 * and all other items are shifted left/right to make room.
 *
 * - Items whose midpoint is left of the dragged item's midpoint are packed
 *   flush against its left edge.
 * - Items whose midpoint is right are packed flush against its right edge.
 *
 * Returns null when the items physically cannot all fit in TOTAL_SLOTS.
 */
function computeShiftedLayout(
  items: DeckItem[],
  dragUid: string,
  targetStart: number
): DeckItem[] | null {
  const dragItem = items.find((i) => i.uid === dragUid);
  if (!dragItem) return null;

  const clampedTarget = Math.min(
    Math.max(0, targetStart),
    TOTAL_SLOTS - dragItem.slotSize
  );

  const others = items
    .filter((i) => i.uid !== dragUid)
    .sort((a, b) => a.startSlot - b.startSlot);

  // Split by whether an item's centre sits left or right of the dragged item's centre
  const dragMid = clampedTarget + dragItem.slotSize / 2;

  const leftGroup = others.filter((i) => i.startSlot + i.slotSize / 2 <= dragMid);
  const rightGroup = others.filter((i) => i.startSlot + i.slotSize / 2 > dragMid);

  // Feasibility check
  const leftTotal = leftGroup.reduce((s, i) => s + i.slotSize, 0);
  const rightTotal = rightGroup.reduce((s, i) => s + i.slotSize, 0);

  if (leftTotal > clampedTarget) return null;
  if (rightTotal > TOTAL_SLOTS - clampedTarget - dragItem.slotSize) return null;

  // Pack left group right-aligned against the dragged item's left edge
  let cursor = clampedTarget;
  const newLeft = [...leftGroup].reverse().map((item) => {
    cursor -= item.slotSize;
    return { ...item, startSlot: cursor };
  });
  newLeft.reverse();

  // Pack right group left-aligned against the dragged item's right edge
  cursor = clampedTarget + dragItem.slotSize;
  const newRight = rightGroup.map((item) => {
    const result = { ...item, startSlot: cursor };
    cursor += item.slotSize;
    return result;
  });

  return [...newLeft, { ...dragItem, startSlot: clampedTarget }, ...newRight];
}

export { getSlotSize, buildOccupancy };
export type { DeckItem };

export default function ItemDeck({ items, onApplyLayout, onRemove }: ItemDeckProps) {
  const [dragUid, setDragUid] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const dragOutside = useRef(false);

  const draggingItem = dragUid ? (items.find((i) => i.uid === dragUid) ?? null) : null;
  const usedSlots = items.reduce((sum, item) => sum + item.slotSize, 0);

  const clampedHover =
    hoverSlot !== null && draggingItem !== null
      ? Math.min(hoverSlot, TOTAL_SLOTS - draggingItem.slotSize)
      : hoverSlot;

  // Live shifted layout – drives both the preview rendering and the drop commit
  const previewLayout =
    dragUid !== null && clampedHover !== null
      ? computeShiftedLayout(items, dragUid, clampedHover)
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
        <span className="deck-slot-count">{usedSlots} / {TOTAL_SLOTS} slots</span>
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
              className={[
                "deck-item",
                `size-${item.slotSize}`,
                dragUid === item.uid ? "is-dragging" : "",
                isShifted ? "is-shifting" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                gridColumn: `${display.startSlot + 1} / span ${item.slotSize}`,
              }}
              draggable
              onDragStart={(e) => handleDragStart(e, item.uid)}
              onDragEnd={handleDragEnd}
            >
              <div className="deck-item-inner">
                <span className="deck-item-name">
                  {item.card.Localization?.Title?.Text ?? item.card.InternalName}
                </span>
                <span className="deck-item-size">{item.card.Size}</span>
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
