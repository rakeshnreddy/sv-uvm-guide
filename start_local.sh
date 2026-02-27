#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Setup colors
GREEN='\03++33[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== SV-UVM Guide Local Dev Engine ===${NC}"

echo -e "${YELLOW}[1/4] Cleaning up old derived data and Nex.js cache...${NC}"
rm -rf .next
rm -f public/data/curriculum.json
rm -rf content/curriculum/.generated

echo -e "${YELLOW}[2/4] Regenerating curriculum data maps...${NC}"
npx tsx scripts/generate-curriculum-data.ts

echo -e "${YELLOW}[3/4] Ensuring dependencies are installed...${NC}"
npm install

echo -e "${YELLOW}[4/4] Starting Next.js development server...${NC}"
echo -e "${GREEN}The site will be available at http://localhost:3000${NC}"
echo -e "Press Ctrl+C to stop the server."

# Start the dev server
npm run dev
