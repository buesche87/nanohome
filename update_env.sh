#!/bin/bash

rm -rf appdata
git pull
/bin/bash prepare.sh
docker compose up -d