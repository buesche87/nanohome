#!/bin/bash

# ggf in start.sh integrieren > file erstellen, wenn config durch und abfragen ob config existiert

RUNONCEDONE="/opt/nanohome/config/runoncedone"

if [ ! -f "${RUNONCEDONE}" ]; then

	# Create InfluxDB configuration profiles
	influx config create \
	  --config-name "${INFLUXDB_CONFIG}" \
	  --host-url "http://${INFLUXDB_SERVICE}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}" \
	  --active

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

# Setup grafana & dashboards