
# Nanohome
mkdir -p "/mnt/data/appdata/nanohome/config"
mkdir -p "/mnt/data/appdata/nanohome/data/grafana"
mkdir -p "/mnt/data/appdata/nanohome/log"

# Grafana
mkdir -p "/mnt/data/appdata/grafana/config"
cp -f "./configs/grafana.ini" "/mnt/data/appdata/grafana/config"
mkdir -p "/mnt/data/appdata/grafana/data"
mkdir -p "/mnt/data/appdata/grafana/ssl"

# InfluxDB
mkdir -p "/mnt/data/appdata/influxdb/config"
mkdir -p "/mnt/data/appdata/influxdb/data"

# Mosquitto
mkdir -r "/mnt/data/appdata/mosquitto/config"
cp -f "./configs/mosquitto.conf" "/mnt/data/appdata/mosquitto/config"
mkdir -r "/mnt/data/appdata/mosquitto/data"
mkdir -r "/mnt/data/appdata/mosquitto/log"