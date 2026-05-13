# League of Legends Data Extraction & Analysis

## Overview
A Python-based data extraction and analysis project that processes League of Legends match data to uncover champion performance insights. This project demonstrates ETL (Extract, Transform, Load) pipeline skills with data cleaning, statistical analysis, and visualization.

## What This Does

- **Extracts** League of Legends match data from CSV sources
- **Transforms** raw data through cleaning and aggregation
- **Analyzes** champion win rates and performance metrics
- **Visualizes** results with publication-quality charts

## Key Features

✅ Data cleaning and validation  
✅ Statistical analysis (win rates, play rates)  
✅ Professional data visualization using matplotlib & seaborn  
✅ Handles real-world messy data  
✅ Generates actionable insights from 1000+ game records  

## Technical Stack

- **Language**: Python 3.14
- **Libraries**: 
  - `pandas` - Data manipulation & aggregation
  - `matplotlib` - Chart generation
  - `seaborn` - Statistical visualization
- **Data Format**: CSV

## Sample Results

The analysis identifies:
- **Top performing champions** by win rate
- **Most played champions** in the dataset
- **Champion popularity trends**

See `league_analysis.png` for the visualization output.

## How to Run

### Prerequisites
```bash
pip install pandas matplotlib seaborn
```

### Execution
```bash
python main.py
```

### Output
- Console statistics (top champions, play counts)
- `league_analysis.png` - Bar chart visualization

## Project Structure
```
League-Data-Extraction-Project/
├── main.py                     # Main analysis script
├── games.csv                   # League match dataset
├── champion_info.json          # Champion metadata
├── summoner_spell_info.json    # Summoner spell reference
└── league_analysis.png         # Generated visualization
```

## Key Insights from Analysis

This project demonstrates:
- **Data pipeline design**: Extract → Clean → Transform → Analyze → Visualize
- **Python proficiency**: Pandas for data manipulation, matplotlib for visualization
- **Statistical thinking**: Filtering outliers, calculating rates, identifying trends
- **Professional output**: Publication-quality charts with proper labeling

## Skills Demonstrated

- Data extraction from CSV sources
- Data cleaning (handling missing values, filtering)
- Statistical aggregation and analysis
- Data visualization best practices
- Python scripting and automation

---

**Author**: Eshino  
**Date**: May 2026  
**Purpose**: Portfolio project showcasing data engineering fundamentals
