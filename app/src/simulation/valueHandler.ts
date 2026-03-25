import type { SimDeckItem } from "../components/ItemDeck";
import { resolveSubjectTargets } from "./subjectHandler";

export interface ValueContext {
  items?: SimDeckItem[];
  firedItem?: SimDeckItem;
}

/**
 * Resolves a Value/ReferenceValue JSON payload into a numeric value.
 * Currently supports TReferenceValueCardAttribute.
 */
export function resolveValue(
  sourceItem: SimDeckItem,
  value: unknown,
  context?: ValueContext
): number {
  const valuePayload = value as any;

  if (valuePayload?.$type === "TFixedValue") {
    return valuePayload.Value;
  }

  if (valuePayload?.$type === "TReferenceValueCardAttribute") {
    const allItems = context?.items ?? [sourceItem];
    const targets = resolveSubjectTargets(
      sourceItem,
      valuePayload?.Target,
      allItems,
      {
        triggerSourceItem: context?.firedItem,
      }
    ).items;
    const valueSource = targets[0] ?? sourceItem;
    const attr = valuePayload?.AttributeType;
    const defaultValue =
      typeof valuePayload?.DefaultValue === "number"
        ? valuePayload.DefaultValue
        : 0;

    if (!attr) {
      return defaultValue;
    }

    return valueSource.attributes[attr] ?? defaultValue;
  }

  if (typeof valuePayload === "number") {
    return valuePayload;
  }

  return 0;
}
