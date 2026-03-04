import { useState, useEffect } from "react";
import type { CardItem } from "../types";

export function useCards() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/cards.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load cards.json: ${res.status}`);
        return res.json();
      })
      .then((data: Record<string, CardItem[]> | CardItem[]) => {
        const list = Array.isArray(data)
          ? data
          : Object.values(data).flat();
        setCards(list);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { cards, loading, error };
}
