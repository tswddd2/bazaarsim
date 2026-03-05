import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


def collect_value_types(data: Any):
    """
    扫描整个 JSON，收集所有 key == "Value" 且值为对象时的 Value.$type。
    """
    counts = Counter()
    locations = defaultdict(list)

    def walk(node: Any, path: str = "$"):
        if isinstance(node, dict):
            for k, v in node.items():
                current_path = f"{path}.{k}"

                if k == "Value" and isinstance(v, dict):
                    vtype = v.get("$type", "<MISSING_$type>")
                    counts[vtype] += 1
                    locations[vtype].append(current_path)

                walk(v, current_path)

        elif isinstance(node, list):
            for i, item in enumerate(node):
                walk(item, f"{path}[{i}]")

    walk(data)
    return counts, locations


def main():
    items_path = Path("app/public/items.json")
    if not items_path.exists():
        print(f"File not found: {items_path}")
        return

    with items_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    counts, locations = collect_value_types(data)

    print("=" * 80)
    print("All unique Value.$type in items.json")
    print("=" * 80)

    if not counts:
        print("No Value object found.")
        return

    for vtype in sorted(counts.keys()):
        print(f"- {vtype}: {counts[vtype]}")

    print("\n" + "=" * 80)
    print(f"Total unique Value.$type: {len(counts)}")
    print(f"Total Value objects: {sum(counts.values())}")
    print("=" * 80)

    # 如需查看每种类型出现位置，取消下面注释
    # for vtype in sorted(locations.keys()):
    #     print(f"\n[{vtype}] first 10 locations:")
    #     for p in locations[vtype][:10]:
    #         print(f"  {p}")


if __name__ == "__main__":
    main()
