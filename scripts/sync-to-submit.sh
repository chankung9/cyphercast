#!/bin/bash

# 🔄 Repository Sync Script
# Syncs working code from cyphercast-develop → cyphercast (submit repo)

set -e

echo "🔄 CypherCast Repository Sync"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Paths
DEVELOP_REPO="$HOME/Workspace/solana/cyphercast-develop"
SUBMIT_REPO="$HOME/Workspace/solana/cyphercast"

# Check if repos exist
if [ ! -d "$DEVELOP_REPO" ]; then
    echo -e "${RED}❌ Development repo not found: $DEVELOP_REPO${NC}"
    exit 1
fi

if [ ! -d "$SUBMIT_REPO" ]; then
    echo -e "${RED}❌ Submit repo not found: $SUBMIT_REPO${NC}"
    exit 1
fi

echo -e "${YELLOW}📂 Source: $DEVELOP_REPO${NC}"
echo -e "${YELLOW}📦 Target: $SUBMIT_REPO${NC}"
echo ""

# Confirmation
read -p "⚠️  This will overwrite files in submit repo. Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "🚀 Starting sync..."
echo ""

# 1. Copy Anchor program
echo "📋 [1/8] Copying Anchor program..."
rm -rf "$SUBMIT_REPO/programs"
cp -r "$DEVELOP_REPO/programs" "$SUBMIT_REPO/"
echo -e "${GREEN}✅ Programs copied${NC}"

# 2. Copy tests
echo "📋 [2/8] Copying tests..."
rm -rf "$SUBMIT_REPO/tests"
cp -r "$DEVELOP_REPO/tests" "$SUBMIT_REPO/"
echo -e "${GREEN}✅ Tests copied${NC}"

# 3. Copy CLI tools
echo "📋 [3/8] Copying CLI tools..."
rm -rf "$SUBMIT_REPO/cli"
cp -r "$DEVELOP_REPO/cli" "$SUBMIT_REPO/"
echo -e "${GREEN}✅ CLI copied${NC}"

# 4. Copy scripts
echo "📋 [4/8] Copying scripts..."
rm -rf "$SUBMIT_REPO/scripts"
cp -r "$DEVELOP_REPO/scripts" "$SUBMIT_REPO/"
chmod +x "$SUBMIT_REPO/scripts"/*.sh
echo -e "${GREEN}✅ Scripts copied${NC}"

# 5. Copy app (if frontend is ready)
if [ -f "$DEVELOP_REPO/app/src/App.tsx" ] && [ -s "$DEVELOP_REPO/app/src/App.tsx" ]; then
    echo "📋 [5/8] Copying app..."
    rm -rf "$SUBMIT_REPO/app"
    cp -r "$DEVELOP_REPO/app" "$SUBMIT_REPO/"
    echo -e "${GREEN}✅ App copied${NC}"
else
    echo -e "${YELLOW}⚠️  [5/8] Skipping app (not ready)${NC}"
fi

# 6. Copy config files
echo "📋 [6/8] Copying config files..."
cp "$DEVELOP_REPO/Anchor.toml" "$SUBMIT_REPO/"
cp "$DEVELOP_REPO/package.json" "$SUBMIT_REPO/"
cp "$DEVELOP_REPO/tsconfig.json" "$SUBMIT_REPO/" 2>/dev/null || true
echo -e "${GREEN}✅ Config files copied${NC}"

# 7. Copy essential docs
echo "📋 [7/8] Copying documentation..."
mkdir -p "$SUBMIT_REPO/docs"
cp "$DEVELOP_REPO/docs/LOCAL_SETUP.md" "$SUBMIT_REPO/" 2>/dev/null || true
cp "$DEVELOP_REPO/docs/CLI-QUICK-REF.md" "$SUBMIT_REPO/docs/" 2>/dev/null || true
echo -e "${GREEN}✅ Documentation copied${NC}"

# 8. Copy target/deploy (if exists)
echo "📋 [8/8] Copying deployment artifacts..."
if [ -d "$DEVELOP_REPO/target/deploy" ]; then
    mkdir -p "$SUBMIT_REPO/target/deploy"
    cp "$DEVELOP_REPO/target/deploy/cyphercast.so" "$SUBMIT_REPO/target/deploy/" 2>/dev/null || true
    cp "$DEVELOP_REPO/target/deploy/cyphercast-keypair.json" "$SUBMIT_REPO/target/deploy/" 2>/dev/null || true
fi
if [ -d "$DEVELOP_REPO/target/idl" ]; then
    mkdir -p "$SUBMIT_REPO/target/idl"
    cp "$DEVELOP_REPO/target/idl/cyphercast.json" "$SUBMIT_REPO/target/idl/" 2>/dev/null || true
fi
if [ -d "$DEVELOP_REPO/target/types" ]; then
    mkdir -p "$SUBMIT_REPO/target/types"
    cp "$DEVELOP_REPO/target/types/cyphercast.ts" "$SUBMIT_REPO/target/types/" 2>/dev/null || true
fi
echo -e "${GREEN}✅ Deployment artifacts copied${NC}"

echo ""
echo "🎉 Sync completed successfully!"
echo ""
echo "📊 Summary:"
echo "  ✅ Programs: synced"
echo "  ✅ Tests: synced"
echo "  ✅ CLI: synced"
echo "  ✅ Scripts: synced"
echo "  ✅ Config: synced"
echo "  ✅ Docs: synced"
echo ""

# Get Program ID
if [ -f "$SUBMIT_REPO/target/idl/cyphercast.json" ]; then
    PROGRAM_ID=$(grep -o '"address": "[^"]*"' "$SUBMIT_REPO/target/idl/cyphercast.json" | cut -d'"' -f4 | head -1)
    if [ -n "$PROGRAM_ID" ]; then
        echo -e "${GREEN}📝 Program ID: $PROGRAM_ID${NC}"
        echo ""
    fi
fi

# Next steps
echo "🔜 Next Steps:"
echo "  1. cd $SUBMIT_REPO"
echo "  2. Review changes: git status"
echo "  3. Update README.md with actual Program ID"
echo "  4. Test: anchor build && anchor test"
echo "  5. Commit: git add . && git commit -m 'sync: Update from develop repo'"
echo "  6. Push: git push"
echo ""

# Optional: Show diff summary
read -p "📊 Show git status in submit repo? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$SUBMIT_REPO"
    echo ""
    echo "Git Status:"
    git status --short
    echo ""
fi

echo "✨ Done!"
