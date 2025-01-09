#!/bin/bash


# Create InfluxDB configuration profiles
influx config create \
  --config-name "${INFLUXDB_CONFIG}" \
  --host-url "http://${INFLUXDB_SERVICE}" \
  --org "${INFLUXDB_ORG}" \
  --token "${INFLUXDB_ADMINTOKEN}" \
  --active


# Run once 
RUNONCEDONE="/opt/nanohome/config/runoncedone"

if [ ! -f "${RUNONCEDONE}" ]; then



	# Create devices bucket
	influx bucket create \
	  --name "${INFLUXDB_BUCKET_DEVICES}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}"

	# Create measurement bucket
	influx bucket create \
	  --name "${INFLUXDB_BUCKET_MEASUREMENTS}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}"

	touch "${RUNONCEDONE}"
fi




# Start crond in the background
crond -f &

# Start nanohome services
/bin/bash /opt/nanohome/services/mqtt_shell -s &
#/bin/bash /opt/nanohome/services/devwatcher_shelly_legacy &
#/bin/bash /opt/nanohome/services/devwatcher_shelly_plus & 
#/bin/bash /opt/nanohome/services/measurements_shelly_legacy &
#/bin/bash /opt/nanohome/services/measurements_shelly_plus &
#/bin/bash /opt/nanohome/standby_shelly_plus &

# Start bash
exec bash
