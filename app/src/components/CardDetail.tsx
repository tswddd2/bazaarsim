import { useEffect, useMemo, useState } from "react";
import type { CardItem } from "../types";

interface CardDetailProps {
  card: CardItem;
}

export default function CardDetail({ card }: CardDetailProps) {
  const [copied, setCopied] = useState(false);
  const [hideEnchantments, setHideEnchantments] = useState(false);

  useEffect(() => {
    setHideEnchantments(false);
  }, [card]);

  const hasEnchantments = card.Enchantments != null;

  const cardForJson = useMemo(() => {
    if (!hideEnchantments || !hasEnchantments) {
      return card;
    }

    const { Enchantments: _removedEnchantments, ...cardWithoutEnchantments } =
      card;
    return cardWithoutEnchantments;
  }, [card, hasEnchantments, hideEnchantments]);

  const jsonString = JSON.stringify(cardForJson, null, 2);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = jsonString;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const title = card.Localization?.Title?.Text ?? card.InternalName;

  return (
    <div className="card-detail">
      <div className="card-detail-header">
        <h2>{title}</h2>
        <div className="card-badges">
          <span className="badge badge-type">{card.Type}</span>
          {card.StartingTier && (
            <span
              className={`badge badge-tier badge-${card.StartingTier.toLowerCase()}`}
            >
              {card.StartingTier}
            </span>
          )}
          {card.Size && <span className="badge badge-size">{card.Size}</span>}
        </div>
        {card.Heroes && card.Heroes.length > 0 && (
          <div className="card-heroes">
            {card.Heroes.map((hero) => (
              <span key={hero} className="badge badge-hero">
                {hero}
              </span>
            ))}
          </div>
        )}
        {card.Tags && card.Tags.length > 0 && (
          <div className="card-tags">
            {card.Tags.map((tag) => (
              <span key={tag} className="badge badge-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
        {card.Localization?.Tooltips &&
          card.Localization.Tooltips.length > 0 && (
            <div className="card-tooltips">
              <h3>Tooltips</h3>
              {card.Localization.Tooltips.map((tooltip, i) => (
                <div key={i} className="tooltip-item">
                  <span
                    className={`tooltip-type tooltip-${tooltip.TooltipType.toLowerCase()}`}
                  >
                    {tooltip.TooltipType}
                  </span>
                  <span className="tooltip-text">{tooltip.Content.Text}</span>
                </div>
              ))}
            </div>
          )}
      </div>
      <div className="card-json-container">
        <div className="card-json-toolbar">
          <span className="json-label">JSON</span>
          <div className="card-json-actions">
            {hasEnchantments && (
              <label
                className="json-toggle"
                title="Hide Enchantments object from JSON"
              >
                <input
                  type="checkbox"
                  checked={hideEnchantments}
                  onChange={(event) =>
                    setHideEnchantments(event.target.checked)
                  }
                />
                Hide Enchantments
              </label>
            )}
            <button
              className={`copy-btn ${copied ? "copied" : ""}`}
              onClick={handleCopy}
              title="Copy JSON to clipboard"
            >
              {copied ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
        <pre className="card-json">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
}
