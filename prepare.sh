#!/bin/bash
# Use this script to prepare some directories for your docker containers

appdatapath="./appdata"

# Nanohome
mkdir -p "$appdatapath/nanohome/data/grafana"
chmod 777 "$appdatapath/nanohome/data/grafana"

# Grafana
mkdir -p "$appdatapath/grafana/data"
chmod 777 "$appdatapath/grafana/data"

# InfluxDB
mkdir -p "$appdatapath/influxdb/config"
chmod 777 "$appdatapath/influxdb/config"
mkdir -p "$appdatapath/influxdb/data"
chmod 777 "$appdatapath/influxdb/data"

# Mosquitto
mkdir -p "$appdatapath/mosquitto/config"
chmod 777 "$appdatapath/mosquitto/config"
cp -f "./configs/mosquitto.conf" "$appdatapath/mosquitto/config"
mkdir -p "$appdatapath/mosquitto/data"
chmod 777 "$appdatapath/mosquitto/data"
mkdir -p "$appdatapath/mosquitto/log"
chmod 777 "$appdatapath/mosquitto/log"