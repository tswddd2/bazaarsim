import type { SimDeckItem } from "./ItemDeck";
import type { BattleStats } from "../simulation/cooldownManager";

interface SimulationPanelProps {
  simulationTime: number;
  setSimulationTime: (time: number) => void;
  battleResult: BattleStats;
  selectedSimulationItem?: SimDeckItem;
}

export default function SimulationPanel({
  simulationTime,
  setSimulationTime,
  battleResult,
  selectedSimulationItem,
}: SimulationPanelProps) {
  // Get data at the current simulation time
  const getStatsAtTime = (time: number) => {
    // Find the damage at the closest time point
    const closestDamage = battleResult.damageOverTime.reduce((prev, curr) => {
      return Math.abs(curr.time - time) < Math.abs(prev.time - time)
        ? curr
        : prev;
    });

    const closestBurn = battleResult.burnOverTime.reduce((prev, curr) => {
      return Math.abs(curr.time - time) < Math.abs(prev.time - time)
        ? curr
        : prev;
    });

    const closestPoison = battleResult.poisonOverTime.reduce((prev, curr) => {
      return Math.abs(curr.time - time) < Math.abs(prev.time - time)
        ? curr
        : prev;
    });

    return {
      totalDamage: closestDamage.cumulativeDamage,
      burnDamage: closestDamage.cumulativeBurnDamage,
      poisonDamage: closestDamage.cumulativePoisonDamage,
      weaponDamage:
        closestDamage.cumulativeDamage -
        closestDamage.cumulativeBurnDamage -
        closestDamage.cumulativePoisonDamage,
      fireStack: closestBurn.burn,
      poisonStack: closestPoison.poison,
    };
  };

  const stats = getStatsAtTime(simulationTime);

  const selectedSimStats = (() => {
    if (!selectedSimulationItem) return null;
    return selectedSimulationItem.snapshots.reduce((prev, curr) =>
      Math.abs(curr.time - simulationTime) <
      Math.abs(prev.time - simulationTime)
        ? curr
        : prev
    ).stats;
  })();

  return (
    <div className="simulation-panel">
      <div className="panel-header">
        <h3 className="panel-title">Battle Simulation</h3>
      </div>
      <div className="simulation-controls">
        <label className="simulation-label">
          Time: {(simulationTime / 1000).toFixed(1)}s
        </label>
        <input
          type="range"
          className="simulation-slider"
          min="0"
          max="40000"
          step="500"
          value={simulationTime}
          onChange={(e) => setSimulationTime(parseInt(e.target.value, 10))}
        />
        <div className="simulation-time-markers">
          <span>0s</span>
          <span>5s</span>
          <span>10s</span>
          <span>15s</span>
          <span>20s</span>
        </div>
      </div>
      <div className="panel-body simulation-body">
        <div className="simulation-layout">
          {/* Damage Breakdown */}
          <div className="sim-section">
            <div className="sim-section-title">Damage Breakdown</div>
            <table className="sim-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Dmg</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                <tr className="sim-row sim-row--weapon">
                  <td>
                    <span className="sim-dot sim-dot--weapon" />
                    Weapon
                  </td>
                  <td>{stats.weaponDamage}</td>
                  <td>
                    {stats.totalDamage > 0
                      ? (
                          (stats.weaponDamage / stats.totalDamage) *
                          100
                        ).toFixed(1)
                      : "0.0"}
                    %
                  </td>
                </tr>
                <tr className="sim-row sim-row--burn">
                  <td>
                    <span className="sim-dot sim-dot--burn" />
                    Burn
                  </td>
                  <td>{stats.burnDamage}</td>
                  <td>
                    {stats.totalDamage > 0
                      ? ((stats.burnDamage / stats.totalDamage) * 100).toFixed(
                          1
                        )
                      : "0.0"}
                    %
                  </td>
                </tr>
                <tr className="sim-row sim-row--poison">
                  <td>
                    <span className="sim-dot sim-dot--poison" />
                    Poison
                  </td>
                  <td>{stats.poisonDamage}</td>
                  <td>
                    {stats.totalDamage > 0
                      ? (
                          (stats.poisonDamage / stats.totalDamage) *
                          100
                        ).toFixed(1)
                      : "0.0"}
                    %
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="sim-row sim-row--total">
                  <td>Total</td>
                  <td>{stats.totalDamage}</td>
                  <td>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Active Effects */}
          <div className="sim-section">
            <div className="sim-section-title">Active Effects</div>
            <table className="sim-table">
              <thead>
                <tr>
                  <th>Effect</th>
                  <th>Stacks</th>
                </tr>
              </thead>
              <tbody>
                <tr className="sim-row sim-row--burn">
                  <td>
                    <span className="sim-dot sim-dot--burn" />
                    Burn
                  </td>
                  <td>{stats.fireStack}</td>
                </tr>
                <tr className="sim-row sim-row--poison">
                  <td>
                    <span className="sim-dot sim-dot--poison" />
                    Poison
                  </td>
                  <td>{stats.poisonStack}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Selected Item */}
          <div className="sim-section">
            <div className="panel-field">
              <div className="sim-section-title">Selected Item</div>
              {selectedSimulationItem ? (
                <div className="sim-item-name">
                  {selectedSimulationItem.card.Localization?.Title?.Text ??
                    selectedSimulationItem.card.InternalName}
                </div>
              ) : (
                <span className="panel-empty">Click an item in deck</span>
              )}
            </div>
            {selectedSimulationItem && selectedSimStats && (
              <table className="sim-table">
                <thead>
                  <tr>
                    <th>Stat</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSimulationItem.card.Tags?.includes("Weapon") && (
                    <tr className="sim-row sim-row--weapon">
                      <td>
                        <span className="sim-dot sim-dot--weapon" />
                        Weapon Dmg
                      </td>
                      <td>{selectedSimStats.weaponDamage}</td>
                    </tr>
                  )}
                  {selectedSimulationItem.card.HiddenTags?.includes("Burn") && (
                    <tr className="sim-row sim-row--burn">
                      <td>
                        <span className="sim-dot sim-dot--burn" />
                        Burn Applied
                      </td>
                      <td>{selectedSimStats.burnApplied}</td>
                    </tr>
                  )}
                  {selectedSimulationItem.card.HiddenTags?.includes(
                    "Poison"
                  ) && (
                    <tr className="sim-row sim-row--poison">
                      <td>
                        <span className="sim-dot sim-dot--poison" />
                        Poison Applied
                      </td>
                      <td>{selectedSimStats.poisonApplied}</td>
                    </tr>
                  )}
                  {selectedSimulationItem.attributes?.CooldownMax > 0 && (
                    <>
                      <tr className="sim-row sim-row--cooldown">
                        <td>Cooldown</td>
                        <td>
                          {((selectedSimStats.cooldown ?? 0) / 1000).toFixed(1)}
                          s
                        </td>
                      </tr>
                      <tr className="sim-row">
                        <td>Times Used</td>
                        <td>{selectedSimStats.itemUsed}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
