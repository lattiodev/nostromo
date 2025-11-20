#!/bin/bash

# Send 5 billion qubic to multiple specified wallets
# Node IP: 194.247.186.149
# Seed: zrfpagcpqfkwjimnrehibkctvwsyzocuikgpedchcyaotcamzaxpivq

NODEIP="194.247.186.149"
NODEPORT="31841"
SEED="zrfpagcpqfkwjimnrehibkctvwsyzocuikgpedchcyaotcamzaxpivq"
AMOUNT="5000000000"  # 5 billion qubic

echo "=== SEND 5 BILLION TO MULTIPLE WALLETS ==="

# Get sender identity
SENDER_IDENTITY=$(./build/qubic-cli -seed $SEED -showkeys | grep "Identity:" | cut -d' ' -f2)
echo "Sender identity: $SENDER_IDENTITY"

# Check sender balance
echo ""
echo "Checking sender balance..."
./build/qubic-cli -nodeip $NODEIP -nodeport $NODEPORT -getbalance $SENDER_IDENTITY

# List of recipient wallets (add/modify as needed)
declare -a RECIPIENTS=(
    "YAOOWFYYPWQRRBKLHMKINMHAWSMAHIBKRFKNJTVCRCOBYKVFDBSDEULCSGPH"
    "GRSAKHENSNWHZDURZIWTDBWLIUVACOKOVHBGEMCFBCFOWQESWFYUCTRGCYHF"
    "CMVWFXZMLTMZPFSFXZADQNZMLUJBKRNIYRGUACSIZEUPIPDMERVCKFRAVYEG"
)

echo ""
echo "📋 RECIPIENTS LIST:"
for i in "${!RECIPIENTS[@]}"; do
    echo "$((i+1)). ${RECIPIENTS[$i]}"
done

echo ""
echo "💰 TRANSFER DETAILS:"
echo "   Amount per wallet: $AMOUNT qubic (5 billion)"
echo "   Total recipients: ${#RECIPIENTS[@]}"
echo "   Total amount: $((AMOUNT * ${#RECIPIENTS[@]})) qubic"

echo ""
echo "=== STARTING TRANSFERS ==="

SUCCESS_COUNT=0
FAILED_COUNT=0

for i in "${!RECIPIENTS[@]}"; do
    RECIPIENT=${RECIPIENTS[$i]}
    
    echo ""
    echo "=== Transfer $((i+1))/${#RECIPIENTS[@]} ==="
    echo "To: $RECIPIENT"
    echo "Amount: $AMOUNT qubic (5 billion)"
    
    TRANSFER_OUTPUT=$(./build/qubic-cli -nodeip $NODEIP -nodeport $NODEPORT -seed $SEED -sendtoaddress $RECIPIENT $AMOUNT)
    
    echo "$TRANSFER_OUTPUT"
    
    # Check if transfer was successful
    if echo "$TRANSFER_OUTPUT" | grep -q "TxHash:"; then
        TX_HASH=$(echo "$TRANSFER_OUTPUT" | grep "TxHash:" | cut -d' ' -f2)
        TICK=$(echo "$TRANSFER_OUTPUT" | grep "Tick:" | cut -d' ' -f2)
        echo "✅ SUCCESS: Transfer submitted"
        echo "   Transaction Hash: $TX_HASH"
        echo "   Scheduled Tick: $TICK"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "❌ FAILED: Transfer failed"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
    
    # Wait between transfers to avoid overwhelming the network
    if [ $i -lt $((${#RECIPIENTS[@]} - 1)) ]; then
        echo "Waiting 30 seconds before next transfer..."
        sleep 30
    fi
done

echo ""
echo "=== TRANSFER SUMMARY ==="
echo "   Total recipients: ${#RECIPIENTS[@]}"
echo "   Successful transfers: $SUCCESS_COUNT"
echo "   Failed transfers: $FAILED_COUNT"
echo "   Amount per transfer: $AMOUNT qubic (5 billion)"
echo "   Total sent: $((AMOUNT * SUCCESS_COUNT)) qubic"

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo ""
    echo "⏳ Waiting 3 minutes for all transfers to process..."
    sleep 180
    
    echo ""
    echo "=== FINAL BALANCE CHECK ==="
    echo "Sender balance after transfers:"
    ./build/qubic-cli -nodeip $NODEIP -nodeport $NODEPORT -getbalance $SENDER_IDENTITY
    
    echo ""
    echo "✅ All transfers completed!"
    echo "💡 Check individual transaction confirmations if needed"
else
    echo ""
    echo "❌ No transfers were successful"
fi

echo ""
echo "=== SCRIPT COMPLETE ==="
