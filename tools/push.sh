#!/bin/sh
# Pushes this project to the private GitHub repo (Cloudflare Workers Builds then deploys it).
# The token is read from the PV Keys folder at push time; it is never stored in this repo.
T="${PV_KEYS:-$HOME/mnt/PV Keys}/github_token.txt"
git -c credential.helper= -c credential.helper="!f() { echo username=x-access-token; printf 'password=%s\n' \"\$(tr -d '\r\n' < '$T')\"; }; f" push origin main
