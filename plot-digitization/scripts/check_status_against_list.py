import json
import os

def main():
    expected_unsold = [
        "15", "18", "21", "22", "23", "24", "25", "28", "29", "30", "31", "32", "33", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "54", "55", "56", "57", "58", "59", "60", "61", "62", "65", "66", "67", "68", "69", "70", "71", "72", "73", "74", "77", "78", "79", "80", "81", "82", "83", "84", "85", "86", "87", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "100", "101", "104", "105", "106", "107", "108", "109", "110", "111", "114", "115", "116", "117", "118", "119", "120", "121", "122", "124", "125", "126", "129", "130", "131", "134", "135", "136", "137", "138", "139", "140", "144", "145", "146", "147", "148", "149", "150", "153", "154", "155", "157", "160", "161", "162", "163", "164"
    ]
    
    file_path = os.path.join(os.path.dirname(__file__), "data", "plots.master.json")
    
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    expected_set = set(expected_unsold)
    
    unexpected_available = []
    expected_but_not_applied = []
    total_matches = 0
    
    for item in data:
        if item.get("category") == "plot":
            plot_id = item.get("id")
            current_status = item.get("status")
            
            # Skip under-development plots as per rules (they are excluded from changes and take priority)
            if current_status == "under-development":
                continue
                
            in_expected_list = plot_id in expected_set
            is_available = current_status == "available"
            
            if is_available and not in_expected_list:
                unexpected_available.append(plot_id)
            elif in_expected_list and not is_available:
                expected_but_not_applied.append(plot_id)
            elif in_expected_list and is_available:
                total_matches += 1
                
    print("--- Final Report ---")
    print(f"Total Matches (in list AND available): {total_matches}")
    
    print(f"\nUnexpected Available Plots (NOT in list but currently available): {len(unexpected_available)}")
    if unexpected_available:
        # Sort them numerically for easier reading
        unexpected_available.sort(key=lambda x: int(x))
        print("IDs:", ", ".join(unexpected_available))
        
    print(f"\nExpected But Not Applied Plots (IN list but currently NOT available): {len(expected_but_not_applied)}")
    if expected_but_not_applied:
        expected_but_not_applied.sort(key=lambda x: int(x))
        print("IDs:", ", ".join(expected_but_not_applied))

if __name__ == "__main__":
    main()
