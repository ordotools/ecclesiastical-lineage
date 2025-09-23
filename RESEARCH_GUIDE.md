# Ecclesiastical Lineage Research Guide

## Overview
Your database has **38 bishops and 11 priests** without lineage data. This guide provides specific research targets and sources to find their ordination and consecration information.

## High-Priority Research Targets

### 1. Society of St. Pius X (SSPX) Bishops
These are well-documented and should be easy to find:

#### Bernard Fellay
- **Current Status**: Superior General of SSPX (2000-2018)
- **Research**: Ordained priest and consecrated bishop by Marcel Lefebvre
- **Likely Dates**: Ordination ~1982, Consecration 1988-06-30
- **Sources**: SSPX official website, traditional Catholic sources

#### Bernard Tissier de Mallerais  
- **Current Status**: Former SSPX bishop
- **Research**: Ordained priest and consecrated bishop by Marcel Lefebvre
- **Likely Dates**: Ordination ~1982, Consecration 1988-06-30
- **Sources**: SSPX official website, traditional Catholic sources

#### Alphonso de Galarreta
- **Current Status**: SSPX bishop
- **Research**: Ordained priest and consecrated bishop by Marcel Lefebvre  
- **Likely Dates**: Ordination ~1982, Consecration 1988-06-30
- **Sources**: SSPX official website, traditional Catholic sources

#### Marcel Lefebvre
- **Current Status**: Founder of SSPX (deceased)
- **Research**: Ordained priest and consecrated bishop in mainstream Catholic Church
- **Likely Dates**: Ordination 1929, Consecration 1947
- **Sources**: Catholic hierarchy websites, Vatican records

### 2. Traditional Catholic Bishops

#### António de Castro Mayer
- **Current Status**: Brazilian traditional Catholic bishop (deceased)
- **Research**: Ordained priest and consecrated bishop in mainstream Catholic Church
- **Likely Dates**: Ordination 1927, Consecration 1948
- **Sources**: Brazilian Catholic records, traditional Catholic sources

#### Darío Castrillón Hoyos
- **Current Status**: Colombian cardinal (deceased)
- **Research**: Ordained priest and consecrated bishop in mainstream Catholic Church
- **Likely Dates**: Ordination 1952, Consecration 1971
- **Sources**: Vatican records, Colombian Catholic hierarchy

## Research Sources

### 1. Official Websites
- **SSPX**: https://sspx.org/en/about-sspx/bishops
- **CMRI**: https://cmri.org/bishops.htm
- **FSSP**: https://fssp.org
- **Institute of Christ the King**: https://institute-christ-king.org

### 2. Catholic Hierarchy Databases
- **Catholic-Hierarchy.org**: Comprehensive database of bishops and dioceses
- **GCatholic.org**: Global Catholic database
- **CatholicData.org**: Modern Catholic data platform

### 3. Traditional Catholic Sources
- **Traditional Catholic forums**: cathinfo.com, traditionalcatholicforum.com
- **Traditional Catholic news sites**: Rorate Caeli, The Remnant
- **YouTube channels**: Traditional Catholic content creators

### 4. Academic Sources
- **JSTOR**: Academic papers on traditional Catholic movements
- **Google Scholar**: Research papers on SSPX and traditional Catholic bishops
- **University libraries**: Specialized Catholic history collections

## Search Strategies

### Google Search Queries
```
"Bernard Fellay" bishop consecration 1988
"Bernard Tissier de Mallerais" ordination priest
"Alphonso de Galarreta" SSPX bishop
"Marcel Lefebvre" episcopal ordination 1947
"António de Castro Mayer" Brazilian bishop consecration
```

### Specific Website Searches
1. **Catholic-Hierarchy.org**: Search by bishop name
2. **SSPX.org**: Check bishop biographies
3. **Traditional Catholic forums**: Search for consecration announcements
4. **YouTube**: Search for consecration ceremonies

## Data Entry Format

Once you find the information, use this format:

### For Ordinations:
```json
{
  "clergy_name": "Bernard Fellay",
  "ordaining_bishop_name": "Marcel Lefebvre", 
  "date": "1982-06-29",
  "notes": "Ordained priest by Archbishop Lefebvre in Écône, Switzerland"
}
```

### For Consecrations:
```json
{
  "clergy_name": "Bernard Fellay",
  "consecrator_name": "Marcel Lefebvre",
  "date": "1988-06-30", 
  "notes": "Consecrated bishop by Archbishop Lefebvre in Écône, Switzerland"
}
```

## Tools Available

1. **`add_lineage_data.py`**: Add data to database
2. **`identify_missing_lineage.py`**: Analyze what's missing
3. **`traditional_catholic_scraper.py`**: Automated web scraping

## Expected Impact

Adding lineage data for these bishops could potentially add **50-100 new relationships** to your database, significantly expanding the lineage visualization.

## Priority Order

1. **SSPX bishops** (well-documented, easy to find)
2. **Major traditional Catholic bishops** (good documentation)
3. **Independent bishops** (harder to find, may require more research)
4. **Priests** (lower priority, focus on bishops first)

## Next Steps

1. Start with SSPX bishops (Bernard Fellay, Bernard Tissier de Mallerais, Alphonso de Galarreta)
2. Use the provided search queries and sources
3. Create a JSON file with the found data
4. Use `add_lineage_data.py` to add it to the database
5. Test the lineage visualization to see the new relationships

## Sample Commands

```bash
# Create sample data file
python add_lineage_data.py --sample

# Edit the sample file with your research findings
# Then add the data
python add_lineage_data.py sample_lineage_data.json

# Or use interactive mode
python add_lineage_data.py --interactive
```
