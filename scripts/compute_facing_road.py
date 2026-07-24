import json
import re
import math
import os

def to_title_case(val):
    return re.sub(r'\b([a-z])([a-z]*)\b', lambda m: m.group(1).upper() + m.group(2).lower(), val, flags=re.IGNORECASE)

def format_road_label(id_str):
    cleaned = re.sub(r'^road-', '', id_str, flags=re.IGNORECASE)
    cleaned = re.sub(r'([A-Za-z])(\d+)', r'\1 \2', cleaned)
    cleaned = cleaned.replace('_', ' ').strip()
    cleaned = to_title_case(cleaned)
    
    suffix_match = re.match(r'^(.*\D)\s+(\d+)$', cleaned)
    if suffix_match and re.match(r'^\d', suffix_match.group(1).strip()):
        cleaned = f"{suffix_match.group(1).strip()} Road {suffix_match.group(2)}"
        return cleaned
        
    if re.match(r'^\d', cleaned) and not re.search(r'Road$', cleaned, flags=re.IGNORECASE):
        cleaned = f"{cleaned} Road"
        
    return cleaned

def point_to_segment_dist(px, py, ax, ay, bx, by):
    l2 = (ax - bx)**2 + (ay - by)**2
    if l2 == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2))
    proj_x = ax + t * (bx - ax)
    proj_y = ay + t * (by - ay)
    return math.hypot(px - proj_x, py - proj_y)

def min_dist_poly_to_poly(p1, p2):
    min_d = float('inf')
    
    # Check all vertices of p1 to all edges of p2
    for i in range(len(p1)):
        px, py = p1[i]
        for j in range(len(p2)):
            ax, ay = p2[j]
            bx, by = p2[(j+1)%len(p2)]
            d = point_to_segment_dist(px, py, ax, ay, bx, by)
            if d < min_d: min_d = d
            
    # Check all vertices of p2 to all edges of p1
    for i in range(len(p2)):
        px, py = p2[i]
        for j in range(len(p1)):
            ax, ay = p1[j]
            bx, by = p1[(j+1)%len(p1)]
            d = point_to_segment_dist(px, py, ax, ay, bx, by)
            if d < min_d: min_d = d
            
    return min_d

def main():
    data_path = os.path.join(os.path.dirname(__file__), '..', 'plot-map-app', 'data', 'plots.master.json')
    with open(data_path, 'r', encoding='utf-8') as f:
        plots = json.load(f)
        
    roads = [p for p in plots if p.get('category') == 'road']
    
    assigned = 0
    unassigned = []
    
    for plot in plots:
        if plot.get('category') == 'plot' and plot.get('sellable'):
            best_road = None
            best_dist = float('inf')
            
            for road in roads:
                d = min_dist_poly_to_poly(plot['points'], road['points'])
                if d < best_dist:
                    best_dist = d
                    best_road = road
                    
            if best_road and best_dist < 50: # increased threshold to 50 just in case
                plot['facingRoad'] = format_road_label(best_road['id'])
                assigned += 1
            else:
                unassigned.append((plot['id'], best_dist))
                
    with open(data_path, 'w', encoding='utf-8') as f:
        json.dump(plots, f, indent=2)
        
    print(f"Assigned facingRoad to {assigned} plots.")
    if unassigned:
        print("Plots with no facing road found within 50 units:")
        for pid, d in unassigned:
            print(f"  {pid} (nearest road was {d:.2f} away)")
            
if __name__ == '__main__':
    main()
