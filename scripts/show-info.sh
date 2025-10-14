#!/bin/bash

# Show CypherCast Program Information
# Useful for demo videos and presentations

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║             🎮 CypherCast Program Information                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

PROGRAM_ID="5a3LkJ73xWyYd7M9jqZtbGY1p9gyJfzSXvHEJdY9ohTF"

echo "📍 Program Details:"
echo "   ID: $PROGRAM_ID"
echo "   Network: Local Solana Test Validator"
echo "   RPC: http://localhost:8899"
echo ""

echo "🔍 Checking program status..."
solana program show $PROGRAM_ID 2>/dev/null

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Program is deployed and accessible!"
else
    echo ""
    echo "❌ Program not found. Make sure the local validator is running."
    exit 1
fi

echo ""
echo "📊 Wallet Information:"
WALLET=$(solana address)
echo "   Address: $WALLET"
BALANCE=$(solana balance --url http://localhost:8899)
echo "   Balance: $BALANCE"
echo ""

echo "🎯 Core Instructions:"
echo "   1. create_stream     - Initialize new stream"
echo "   2. join_stream       - Join as participant"
echo "   3. submit_prediction - Submit prediction with stake"
echo "   4. end_stream        - Finalize stream"
echo "   5. claim_reward      - Claim earned rewards"
echo ""

echo "📝 Account Types (PDAs):"
echo "   • Stream      - seeds: [\"stream\", creator, stream_id]"
echo "   • Participant - seeds: [\"participant\", stream, viewer]"
echo "   • Prediction  - seeds: [\"prediction\", stream, viewer]"
echo ""

echo "🚀 Quick Commands:"
echo "   Run demo:    ./run-demo.sh"
echo "   Create:      node direct-cli.js create \"Title\" \"Desc\""
echo "   Help:        node direct-cli.js"
echo ""

echo "══════════════════════════════════════════════════════════════"
