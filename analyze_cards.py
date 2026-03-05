import json
from collections import defaultdict
from pathlib import Path

# Load the JSON file
json_file = Path('app/public/cards.json')

with open(json_file, 'r') as f:
    data = json.load(f)

# Get the cards array from the "5.0.0" key
cards = data.get("5.0.0", [])

# Filter for only TCardItem type
card_items = [card for card in cards if card.get("$type") == "TCardItem"]

# Initialize dictionaries to store unique types
unique_items = {
    'Abilities_Action': set(),
    'Abilities_Trigger': set(),
    'Abilities_Prerequisites': set(),
    'Aura_Action': set(),
    'Aura_Prerequisites': set()
}

# Counters for types
action_types = defaultdict(int)
trigger_types = defaultdict(int)
prereq_types = defaultdict(int)
aura_action_types = defaultdict(int)
aura_prereq_types = defaultdict(int)

# Iterate through filtered card items
for card in card_items:
    # Check if card has Abilities
    if 'Abilities' in card and isinstance(card['Abilities'], dict):
        for ability_key, ability in card['Abilities'].items():
            # Get Action type
            if 'Action' in ability and ability['Action']:
                action_type = ability['Action'].get('$type', 'Unknown')
                unique_items['Abilities_Action'].add(action_type)
                action_types[action_type] += 1
            
            # Get Trigger type
            if 'Trigger' in ability and ability['Trigger']:
                trigger_type = ability['Trigger'].get('$type', 'Unknown')
                unique_items['Abilities_Trigger'].add(trigger_type)
                trigger_types[trigger_type] += 1
            
            # Get Prerequisites
            if 'Prerequisites' in ability and ability['Prerequisites']:
                # Prerequisites can be a list or a single object
                prereqs = ability['Prerequisites'] if isinstance(ability['Prerequisites'], list) else [ability['Prerequisites']]
                for prereq in prereqs:
                    if prereq:
                        prereq_type = prereq.get('$type', 'Unknown')
                        unique_items['Abilities_Prerequisites'].add(prereq_type)
                        prereq_types[prereq_type] += 1
    
    # Check if card has Auras
    if 'Auras' in card and isinstance(card['Auras'], dict):
        for aura_key, aura in card['Auras'].items():
            # Get Action type
            if 'Action' in aura and aura['Action']:
                aura_action_type = aura['Action'].get('$type', 'Unknown')
                unique_items['Aura_Action'].add(aura_action_type)
                aura_action_types[aura_action_type] += 1
            
            # Get Prerequisites
            if 'Prerequisites' in aura and aura['Prerequisites']:
                # Prerequisites can be a list or a single object
                prereqs = aura['Prerequisites'] if isinstance(aura['Prerequisites'], list) else [aura['Prerequisites']]
                for prereq in prereqs:
                    if prereq:
                        aura_prereq_type = prereq.get('$type', 'Unknown')
                        unique_items['Aura_Prerequisites'].add(aura_prereq_type)
                        aura_prereq_types[aura_prereq_type] += 1

# Print results
print("=" * 80)
print("ANALYSIS OF UNIQUE TYPES IN CARDS.JSON")
print("=" * 80)

print("\n1. ABILITIES - ACTION TYPES")
print("-" * 80)
print(f"Total unique types: {len(unique_items['Abilities_Action'])}")
for action_type in sorted(unique_items['Abilities_Action']):
    print(f"  • {action_type} (count: {action_types[action_type]})")

print("\n2. ABILITIES - TRIGGER TYPES")
print("-" * 80)
print(f"Total unique types: {len(unique_items['Abilities_Trigger'])}")
for trigger_type in sorted(unique_items['Abilities_Trigger']):
    print(f"  • {trigger_type} (count: {trigger_types[trigger_type]})")

print("\n3. ABILITIES - PREREQUISITES TYPES")
print("-" * 80)
if unique_items['Abilities_Prerequisites']:
    print(f"Total unique types: {len(unique_items['Abilities_Prerequisites'])}")
    for prereq_type in sorted(unique_items['Abilities_Prerequisites']):
        print(f"  • {prereq_type} (count: {prereq_types[prereq_type]})")
else:
    print("No Prerequisites found in Abilities")

print("\n4. AURAS - ACTION TYPES")
print("-" * 80)
print(f"Total unique types: {len(unique_items['Aura_Action'])}")
for aura_action_type in sorted(unique_items['Aura_Action']):
    print(f"  • {aura_action_type} (count: {aura_action_types[aura_action_type]})")

print("\n5. AURAS - PREREQUISITES TYPES")
print("-" * 80)
if unique_items['Aura_Prerequisites']:
    print(f"Total unique types: {len(unique_items['Aura_Prerequisites'])}")
    for aura_prereq_type in sorted(unique_items['Aura_Prerequisites']):
        print(f"  • {aura_prereq_type} (count: {aura_prereq_types[aura_prereq_type]})")
else:
    print("No Prerequisites found in Auras")

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
total_unique = (len(unique_items['Abilities_Action']) + 
                len(unique_items['Abilities_Trigger']) + 
                len(unique_items['Abilities_Prerequisites']) + 
                len(unique_items['Aura_Action']) + 
                len(unique_items['Aura_Prerequisites']))
print(f"Total unique types across all categories: {total_unique}")
print(f"Total TCardItem entries analyzed: {len(card_items)}")
print("=" * 80)

# Save filtered TCardItem data to items.json, omitting Enchantments
items_for_export = []
for card in card_items:
    card_copy = card.copy()
    # Remove Enchantments field if it exists
    if 'Enchantments' in card_copy:
        del card_copy['Enchantments']
    items_for_export.append(card_copy)

items_output = {"5.0.0": items_for_export}
items_file = Path('app/public/items.json')

with open(items_file, 'w') as f:
    json.dump(items_output, f, indent=2)

print(f"\n✓ Filtered TCardItem data (without Enchantments) saved to {items_file}")

