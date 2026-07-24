import json
import os

def main():
    target_ids = [
        "15", "18", "21", "22", "23", "24", "25", "28", "29", "30", "31", "32", "33", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "54", "55", "56", "57", "58", "59", "60", "61", "62", "65", "66", "67", "68", "69", "70", "71", "72", "73", "74", "77", "78", "79", "80", "81", "82", "83", "84", "85", "86", "87", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "100", "101", "104", "105", "106", "107", "108", "109", "110", "111", "114", "115", "116", "117", "118", "119", "120", "121", "122", "124", "125", "126", "129", "130", "131", "134", "135", "136", "137", "138", "139", "140", "144", "145", "146", "147", "148", "149", "150", "153", "154", "155", "157", "160", "161", "162", "163", "164"
    ]
    
    file_path = os.path.join(os.path.dirname(__file__), "data", "plots.master.json")
    
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    total_provided = len(target_ids)
    updated_count = 0
    skipped_under_development = []
    
    # Collect all existing plot ids to check for missing
    existing_plot_ids = {item["id"] for item in data if item.get("category") == "plot"}
    
    not_found = [pid for pid in target_ids if pid not in existing_plot_ids]
    
    target_set = set(target_ids)
    
    for item in data:
        if item.get("category") == "plot" and item.get("id") in target_set:
            current_status = item.get("status")
            if current_status == "under-development":
                skipped_under_development.append(item["id"])
            else:
                item["status"] = "available"
                updated_count += 1
                
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        
    print(f"--- Summary ---")
    print(f"Total plot ids in the provided list: {total_provided}")
    print(f"Total actually updated to 'available': {updated_count}")
    print(f"Total skipped because they were under-development: {len(skipped_under_development)}")
    print(f"Skipped IDs: {', '.join(skipped_under_development) if skipped_under_development else 'None'}")
    print(f"Any ids from the provided list not found among existing plot records: {len(not_found)}")
    if not_found:
        print(f"Missing IDs: {', '.join(not_found)}")

if __name__ == "__main__":
    main()
