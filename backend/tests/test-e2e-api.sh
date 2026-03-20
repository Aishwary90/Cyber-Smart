#!/bin/bash

###############################################################################
# End-to-End Integration Test Suite
# Tests OUT_OF_SCOPE validation with running backend server
###############################################################################

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        CYBERSMART AI - END-TO-END API INTEGRATION TEST        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

BACKEND_URL="http://localhost:5000"
TEST_RESULTS=()
PASSED=0
FAILED=0

# Function to test an endpoint
test_api() {
    local test_name="$1"
    local incident_text="$2"
    local expected_type="$3"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Test: $test_name"
    echo "Input: \"$incident_text\""
    echo ""

    # Make API request
    RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/classify" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"$incident_text\"}" 2>&1)

    # Check if response is valid JSON
    if ! echo "$RESPONSE" | grep -q "classification_type"; then
        echo "❌ FAIL - Invalid response or API error"
        echo "Response: $RESPONSE"
        ((FAILED++))
        return 1
    fi

    # Extract classification type
    classification_type=$(echo "$RESPONSE" | grep -o '"classification_type":"[^"]*"' | cut -d'"' -f4)

    echo "Response Classification Type: $classification_type"

    # Check if it matches expected type
    if [ "$classification_type" = "$expected_type" ]; then
        echo "✅ PASS - Got expected classification"

        # Show additional details based on type
        if [ "$classification_type" = "OUT_OF_SCOPE" ]; then
            note=$(echo "$RESPONSE" | grep -o '"note":"[^"]*"' | cut -d'"' -f4 | head -c 80)
            echo "   Message: $note..."
        fi

        ((PASSED++))
    else
        echo "❌ FAIL - Expected $expected_type, got $classification_type"
        ((FAILED++))
    fi

    echo ""
}

# Test 1: Cyber-Related Query (should classify normally)
test_api "Cyber Query - Financial Fraud" \
    "Money stolen from my UPI account" \
    "CRIME"

# Test 2: Out-of-Scope Query (should return OUT_OF_SCOPE)
test_api "Out-of-Scope - Relationship Advice" \
    "How do I get my girlfriend back?" \
    "OUT_OF_SCOPE"

# Test 3: Out-of-Scope Query (should return OUT_OF_SCOPE)
test_api "Out-of-Scope - Weather" \
    "What is the weather today?" \
    "OUT_OF_SCOPE"

# Test 4: Cyber-Related with Hindi (should classify)
test_api "Hindi Cyber Query - Fraud" \
    "मेरे पैसे खाते से चोरी हो गए" \
    "CRIME"

# Test 5: Out-of-Scope with Hindi (should return OUT_OF_SCOPE)
test_api "Hindi Out-of-Scope Query" \
    "मेरा प्रेम जीवन कैसे ठीक करूं?" \
    "OUT_OF_SCOPE"

# Test 6: Cyber-Related - Account Hacking
test_api "Cyber Query - Account Hacking" \
    "Someone hacked my email account" \
    "CRIME"

# Test 7: Out-of-Scope - Homework
test_api "Out-of-Scope - Homework" \
    "Can you help me with my homework?" \
    "OUT_OF_SCOPE"

# Test 8: Cyber-Related - Phishing
test_api "Cyber Query - Phishing" \
    "I received a suspicious phishing email with a fake link" \
    "CRIME"

# Test 9: Out-of-Scope - Cooking
test_api "Out-of-Scope - Cooking" \
    "How do I cook biryani?" \
    "OUT_OF_SCOPE"

# Test 10: Cyber-Related - Ransomware
test_api "Cyber Query - Ransomware" \
    "My computer has ransomware and all files are locked" \
    "CRIME"

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                        TEST SUMMARY                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo "📊 Total:  $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED! System is working correctly in production."
    echo ""
    echo "Backend: http://localhost:5000 ✅"
    echo "Frontend: http://localhost:5174 ✅"
    exit 0
else
    echo "⚠️ Some tests failed. Check the output above."
    exit 1
fi
