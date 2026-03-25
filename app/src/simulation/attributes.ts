/**
 * All known Card attribute keys, derived from the Card section of keys.txt.
 * The index signature allows arbitrary extra keys (e.g. "Custom_0").
 */
export interface Attributes {
  Ammo: number;
  AmmoMax: number;
  BurnApplyAmount: number;
  BurnRemoveAmount: number;
  BuyPrice: number;
  ChargeAmount: number;
  ChargeTargets: number;
  Chilled: number;
  Cooldown: number;
  CooldownDisabled: number;
  CooldownMax: number;
  CritChance: number;
  DamageAmount: number;
  DamageCrit: number;
  DestroyTargets: number;
  DisableTargets: number;
  EnchantRemoveTargets: number;
  EnchantTargets: number;
  FlatCooldownReduction: number;
  Flying: number;
  FlyingTargets: number;
  ForceUseTargets: number;
  Freeze: number;
  FreezeAmount: number;
  FreezeTargets: number;
  Haste: number;
  HasteAmount: number;
  HasteTargets: number;
  HealAmount: number;
  Heated: number;
  Lifesteal: number;
  Multicast: number;
  PercentCooldownReduction: number;
  PercentFreezeReduction: number;
  PercentSlowReduction: number;
  PoisonApplyAmount: number;
  PoisonRemoveAmount: number;
  RageApplyAmount: number;
  RegenApplyAmount: number;
  ReloadAmount: number;
  ReloadTargets: number;
  SellPrice: number;
  ShieldApplyAmount: number;
  Slow: number;
  SlowAmount: number;
  SlowTargets: number;
  TransformTargets: number;
  UpgradeTargets: number;
  /** Allows arbitrary extra keys such as "Custom_0" */
  [key: string]: number | undefined;
  /** Self created attributes */
  HasteBenefit: number;
}

/**
 * Returns a fresh Attributes object with every known key set to 0,
 * except Multicast which defaults to 1.
 */
export function initAttributes(): Attributes {
  return {
    Ammo: 0,
    AmmoMax: 0,
    BurnApplyAmount: 0,
    BurnRemoveAmount: 0,
    BuyPrice: 0,
    ChargeAmount: 0,
    ChargeTargets: 0,
    Chilled: 0,
    Cooldown: 0,
    CooldownDisabled: 0,
    CooldownMax: 0,
    CritChance: 0,
    DamageAmount: 0,
    DamageCrit: 0,
    DestroyTargets: 0,
    DisableTargets: 0,
    EnchantRemoveTargets: 0,
    EnchantTargets: 0,
    FlatCooldownReduction: 0,
    Flying: 0,
    FlyingTargets: 0,
    ForceUseTargets: 0,
    Freeze: 0,
    FreezeAmount: 0,
    FreezeTargets: 0,
    Haste: 0,
    HasteAmount: 0,
    HasteTargets: 0,
    HealAmount: 0,
    Heated: 0,
    Lifesteal: 0,
    Multicast: 1,
    PercentCooldownReduction: 0,
    PercentFreezeReduction: 0,
    PercentSlowReduction: 0,
    PoisonApplyAmount: 0,
    PoisonRemoveAmount: 0,
    RageApplyAmount: 0,
    RegenApplyAmount: 0,
    ReloadAmount: 0,
    ReloadTargets: 0,
    SellPrice: 0,
    ShieldApplyAmount: 0,
    Slow: 0,
    SlowAmount: 0,
    SlowTargets: 0,
    TransformTargets: 0,
    UpgradeTargets: 0,
    HasteBenefit: 0,
  };
}
