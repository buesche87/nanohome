# Use this script to prepare some directories for your docker containers

appdatapath="./appdata"

# Nanohome
mkdir -p "$appdatapath/nanohome/data/grafana"
chmod 775 "$appdatapath/grafana/config"

# Grafana
mkdir -p "$appdatapath/grafana/config"
chmod 775 "$appdatapath/grafana/config"
cp -f "./configs/grafana.ini" "$appdatapath/grafana/config"
mkdir -p "$appdatapath/grafana/data"
chmod 775 "$appdatapath/grafana/data"

# InfluxDB
mkdir -p "$appdatapath/influxdb/config"
chmod 775 "$appdatapath/influxdb/config"
mkdir -p "$appdatapath/influxdb/data"
chmod 775 "$appdatapath/influxdb/data"

# Mosquitto
mkdir -p "$appdatapath/mosquitto/config"
chmod 775 "$appdatapath/mosquitto/config"
cp -f "./configs/mosquitto.conf" "$appdatapath/mosquitto/config"
chmod 700 "$appdatapath/mosquitto/config/mosquitto.conf"
mkdir -p "$appdatapath/mosquitto/data"
chmod 775 "$appdatapath/mosquitto/data"
mkdir -p "$appdatapath/mosquitto/log"
chmod 775 "$appdatapath/mosquitto/log"