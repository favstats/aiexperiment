#!/usr/bin/env python3
"""
Generate conditions.json for the Image Gallery
Run this once after generating images to update the JSON
"""

import os
import json
from datetime import datetime
from pathlib import Path

# Configuration
IMAGES_DIR = "generated_images"
OUTPUT_FILE = "conditions.json"

def parse_condition_id(condition_id):
    """Parse condition_id into components: age, gender, policy, ideology"""
    parts = condition_id.split("_")
    if len(parts) < 4:
        return None
    
    age_group = parts[0]
    gender = parts[1]
    ideology = parts[-1]  # Last part is always ideology
    policy_parts = parts[2:-1]  # Everything between gender and ideology
    policy_issue = "_".join(policy_parts)
    
    # Normalize ideology names to standard format
    ideology_map = {
        "leftist": "left",
        "centrist": "neutral",
        "rightist": "right"
    }
    ideology = ideology_map.get(ideology, ideology)
    
    return {
        "age_group": age_group,
        "gender": gender,
        "policy_issue": policy_issue,
        "ideology": ideology
    }

def main():
    conditions = []
    
    # Scan directories
    images_path = Path(IMAGES_DIR)
    if not images_path.exists():
        print(f"Error: {IMAGES_DIR} directory not found")
        return
    
    for condition_dir in sorted(images_path.iterdir()):
        if not condition_dir.is_dir():
            continue
        
        condition_id = condition_dir.name
        parsed = parse_condition_id(condition_id)
        
        if not parsed:
            print(f"  Skipping {condition_id} - couldn't parse")
            continue
        
        # Get images
        images = sorted([
            f.name for f in condition_dir.iterdir()
            if f.suffix.lower() in ['.jpg', '.jpeg', '.png']
        ])
        
        if not images:
            print(f"  Skipping {condition_id} - no images")
            continue
        
        # Get prompt
        prompt_file = condition_dir / "prompt.txt"
        prompt = ""
        if prompt_file.exists():
            prompt = prompt_file.read_text(encoding='utf-8').strip()
        
        conditions.append({
            "condition_id": condition_id,
            "age_group": parsed["age_group"],
            "gender": parsed["gender"],
            "policy_issue": parsed["policy_issue"],
            "ideology": parsed["ideology"],
            "images": images,
            "prompt": prompt,
            "image_dir": condition_id
        })
    
    # Extract unique filter values
    age_groups = sorted(set(c["age_group"] for c in conditions))
    genders = sorted(set(c["gender"] for c in conditions))
    policy_issues = sorted(set(c["policy_issue"] for c in conditions))
    ideologies = ["left", "neutral", "right"]  # Fixed order
    
    # Build output
    output = {
        "meta": {
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_conditions": len(conditions),
            "images_dir": IMAGES_DIR
        },
        "filters": {
            "age_groups": age_groups,
            "genders": genders,
            "policy_issues": policy_issues,
            "ideologies": ideologies
        },
        "conditions": conditions
    }
    
    # Write JSON
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Generated {OUTPUT_FILE}")
    print(f"  - Total conditions: {len(conditions)}")
    print(f"  - Age groups: {', '.join(age_groups)}")
    print(f"  - Genders: {', '.join(genders)}")
    print(f"  - Policy issues: {len(policy_issues)}")
    print(f"  - Ideologies: {', '.join(ideologies)}")

if __name__ == "__main__":
    main()















