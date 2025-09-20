#!/usr/bin/env python3
"""
Identify bishops in the database who are missing lineage data
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import Clergy, Ordination, Consecration

def analyze_missing_lineage():
    """Analyze which clergy are missing lineage data"""
    
    with app.app_context():
        print("🔍 Analyzing missing lineage data...")
        
        # Get all clergy
        all_clergy = Clergy.query.filter(Clergy.is_deleted != True).all()
        
        bishops_without_lineage = []
        priests_without_lineage = []
        
        for clergy in all_clergy:
            has_ordination = Ordination.query.filter_by(clergy_id=clergy.id).first() is not None
            has_consecration = Consecration.query.filter_by(clergy_id=clergy.id).first() is not None
            
            if not has_ordination and not has_consecration:
                if clergy.rank and 'bishop' in clergy.rank.lower():
                    bishops_without_lineage.append(clergy)
                elif clergy.rank and 'priest' in clergy.rank.lower():
                    priests_without_lineage.append(clergy)
        
        print(f"\n📊 Missing Lineage Analysis:")
        print(f"   Total clergy: {len(all_clergy)}")
        print(f"   Bishops without lineage: {len(bishops_without_lineage)}")
        print(f"   Priests without lineage: {len(priests_without_lineage)}")
        
        # Group bishops by organization for targeted research
        print(f"\n🏛️  Bishops without lineage by organization:")
        by_org = {}
        for bishop in bishops_without_lineage:
            org = bishop.organization or "Unknown"
            if org not in by_org:
                by_org[org] = []
            by_org[org].append(bishop)
        
        for org, bishops in by_org.items():
            print(f"   {org}: {len(bishops)} bishops")
            for bishop in bishops[:3]:  # Show first 3
                print(f"     - {bishop.name}")
            if len(bishops) > 3:
                print(f"     ... and {len(bishops) - 3} more")
        
        # Create research targets
        print(f"\n🎯 Top Research Targets:")
        research_targets = []
        
        # Prioritize well-known bishops
        priority_bishops = [
            "Bernard Fellay",
            "Bernard Tissier de Mallerais", 
            "Alphonso de Galarreta",
            "António de Castro Mayer",
            "Darío Castrillón Hoyos"
        ]
        
        for bishop in bishops_without_lineage:
            if any(name.lower() in bishop.name.lower() for name in priority_bishops):
                research_targets.append({
                    'name': bishop.name,
                    'organization': bishop.organization,
                    'rank': bishop.rank,
                    'priority': 'HIGH'
                })
        
        # Add other bishops
        for bishop in bishops_without_lineage[:10]:
            if not any(name.lower() in bishop.name.lower() for name in priority_bishops):
                research_targets.append({
                    'name': bishop.name,
                    'organization': bishop.organization,
                    'rank': bishop.rank,
                    'priority': 'MEDIUM'
                })
        
        print(f"\n📋 Research Priority List:")
        for i, target in enumerate(research_targets, 1):
            print(f"{i:2d}. [{target['priority']}] {target['name']}")
            print(f"     Organization: {target['organization']}")
            print(f"     Rank: {target['rank']}")
            print()
        
        # Generate search queries
        print(f"🔍 Suggested Google Search Queries:")
        for target in research_targets[:5]:
            name = target['name']
            print(f"   \"{name}\" bishop consecration")
            print(f"   \"{name}\" episcopal ordination traditional catholic")
            print(f"   \"{name}\" {target['organization']} bishop lineage")
            print()
        
        return research_targets

def generate_scraping_targets():
    """Generate specific targets for web scraping"""
    
    targets = [
        {
            'name': 'SSPX Bishops',
            'urls': [
                'https://sspx.org/en/about-sspx/bishops',
                'https://fsspx.org/en/content/bishops',
                'https://sspx.org/en/sspx-news'
            ],
            'search_terms': ['SSPX bishop consecration', 'Society of St Pius X bishops']
        },
        {
            'name': 'CMRI Bishops', 
            'urls': [
                'https://cmri.org/bishops.htm',
                'https://cmri.org/consecrations.htm'
            ],
            'search_terms': ['CMRI bishop consecration', 'Congregation Mary Immaculate Queen bishops']
        },
        {
            'name': 'Traditional Catholic Forums',
            'urls': [
                'https://www.traditionalcatholicforum.com',
                'https://www.cathinfo.com'
            ],
            'search_terms': ['bishop consecration announcement', 'episcopal ordination traditional']
        }
    ]
    
    print(f"🎯 Web Scraping Targets:")
    for target in targets:
        print(f"\n{target['name']}:")
        print(f"  URLs: {', '.join(target['urls'])}")
        print(f"  Search terms: {', '.join(target['search_terms'])}")
    
    return targets

if __name__ == "__main__":
    try:
        research_targets = analyze_missing_lineage()
        scraping_targets = generate_scraping_targets()
        
        print(f"\n✅ Analysis complete!")
        print(f"   Found {len(research_targets)} bishops needing lineage data")
        print(f"   Generated {len(scraping_targets)} scraping targets")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
