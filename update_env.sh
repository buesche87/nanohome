#!/bin/bash

docker compose down
rm -rf appdata
git pull
/bin/bash prepare.sh
docker compose up -d