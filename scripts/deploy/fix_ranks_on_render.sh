#!/bin/bash
# Simple script to fix rank data on Render production server

echo "🔧 Fixing rank data on Render production server..."

# Run the fix script
python3 scripts/database/fix_production_ranks_simple.py

echo "✅ Rank fix completed!"
