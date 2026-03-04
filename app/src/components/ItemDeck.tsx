import { useState, useRef, useCallback } from "react";
import type { CardItem } from "../types";

interface DeckItem {
  uid: string; // unique instance id
  card: CardItem;
  slotSize: number; // 1, 2, or 3
}

interface ItemDeckProps {
  items: DeckItem[];
  onReorder: (items: DeckItem[]) => void;
  onRemove: (uid: string) => void;
}

const TOTAL_SLOTS = 10;

function getSlotSize(card: CardItem): number {
  const size = card.Size?.toLowerCase();
  if (size === "small") return 1;
  if (size === "large") return 3;
  return 2; // Medium or default
}

export { getSlotSize };
export type { DeckItem };

export default function ItemDeck({ items, onReorder, onRemove }: ItemDeckProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const dragOutside = useRef(false);

  const usedSlots = items.reduce((sum, item) => sum + item.slotSize, 0);
  const emptySlots = TOTAL_SLOTS - usedSlots;

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    dragOutside.current = false;
    e.dataTransfer.effectAllowed = "move";
    // Set transparent drag image
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    dragOutside.current = false;
    if (dragIndex !== null && dragIndex !== index) {
      setDropTarget(index);
    }
  }, [dragIndex]);

  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDropTarget(null);
      return;
    }

    const newItems = [...items];
    const [moved] = newItems.splice(dragIndex, 1);
    newItems.splice(index, 0, moved);
    onReorder(newItems);
    setDragIndex(null);
    setDropTarget(null);
  }, [dragIndex, items, onReorder]);

  const handleDragEnd = useCallback(() => {
    if (dragOutside.current && dragIndex !== null) {
      onRemove(items[dragIndex].uid);
    }
    setDragIndex(null);
    setDropTarget(null);
    dragOutside.current = false;
  }, [dragIndex, items, onRemove]);

  const handleDeckDragLeave = useCallback((e: React.DragEvent) => {
    // Only set outside if leaving the deck entirely
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
        setDropTarget(null);
      }
    }
  }, []);

  const handleDeckDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragOutside.current = false;
  }, []);

  return (
    <div className="item-deck-wrapper">
      <div className="deck-header">
        <span className="deck-title">Item Deck</span>
        <span className="deck-slot-count">{usedSlots} / {TOTAL_SLOTS} slots</span>
      </div>
      <div
        ref={deckRef}
        className={`item-deck ${dragIndex !== null ? "dragging" : ""}`}
        onDragLeave={handleDeckDragLeave}
        onDragOver={handleDeckDragOver}
      >
        {items.map((item, index) => (
          <div
            key={item.uid}
            className={`deck-item size-${item.slotSize} ${
              dragIndex === index ? "is-dragging" : ""
            } ${dropTarget === index ? "drop-target" : ""}`}
            style={{ "--slot-span": item.slotSize } as React.CSSProperties}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            <div className="deck-item-inner">
              <span className="deck-item-name">
                {item.card.Localization?.Title?.Text ?? item.card.InternalName}
              </span>
              <span className="deck-item-size">{item.card.Size}</span>
            </div>
          </div>
        ))}
        {/* Empty slot indicators */}
        {emptySlots > 0 &&
          Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`empty-${i}`} className="deck-slot-empty" />
          ))}
      </div>
      {dragIndex !== null && (
        <div className="deck-hint">Drag outside the deck to remove</div>
      )}
    </div>
  );
}
