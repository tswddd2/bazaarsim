import type { DeckItem } from "../components/ItemDeck";
import { evaluateConditions } from "./conditionHandler";
import { getOppositePlayerSide, type PlayerSide } from "./playerState";

export interface SubjectContext {
  triggerSourceItem?: DeckItem;
  sourcePlayer?: PlayerSide;
}

export interface ResolvedSubjectTargets {
  items: DeckItem[];
  players: PlayerSide[];
}

const EMPTY_SUBJECT_TARGETS: ResolvedSubjectTargets = {
  items: [],
  players: [],
};

/**
 * Resolve trigger subject json to a list of deck item references.
 */
export function resolveSubjectTargets(
  sourceItem: DeckItem,
  subject: any,
  items: DeckItem[],
  context?: SubjectContext
): ResolvedSubjectTargets {
  if (!subject || !items.length) {
    return EMPTY_SUBJECT_TARGETS;
  }

  const sourcePlayer = context?.sourcePlayer ?? "Self";

  switch (subject.$type) {
    case "TTargetCardPositional":
      return resolveTargetCardPositionalCase(
        sourceItem,
        subject,
        items,
        context
      );
    case "TTargetCardSelf":
      return resolveTargetCardSelfCase(sourceItem);
    case "TTargetCardTriggerSource":
      return resolveTargetCardTriggerSourceCase(context);
    case "TTargetPlayerRelative":
      return resolveTargetPlayerRelativeCase(subject, sourcePlayer);

    default:
      console.warn(`Unhandled subject target type: ${subject?.$type}`);
      return EMPTY_SUBJECT_TARGETS;
  }
}

function resolveTargetCardPositionalCase(
  sourceItem: DeckItem,
  subject: any,
  items: DeckItem[],
  context?: SubjectContext
): ResolvedSubjectTargets {
  return {
    items: resolvePositionalTargets(sourceItem, subject, items, context),
    players: [],
  };
}

function resolveTargetCardSelfCase(
  sourceItem: DeckItem
): ResolvedSubjectTargets {
  return {
    items: [sourceItem],
    players: [],
  };
}

function resolveTargetCardTriggerSourceCase(
  context?: SubjectContext
): ResolvedSubjectTargets {
  return {
    items: context?.triggerSourceItem ? [context.triggerSourceItem] : [],
    players: [],
  };
}

function resolveTargetPlayerRelativeCase(
  subject: any,
  sourcePlayer: PlayerSide
): ResolvedSubjectTargets {
  const targetMode = subject?.TargetMode;

  if (targetMode === "Self") {
    return { items: [], players: [sourcePlayer] };
  }

  if (targetMode === "Opponent") {
    return {
      items: [],
      players: [getOppositePlayerSide(sourcePlayer)],
    };
  }

  console.warn(
    `Unhandled TTargetPlayerRelative target mode: ${subject?.TargetMode}`
  );
  return EMPTY_SUBJECT_TARGETS;
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
      targets = resolveNeighborTargetModeCase(touchingLeft, touchingRight);
      break;

    case "LeftCard":
      targets = resolveLeftCardTargetModeCase(leftItems);
      break;

    case "RightCard":
      targets = resolveRightCardTargetModeCase(rightItems);
      break;

    case "AllLeftCards":
      targets = resolveAllLeftCardsTargetModeCase(leftItems);
      break;

    case "AllRightCards":
      targets = resolveAllRightCardsTargetModeCase(rightItems);
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

function resolveNeighborTargetModeCase(
  touchingLeft: DeckItem | undefined,
  touchingRight: DeckItem | undefined
): DeckItem[] {
  return [touchingLeft, touchingRight].filter(Boolean) as DeckItem[];
}

function resolveLeftCardTargetModeCase(leftItems: DeckItem[]): DeckItem[] {
  return leftItems.length > 0 ? [leftItems[0]] : [];
}

function resolveRightCardTargetModeCase(rightItems: DeckItem[]): DeckItem[] {
  return rightItems.length > 0 ? [rightItems[0]] : [];
}

function resolveAllLeftCardsTargetModeCase(leftItems: DeckItem[]): DeckItem[] {
  return leftItems;
}

function resolveAllRightCardsTargetModeCase(
  rightItems: DeckItem[]
): DeckItem[] {
  return rightItems;
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
