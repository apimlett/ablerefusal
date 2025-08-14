#!/bin/bash

# API Test Script for Stable Diffusion Platform

API_URL="http://localhost:8080/api/v1"

echo "========================================="
echo "Testing Stable Diffusion Platform API"
echo "========================================="
echo ""

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        curl -s -X "$method" "$API_URL$endpoint" -H "Content-Type: application/json"
    else
        curl -s -X "$method" "$API_URL$endpoint" -H "Content-Type: application/json" -d "$data"
    fi
}

# Test 1: Health check
echo "1. Testing health endpoint..."
response=$(api_call GET /health)
if echo "$response" | grep -q "healthy"; then
    echo "   ✅ Health check passed"
else
    echo "   ❌ Health check failed"
    echo "   Response: $response"
fi
echo ""

# Test 2: Ready check
echo "2. Testing ready endpoint..."
response=$(api_call GET /ready)
if echo "$response" | grep -q "ready"; then
    echo "   ✅ Ready check passed"
    echo "   Response: $response" | python3 -m json.tool 2>/dev/null || echo "$response"
else
    echo "   ❌ Ready check failed"
    echo "   Response: $response"
fi
echo ""

# Test 3: Models list
echo "3. Testing models endpoint..."
response=$(api_call GET /models)
if echo "$response" | grep -q "models"; then
    echo "   ✅ Models endpoint working"
    echo "   Available models:"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
else
    echo "   ❌ Models endpoint failed"
    echo "   Response: $response"
fi
echo ""

# Test 4: Generation request
echo "4. Testing generation endpoint..."
generation_data='{
    "prompt": "a beautiful sunset over mountains",
    "negative_prompt": "ugly, blurry",
    "width": 512,
    "height": 512,
    "steps": 20,
    "cfg_scale": 7.5,
    "seed": 42,
    "batch_size": 1,
    "sampler": "euler_a"
}'

response=$(api_call POST /generate "$generation_data")
if echo "$response" | grep -q "queued"; then
    echo "   ✅ Generation request accepted"
    
    # Extract ID from response
    generation_id=$(echo "$response" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo "   Generation ID: $generation_id"
    
    # Wait a moment
    sleep 2
    
    # Check status
    echo ""
    echo "5. Testing status endpoint..."
    status_response=$(api_call GET "/generate/$generation_id")
    echo "   Status response:"
    echo "$status_response" | python3 -m json.tool 2>/dev/null || echo "$status_response"
else
    echo "   ❌ Generation request failed"
    echo "   Response: $response"
fi
echo ""

# Test 5: Queue status
echo "6. Testing queue endpoint..."
response=$(api_call GET /queue)
if echo "$response" | grep -q "queue"; then
    echo "   ✅ Queue endpoint working"
    echo "   Queue status:"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
else
    echo "   ❌ Queue endpoint failed"
    echo "   Response: $response"
fi
echo ""

echo "========================================="
echo "API tests complete!"
echo "========================================="