#!/bin/bash
# Make directory for this stuff
mkdir /app
cd /app

# Update and install stuff
sudo apt-get update
sudo apt install git nodejs npm -y

# Get discbro
git clone https://github.com/Polygonz2007/Discbro-Azure
cd /discbro/Discbro-Azure

# Install packages, run
npm i
sudo node .
