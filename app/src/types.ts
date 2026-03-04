// Represents a single card item from cards.json
// Using a loose type since the JSON structure is deeply nested and varied
export interface CardItem {
  $type: string;
  Type: string;
  Id: string;
  InternalName: string;
  StartingTier?: string;
  Size?: string;
  Heroes?: string[];
  Tags?: string[];
  HiddenTags?: string[];
  Localization: {
    Title: {
      Key: string;
      Text: string;
    };
    Description?: {
      Key: string;
      Text: string;
    } | null;
    FlavorText?: string | null;
    Tooltips?: Array<{
      Content: {
        Key: string;
        Text: string;
      };
      TooltipType: string;
      Prerequisites: unknown;
    }>;
  };
  Tiers?: Record<string, unknown>;
  Enchantments?: Record<string, unknown>;
  Abilities?: Record<string, unknown>;
  Auras?: Record<string, unknown>;
  [key: string]: unknown;
}
