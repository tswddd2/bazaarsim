import type { SimDeckItem } from "../components/ItemDeck";
import { resolveSubjectTargets } from "./subjectHandler";

export interface ConditionContext {
  sourceItem: SimDeckItem;
  items: SimDeckItem[];
  triggerSourceItem?: SimDeckItem;
  currentItem?: SimDeckItem;
}

/**
 * Placeholder condition evaluator.
 * TODO: Implement full condition resolution.
 */
export function evaluateConditions(
  conditions: unknown,
  context: ConditionContext
): boolean {
  if (conditions == null) {
    return true;
  }

  const condition = conditions as any;

  switch (condition?.$type) {
    case "TCardConditionalOr": {
      const nestedConditions = Array.isArray(condition?.Conditions)
        ? condition.Conditions
        : [];
      if (nestedConditions.length === 0) {
        return false;
      }

      return nestedConditions.some((nested: unknown) =>
        evaluateConditions(nested, context)
      );
    }

    case "TCardConditionalTag":
      return evaluateTagCondition(condition, context);

    default:
      console.warn(`Unhandled condition type: ${condition?.$type}`);
      return false;
  }
}

function evaluateTagCondition(
  condition: any,
  context: ConditionContext
): boolean {
  const requiredTags: string[] = Array.isArray(condition?.Tags)
    ? condition.Tags
    : [];
  if (requiredTags.length === 0) {
    return true;
  }

  const operator = condition?.Operator ?? "Any";

  const targetItems: SimDeckItem[] = condition?.Target
    ? resolveSubjectTargets(
        context.sourceItem,
        condition.Target,
        context.items,
        {
          triggerSourceItem: context.triggerSourceItem,
        }
      ).items
    : [context.currentItem ?? context.sourceItem];

  if (targetItems.length === 0) {
    return false;
  }

  return targetItems.some((targetItem) => {
    const itemTags = new Set<string>([
      ...(Array.isArray(targetItem.card.Tags) ? targetItem.card.Tags : []),
      ...(Array.isArray(targetItem.card.HiddenTags)
        ? targetItem.card.HiddenTags
        : []),
    ]);

    if (operator === "All") {
      return requiredTags.every((tag) => itemTags.has(tag));
    }

    return requiredTags.some((tag) => itemTags.has(tag));
  });
}
