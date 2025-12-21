### To Make sure Install works fine
1. docker compose exec api pip install "pytest<8.1.0" allure-pytest
2. docker compose exec api python -m pytest tests/ --alluredir=allure-results


# Local 
1. brew install allure

## on VM
# 1. Install Java (Required for Allure)
sudo apt-get update && sudo apt-get install -y default-jre wget

# 2. Download Allure
wget https://github.com/allure-framework/allure2/releases/download/2.36.0/allure_2.36.0-1_all.deb

# 3. Install it
sudo dpkg -i allure_2.36.0-1_all.deb

# Serve

allure serve ./allure-results --host 0.0.0.0 --port 1234

and in the main branch we have run_tests.sh

which runs and serves API test results