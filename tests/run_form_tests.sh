#!/bin/bash

# Clergy Forms Test Runner
# This script runs comprehensive tests on all clergy forms

echo "🧪 Clergy Forms Test Suite"
echo "=========================="

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed"
    exit 1
fi

# Check if requests is available
if ! python3 -c "import requests" 2>/dev/null; then
    echo "📦 Installing required dependencies..."
    pip3 install requests
fi

# Default values
URL="http://localhost:5000"
USERNAME="testuser"
PASSWORD="testpass123"
OUTPUT="test_results.json"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            URL="$2"
            shift 2
            ;;
        --username)
            USERNAME="$2"
            shift 2
            ;;
        --password)
            PASSWORD="$2"
            shift 2
            ;;
        --output)
            OUTPUT="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --url URL        Base URL of the application (default: http://localhost:5000)"
            echo "  --username USER  Test username (default: testuser)"
            echo "  --password PASS  Test password (default: testpass123)"
            echo "  --output FILE    Output file for test results (default: test_results.json)"
            echo "  --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Run with defaults"
            echo "  $0 --url http://localhost:8000       # Different port"
            echo "  $0 --username admin --password admin # Different credentials"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🔧 Configuration:"
echo "  URL: $URL"
echo "  Username: $USERNAME"
echo "  Password: $PASSWORD"
echo "  Output: $OUTPUT"
echo ""

# Check if the application is running
echo "🔍 Checking if application is running..."
if ! curl -s --head "$URL" > /dev/null; then
    echo "❌ Application is not running at $URL"
    echo "   Please start your Flask application first:"
    echo "   python app.py"
    echo "   or"
    echo "   python run_local.py"
    exit 1
fi

echo "✅ Application is running"

# Run the tests
echo ""
echo "🚀 Running form tests..."
cd "$(dirname "$0")"
python3 test_clergy_forms.py --url "$URL" --username "$USERNAME" --password "$PASSWORD" --output "$OUTPUT"

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 All tests passed!"
    echo "📊 Results saved to: $OUTPUT"
else
    echo ""
    echo "❌ Some tests failed!"
    echo "📊 Results saved to: $OUTPUT"
    echo ""
    echo "💡 To view detailed results:"
    echo "   cat $OUTPUT | python3 -m json.tool"
fi
