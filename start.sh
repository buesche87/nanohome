#!/bin/bash


# Create InfluxDB configuration profiles
influx config create \
  --config-name "${INFLUXDB_CONFIG}" \
  --host-url "http://${INFLUXDB_SERVICE}" \
  --org "${INFLUXDB_ORG}" \
  --token "${INFLUXDB_ADMINTOKEN}" \
  --active

# Check if buckets exist, create if not
influx bucket list --name "${INFLUXDB_BUCKET_DEVICES}" >/dev/null 2>&1
if [ $? -ne 0 ]; then
	# Create devices bucket
	influx bucket create \
	  --name "${INFLUXDB_BUCKET_DEVICES}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}"
fi

influx bucket list --name "${INFLUXDB_BUCKET_MEASUREMENTS}" >/dev/null 2>&1
if [ $? -ne 0 ]; then
	# Create measurement bucket
	influx bucket create \
	  --name "${INFLUXDB_BUCKET_MEASUREMENTS}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}"
fi

# Start crond in the background
crond -f &

# Start nanohome services
/bin/bash /opt/nanohome/services/mqtt_shell -s &
/bin/bash /opt/nanohome/services/devwatcher_shelly_legacy &
/bin/bash /opt/nanohome/services/devwatcher_shelly_plus &
/bin/bash /opt/nanohome/services/measurements_shelly_legacy &
/bin/bash /opt/nanohome/services/measurements_shelly_plus &
#/bin/bash /opt/nanohome/services/standby_shelly_plus &

# Start bash
exec bash
