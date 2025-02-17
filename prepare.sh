# Use this script to prepare some directories for your docker containers

appdatapath="./appdata"

# Nanohome
mkdir -p "$appdatapath/nanohome/config"
mkdir -p "$appdatapath/nanohome/data/grafana"
mkdir -p "$appdatapath/nanohome/log"

# Grafana
mkdir -p "$appdatapath/grafana/config"
chmod 755 "$appdatapath/grafana/config"
cp -f "./configs/grafana.ini" "$appdatapath/grafana/config"
mkdir -p "$appdatapath/grafana/data"
chmod 755 "$appdatapath/grafana/data"

# InfluxDB
mkdir -p "$appdatapath/influxdb/config"
chmod 755 "$appdatapath/influxdb/config"
mkdir -p "$appdatapath/influxdb/data"
chmod 755 "$appdatapath/influxdb/data"

# Mosquitto
mkdir -p "$appdatapath/mosquitto/config"
cp -f "./configs/mosquitto.conf" "$appdatapath/mosquitto/config"
mkdir -p "$appdatapath/mosquitto/data"
mkdir -p "$appdatapath/mosquitto/log"