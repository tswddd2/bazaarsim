import type { DeckItem } from "../components/ItemDeck";
import { evaluateConditions } from "./conditionHandler";

export interface SubjectContext {
  triggerSourceItem?: DeckItem;
}

/**
 * Resolve trigger subject json to a list of deck item references.
 */
export function resolveSubjectItems(
  sourceItem: DeckItem,
  subject: any,
  items: DeckItem[],
  context?: SubjectContext
): DeckItem[] {
  if (!subject || !items.length) {
    return [];
  }

  switch (subject.$type) {
    case "TTargetCardPositional":
      return resolvePositionalTargets(sourceItem, subject, items, context);
    case "TTargetCardSelf":
      return [sourceItem];
    case "TTargetCardTriggerSource":
      return context?.triggerSourceItem ? [context.triggerSourceItem] : [];
    default:
      console.warn(`Unhandled subject target type: ${subject.$type}`);
      return [];
  }
}

function resolvePositionalTargets(
  sourceItem: DeckItem,
  subject: any,
  items: DeckItem[],
  context?: SubjectContext
): DeckItem[] {
  if (subject?.Origin !== "Self") {
    console.warn(`Unhandled TTargetCardPositional origin: ${subject?.Origin}`);
    return [];
  }

  const sourceStart = sourceItem.startSlot;
  const sourceEnd = sourceItem.startSlot + sourceItem.slotSize - 1;

  const leftItems = items
    .filter(
      (item) =>
        item.uid !== sourceItem.uid &&
        item.startSlot + item.slotSize - 1 < sourceStart
    )
    .sort(
      (a, b) => b.startSlot + b.slotSize - 1 - (a.startSlot + a.slotSize - 1)
    );

  const rightItems = items
    .filter((item) => item.uid !== sourceItem.uid && item.startSlot > sourceEnd)
    .sort((a, b) => a.startSlot - b.startSlot);

  const touchingLeft = leftItems.find(
    (item) => item.startSlot + item.slotSize === sourceStart
  );
  const touchingRight = rightItems.find(
    (item) => item.startSlot === sourceEnd + 1
  );

  let targets: DeckItem[] = [];

  switch (subject?.TargetMode) {
    case "Neighbor":
      targets = [touchingLeft, touchingRight].filter(Boolean) as DeckItem[];
      break;

    case "LeftCard":
      targets = leftItems.length > 0 ? [leftItems[0]] : [];
      break;

    case "RightCard":
      targets = rightItems.length > 0 ? [rightItems[0]] : [];
      break;

    case "AllLeftCards":
      targets = leftItems;
      break;

    case "AllRightCards":
      targets = rightItems;
      break;

    default:
      console.warn(`Unhandled positional target mode: ${subject?.TargetMode}`);
      targets = [];
      break;
  }

  if (subject?.IncludeOrigin) {
    targets = [sourceItem, ...targets];
  }

  if (subject?.Conditions != null) {
    targets = targets.filter((targetItem) =>
      evaluateConditions(subject.Conditions, {
        sourceItem,
        items,
        triggerSourceItem: context?.triggerSourceItem,
        currentItem: targetItem,
      })
    );
  }

  return uniqueByUid(targets);
}

function uniqueByUid(items: DeckItem[]): DeckItem[] {
  const seen = new Set<string>();
  const result: DeckItem[] = [];

  for (const item of items) {
    if (seen.has(item.uid)) {
      continue;
    }

    seen.add(item.uid);
    result.push(item);
  }

  return result;
}
