#!/bin/bash
echo "==================================================="
echo "  🚀 Launching ManaRent Production Server (Port 4000)"
echo "==================================================="
cd "$(dirname "$0")"
node server.js
