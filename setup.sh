#!/bin/bash

# Continuance Finance - First Launch Setup Script
echo "============================================="
echo "   CONTINUANCE FINANCE SETUP & PERSONALIZATION"
echo "============================================="
echo ""

# 1. Collect Admin Credentials
read -p "Enter desired Admin Username [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -sp "Enter desired Admin Password [admin]: " ADMIN_PASS
echo ""
ADMIN_PASS=${ADMIN_PASS:-admin}

# 2. Collect DB Credentials
echo ""
read -p "Enter Database User [budget_user]: " DB_USER
DB_USER=${DB_USER:-budget_user}

read -sp "Enter Database Password [budget_password]: " DB_PASS
echo ""
DB_PASS=${DB_PASS:-budget_password}

read -p "Enter Database Name [budget_app]: " DB_NAME
DB_NAME=${DB_NAME:-budget_app}

# 3. Collect API Keys
read -p "Enter ExchangeRate-API Key (Optional): " CURRENCY_KEY

# 4. Generate Secret Key for JWT
# Try to use openssl if available, otherwise fallback to a static-random string
if command -v openssl >/dev/null 2>&1; then
    SECRET_KEY=$(openssl rand -hex 32)
else
    SECRET_KEY="fallback-$(date +%s)-$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 20)"
fi

# 5. Write to .env
echo "Generating .env file..."

cat <<EOF > .env
# Database Configuration
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASS
POSTGRES_DB=$DB_NAME

# Security
SECRET_KEY=$SECRET_KEY

# Initial Bootstrap Credentials
# (Only used by the backend on the very first run to seed the DB)
INITIAL_ADMIN_USER=$ADMIN_USER
INITIAL_ADMIN_PASS=$ADMIN_PASS

# External APIs
CURRENCY_API_KEY=$CURRENCY_KEY
EOF

echo ""
echo "---------------------------------------------"
echo "SUCCESS: .env file created!"
echo "---------------------------------------------"
echo "Next Steps:"
echo "1. Run: docker compose up -d --build"
echo "2. Login at http://localhost:3000 with your new credentials."
echo ""
echo "Note: If you already had 'admin' seeded, these new credentials will only"
echo "take effect on a fresh database volume or if you manually add the user."
