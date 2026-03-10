import { useState, useEffect, useRef } from "react";
import type { CardItem } from "../types";

interface SearchBarProps {
  cards: CardItem[];
  onSelect: (card: CardItem) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchBar({
  cards,
  onSelect,
  placeholder,
  disabled,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);

  useEffect(() => {
    if (query.trim().length === 0) {
      setResults([]);
      setIsOpen(false);
      isSelectingRef.current = false;
      return;
    }
    const lower = query.toLowerCase();
    const filtered = cards
      .filter((c) => c.Localization?.Title?.Text?.toLowerCase().includes(lower))
      .sort((a, b) => {
        const aTitle = a.Localization?.Title?.Text?.toLowerCase() ?? "";
        const bTitle = b.Localization?.Title?.Text?.toLowerCase() ?? "";
        const aStartsWith = aTitle.startsWith(lower);
        const bStartsWith = bTitle.startsWith(lower);

        // Prioritize prefix matches
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        // If both or neither start with query, maintain alphabetical order
        return aTitle.localeCompare(bTitle);
      });
    setResults(filtered.slice(0, 20));
    // Don't auto-open if we just selected a card
    if (!isSelectingRef.current) {
      setIsOpen(filtered.length > 0);
    }
    isSelectingRef.current = false;
    setHighlightIndex(-1);
  }, [query, cards]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      selectCard(results[highlightIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  function selectCard(card: CardItem) {
    onSelect(card);
    isSelectingRef.current = true;
    setQuery("");
    setIsOpen(false);
  }

  return (
    <div
      className={`search-bar ${disabled ? "disabled" : ""}`}
      ref={containerRef}
    >
      <div className="search-input-wrapper">
        <svg
          className="search-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder={placeholder ?? "Search cards by title..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0 && !disabled) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
      </div>
      {isOpen && results.length > 0 && (
        <ul className="search-results">
          {results.map((card, idx) => (
            <li
              key={card.Id}
              className={idx === highlightIndex ? "highlighted" : ""}
              onMouseEnter={() => setHighlightIndex(idx)}
              onClick={() => selectCard(card)}
            >
              <span className="result-title">
                {card.Localization?.Title?.Text ?? card.InternalName}
              </span>
              <span className="result-meta">
                {card.Type}
                {card.StartingTier ? ` · ${card.StartingTier}` : ""}
                {card.Size ? ` · ${card.Size}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
