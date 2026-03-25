import type { SimDeckItem } from "../components/ItemDeck";
import { evaluateConditions } from "./conditionHandler";
import { getOppositePlayerSide, type PlayerSide } from "./playerState";

export interface SubjectContext {
  triggerSourceItem?: SimDeckItem;
  sourcePlayer?: PlayerSide;
}

export interface ResolvedSubjectTargets {
  items: SimDeckItem[];
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
  sourceItem: SimDeckItem,
  subject: any,
  items: SimDeckItem[],
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
      return resolveTargetCardSelfCase(sourceItem, subject, items, context);
    case "TTargetCardTriggerSource":
      return resolveTargetCardTriggerSourceCase(
        sourceItem,
        subject,
        items,
        context
      );
    case "TTargetPlayerRelative":
      return resolveTargetPlayerRelativeCase(subject, sourcePlayer);
    case "TTargetCardSection":
      return resolveTargetCardSectionCase(sourceItem, subject, items, context);

    default:
      console.warn(`Unhandled subject target type: ${subject?.$type}`);
      return EMPTY_SUBJECT_TARGETS;
  }
}

function resolveTargetCardPositionalCase(
  sourceItem: SimDeckItem,
  subject: any,
  items: SimDeckItem[],
  context?: SubjectContext
): ResolvedSubjectTargets {
  return {
    items: resolvePositionalTargets(sourceItem, subject, items, context),
    players: [],
  };
}

function resolveTargetCardSelfCase(
  sourceItem: SimDeckItem,
  subject: any,
  items: SimDeckItem[],
  context?: SubjectContext
): ResolvedSubjectTargets {
  let targets = [sourceItem];

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

  return {
    items: targets,
    players: [],
  };
}

function resolveTargetCardTriggerSourceCase(
  sourceItem: SimDeckItem,
  subject: any,
  items: SimDeckItem[],
  context?: SubjectContext
): ResolvedSubjectTargets {
  let targets: SimDeckItem[] = context?.triggerSourceItem
    ? [context.triggerSourceItem]
    : [];

  if (subject?.ExcludeSelf) {
    targets = targets.filter((item) => item.uid !== sourceItem.uid);
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

  return {
    items: targets,
    players: [],
  };
}

function resolveTargetPlayerRelativeCase(
  subject: any,
  sourcePlayer: PlayerSide
): ResolvedSubjectTargets {
  const targetMode = subject?.TargetMode;

  let players: PlayerSide[];

  if (targetMode === "Self") {
    players = [sourcePlayer];
  } else if (targetMode === "Opponent") {
    players = [getOppositePlayerSide(sourcePlayer)];
  } else {
    console.warn(
      `Unhandled TTargetPlayerRelative target mode: ${subject?.TargetMode}`
    );
    return EMPTY_SUBJECT_TARGETS;
  }

  if (subject?.Conditions != null) {
    players = players.filter((player) =>
      evaluatePlayerConditions(subject.Conditions, player)
    );
  }

  return { items: [], players };
}

function resolveTargetCardSectionCase(
  sourceItem: SimDeckItem,
  subject: any,
  items: SimDeckItem[],
  context?: SubjectContext
): ResolvedSubjectTargets {
  const targetSection = subject?.TargetSection;

  let targets: SimDeckItem[];

  switch (targetSection) {
    case "SelfBoard":
    case "SelfHand":
    case "AbsolutePlayerHand":
      targets = [...items];
      break;

    case "SelfHandAndStash":
    case "AbsolutePlayerHandAndStash":
      // Stash items not modeled in simulation; using board items only
      targets = [...items];
      break;

    case "AllHands":
      // Only self-board items available in current simulation
      targets = [...items];
      break;

    case "OpponentHand":
    case "AbsoluteOpponentHand":
      // Opponent items not modeled in simulation
      targets = [];
      break;

    case "SelfStash":
      // Stash not modeled in simulation
      targets = [];
      break;

    case "AbsolutePlayerSkills":
      // Skills not modeled in simulation
      targets = [];
      break;

    case "SelectionSet":
      // Selection set not modeled in simulation
      targets = [];
      break;

    default:
      console.warn(
        `Unhandled TTargetCardSection target section: ${targetSection}`
      );
      targets = [];
  }

  if (subject?.ExcludeSelf) {
    targets = targets.filter((item) => item.uid !== sourceItem.uid);
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

  return {
    items: uniqueByUid(targets),
    players: [],
  };
}

function resolvePositionalTargets(
  sourceItem: SimDeckItem,
  subject: any,
  items: SimDeckItem[],
  context?: SubjectContext
): SimDeckItem[] {
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

  let targets: SimDeckItem[] = [];

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
  touchingLeft: SimDeckItem | undefined,
  touchingRight: SimDeckItem | undefined
): SimDeckItem[] {
  return [touchingLeft, touchingRight].filter(Boolean) as SimDeckItem[];
}

function resolveLeftCardTargetModeCase(
  leftItems: SimDeckItem[]
): SimDeckItem[] {
  return leftItems.length > 0 ? [leftItems[0]] : [];
}

function resolveRightCardTargetModeCase(
  rightItems: SimDeckItem[]
): SimDeckItem[] {
  return rightItems.length > 0 ? [rightItems[0]] : [];
}

function resolveAllLeftCardsTargetModeCase(
  leftItems: SimDeckItem[]
): SimDeckItem[] {
  return leftItems;
}

function resolveAllRightCardsTargetModeCase(
  rightItems: SimDeckItem[]
): SimDeckItem[] {
  return rightItems;
}

/**
 * Evaluate player-level conditions (e.g. TPlayerConditionalAttribute).
 * Stub – returns true so unimplemented condition types don't silently
 * block targets. Expand as condition types are implemented.
 */
function evaluatePlayerConditions(
  conditions: unknown,
  _player: PlayerSide
): boolean {
  if (conditions == null) {
    return true;
  }

  const condition = conditions as any;
  console.warn(
    `Unhandled player condition type: ${condition?.$type ?? "unknown"}`
  );
  return true;
}

function uniqueByUid(items: SimDeckItem[]): SimDeckItem[] {
  const seen = new Set<string>();
  const result: SimDeckItem[] = [];

  for (const item of items) {
    if (seen.has(item.uid)) {
      continue;
    }

    seen.add(item.uid);
    result.push(item);
  }

  return result;
}
