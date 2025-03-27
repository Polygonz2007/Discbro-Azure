#!/bin/bash
sudo apt-get update
sudo apt install git nodejs npm -y
git clone https://github.com/Polygonz2007/Discbro-Azure
cd /home/poly/Discbro-Azure
npm i
sudo node .
