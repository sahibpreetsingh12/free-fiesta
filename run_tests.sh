#!/bin/bash

# 1. Clean up old artifacts (prevents "ghost" fail reports)
echo "🧹 Cleaning up old reports..."
rm -rf allure-results/*

# 2. Run the tests inside the container
echo "🧪 Running Tests in Docker..."
docker compose exec api python -m pytest tests/ --alluredir=allure-results

# 3. Check if tests passed or failed
if [ $? -eq 0 ]; then
    echo "✅ Tests Passed!"
else
    echo "❌ Tests Failed!"
fi

# 4. Serve the report
echo "📊 Serving Report on Port 1234..."
echo "👉 Open http://$(curl -s ifconfig.me):1234"
allure serve allure-results --host 0.0.0.0 --port 1234