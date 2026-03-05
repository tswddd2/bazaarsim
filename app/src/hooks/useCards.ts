import { useState, useEffect } from "react";
import type { CardItem } from "../types";

export function useCards() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/cards.json").then((res) => {
        if (!res.ok)
          throw new Error(`Failed to load cards.json: ${res.status}`);
        return res.json();
      }),
      fetch("/blacklist.json").then((res) => {
        if (!res.ok) {
          if (res.status === 404) {
            return [];
          }
          throw new Error(`Failed to load blacklist.json: ${res.status}`);
        }
        return res.json();
      }),
    ])
      .then(([data, blacklist]) => {
        const list = Array.isArray(data) ? data : Object.values(data).flat();
        const blacklistedNames = new Set(blacklist);
        const filteredList = list.filter(
          (card) => !blacklistedNames.has(card.InternalName)
        );
        setCards(filteredList);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { cards, loading, error };
}
