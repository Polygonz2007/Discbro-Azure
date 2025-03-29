#!/bin/bash
# Make directory for this stuff
mkdir /app
cd /app

# Update and install stuff
apt-get update
apt install git nodejs npm -y

# Get discbro
git clone https://github.com/Polygonz2007/Discbro-Azure
cd /app/Discbro-Azure

# Create .env (very secure ik)
cat > .env <<EOL
session_secret = "very_super_secret"

db_user = "poly"
db_password = "Passord01234"
db_url = "polygonz.database.windows.net"
db_name = "Test Database"
EOL

# Install packages, run
npm i
node .
