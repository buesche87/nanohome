
# Nanohome
mkdir -p "/mnt/data/appdata/nanohome/config"
mkdir -p "/mnt/data/appdata/nanohome/data/grafana"
mkdir -p "/mnt/data/appdata/nanohome/log"

# Grafana
mkdir -p "/mnt/data/appdata/nanohome/config/grafana"
cp -f "./grafana.ini" "/mnt/data/appdata/nanohome/config/grafana"
mkdir -p "/mnt/data/appdata/grafana/data"
mkdir -p "/mnt/data/appdata/grafana/ssl"

# InfluxDB
mkdir -p "/mnt/data/appdata/influxdb/config"
mkdir -p "/mnt/data/appdata/influxdb/data"

# Mosquitto
mkdir -r "/mnt/data/appdata/mosquitto/config"
mkdir -r "/mnt/data/appdata/mosquitto/data"
mkdir -r "/mnt/data/appdata/mosquitto/log"