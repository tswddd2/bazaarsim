import type { SimDeckItem } from "../components/ItemDeck";
import { resolveValue } from "./valueHandler";

export interface ConditionContext {
  sourceItem: SimDeckItem;
  items: SimDeckItem[];
  triggerSourceItem?: SimDeckItem;
  currentItem: SimDeckItem;
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

    case "TCardConditionalAttribute":
      return evaluateAttributeCondition(condition, context);

    default:
      console.warn(`Unhandled condition type: ${condition?.$type}`);
      return false;
  }
}

function evaluateTagCondition(
  condition: any,
  context: ConditionContext
): boolean {
  const conditionTags: string[] = condition.Tags;
  const operator = condition.Operator;
  const targetItem = context.currentItem;

  const itemTags = new Set<string>([
    ...(Array.isArray(targetItem.card.Tags) ? targetItem.card.Tags : []),
    ...(Array.isArray(targetItem.card.HiddenTags)
      ? targetItem.card.HiddenTags
      : []),
  ]);

  switch (operator) {
    case "None":
      return conditionTags.every((tag) => !itemTags.has(tag));
    case "Any":
      return conditionTags.some((tag) => itemTags.has(tag));
    case "All":
      return conditionTags.every((tag) => itemTags.has(tag));
    default:
      console.warn(`Unhandled tag condition operator: ${operator}`);
      return false;
  }
}

function evaluateAttributeCondition(
  condition: any,
  context: ConditionContext
): boolean {
  const attribute: string = condition?.Attribute;

  const targetItem = context.currentItem;
  const lhs: number = targetItem.attributes[attribute] ?? 0;

  const valueContext = {
    items: context.items,
    firedItem: context.triggerSourceItem,
  };
  const rhs: number = resolveValue(
    targetItem,
    condition.ComparisonValue,
    valueContext
  );

  const op: string = condition?.ComparisonOperator ?? "Equal";
  switch (op) {
    case "Equal":
      return lhs === rhs;
    case "NotEqual":
      return lhs !== rhs;
    case "GreaterThan":
      return lhs > rhs;
    case "GreaterThanOrEqual":
      return lhs >= rhs;
    case "LessThan":
      return lhs < rhs;
    case "LessThanOrEqual":
      return lhs <= rhs;
    default:
      console.warn(`Unhandled ComparisonOperator: ${op}`);
      return false;
  }
}
