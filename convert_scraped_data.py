#!/usr/bin/env python3
"""
Convert scraped data into database-ready format
"""
import json
from datetime import datetime

def convert_scraped_data():
    """Convert the scraped data into database format"""
    
    # Load the scraped data
    with open('advanced_scraped_data.json', 'r') as f:
        scraped_data = json.load(f)
    
    # Extract the main data
    main_data = scraped_data['approaches']['Selenium-style HTML parsing']
    links_data = main_data['linksData']
    nodes_data = main_data['nodesData']
    
    print(f"Converting {len(nodes_data)} clergy members and {len(links_data)} relationships...")
    
    # Convert nodes to clergy format
    clergy_data = []
    for node in nodes_data:
        clergy = {
            'id': node['id'],
            'name': node['name'],
            'rank': node['rank'],
            'organization': node['organization'],
            'image_url': node.get('image_url'),
            'high_res_image_url': node.get('high_res_image_url'),
            'ordination_date': node.get('ordination_date'),
            'consecration_date': node.get('consecration_date'),
            'bio': node.get('bio'),
            'rank_color': node.get('rank_color'),
            'org_color': node.get('org_color')
        }
        clergy_data.append(clergy)
    
    # Convert links to relationships
    relationships = []
    for link in links_data:
        rel = {
            'source_id': link['source'],
            'target_id': link['target'],
            'type': link['type'],
            'date': link['date'],
            'color': link['color']
        }
        relationships.append(rel)
    
    # Extract unique ranks and organizations
    ranks = set()
    organizations = set()
    
    for node in nodes_data:
        if node['rank']:
            ranks.add(node['rank'])
        if node['organization']:
            organizations.add(node['organization'])
    
    # Create rank data
    rank_data = []
    for i, rank_name in enumerate(sorted(ranks), 1):
        # Determine if it's a bishop rank (basic heuristic)
        is_bishop = any(keyword in rank_name.lower() for keyword in 
                       ['bishop', 'archbishop', 'cardinal', 'pope', 'patriarch', 'metropolitan'])
        
        rank_data.append({
            'id': i,
            'name': rank_name,
            'is_bishop': is_bishop,
            'color': '#000000'  # Default color
        })
    
    # Create organization data
    org_data = []
    for i, org_name in enumerate(sorted(organizations), 1):
        org_data.append({
            'id': i,
            'name': org_name,
            'color': '#27ae60'  # Default green color
        })
    
    # Create the final database data
    db_data = {
        'clergy': clergy_data,
        'ranks': rank_data,
        'organizations': org_data,
        'relationships': relationships,
        'conversion_metadata': {
            'converted_at': datetime.utcnow().isoformat(),
            'source_file': 'advanced_scraped_data.json',
            'total_clergy': len(clergy_data),
            'total_relationships': len(relationships),
            'total_ranks': len(rank_data),
            'total_organizations': len(org_data)
        }
    }
    
    # Save the converted data
    with open('converted_database_data.json', 'w', encoding='utf-8') as f:
        json.dump(db_data, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"✓ Converted data saved to converted_database_data.json")
    print(f"  - {len(clergy_data)} clergy members")
    print(f"  - {len(relationships)} relationships")
    print(f"  - {len(rank_data)} ranks")
    print(f"  - {len(org_data)} organizations")
    
    return db_data

if __name__ == "__main__":
    convert_scraped_data()
