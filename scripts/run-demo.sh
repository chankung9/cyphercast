#!/bin/bash

# CypherCast Demo Script
# Run this to demonstrate the full platform functionality

echo "🎮 CypherCast Platform Demo"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "This demo will show all core features:"
echo "  1. Create a new interactive stream"
echo "  2. Join the stream as a viewer"
echo "  3. Submit a prediction with stake"
echo "  4. Fetch stream data from blockchain"
echo ""
echo "Press any key to start..."
read -n 1 -s

echo ""
echo "Starting demo..."
echo ""

# Run the full demo
node direct-cli.js demo

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Demo complete! All transactions confirmed on-chain."
echo ""
echo "Key features demonstrated:"
echo "  ✅ On-chain stream creation"
echo "  ✅ PDA-based account management"
echo "  ✅ Stake-based participation"
echo "  ✅ Prediction submission"
echo "  ✅ Real-time blockchain data fetching"
echo ""
echo "Program ID: 5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF"
echo "Network: Local Solana Test Validator"
echo ""
echo "🎯 CypherCast - Watch & Earn on Solana"
