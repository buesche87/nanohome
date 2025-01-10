#!/bin/bash

########################
# NanoHome Environment         
########################

export ROOTPATH="/opt/nanohome"
export INFLUXDB_BUCKET_DEVICES="devices"
export INFLUXDB_BUCKET_MEASUREMENTS="measurements"
export DEVWATCHER_INTERVAL=30
export NOT_MONITORED_COMPONENTS="ble,cloud,mqtt,sys,wifi,ws,status,ht_ui,input:*,longpush:*"
export NOT_MONITORED_COMPONENTS_LEGACY="input,input_event"
export SHELL_ALLOWED_COMMANDS="create_dashboardelement,create_timer,delete_device,delete_measurement"
export TOPIC_STATUS="+/status/+"
export TOPIC_CONNECTED="+/status/+/connected"
export TOPIC_ONLINE="+/online"
export TOPIC_TIMER="nanohome/+/timer"
export TOPIC_STANDBY="nanohome/+/standby"
export TOPIC_DASHBOARD="nanohome/config/dashboard"
export TOPIC_CMDINPUT="input_command"
export TOPIC_CMDOUTPUT="output_command"
export TOPIC_ONLINE_LEGACY="shellies/+/+/+"
export MQTT_FASTSUBSCRIBE="250"
export MQTT_NORMALSUBSCRIBE="500"
export MQTT_LONGSUBSCRIBE="1000"

########################
# InfluxDB       
########################

# Check if influx configuration exists, create it if not
influxconfig=$(influx config list --json | jq -r ."${INFLUXDB_CONFIG}")
if [[ "${influxconfig}" == "null" ]]; then 
	influx config create \
	  --config-name "${INFLUXDB_CONFIG}" \
	  --host-url "http://${INFLUXDB_SERVICE}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}" \
	  --active
fi

# Check if devices bucket exists, create if not
influx bucket list --name "${INFLUXDB_BUCKET_DEVICES}" >/dev/null 2>&1
if [ $? -ne 0 ]; then
	influx bucket create \
	  --name "${INFLUXDB_BUCKET_DEVICES}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}"
fi

# Check if measurement bucket exists, create if not
influx bucket list --name "${INFLUXDB_BUCKET_MEASUREMENTS}" >/dev/null 2>&1
if [ $? -ne 0 ]; then
	influx bucket create \
	  --name "${INFLUXDB_BUCKET_MEASUREMENTS}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}"
fi

# Check if influxdb service user exists
influxauthlist=$(influx auth list --json)
auth_objects=$(jq length <<< ${influxauthlist})
for ((i = 0; i < auth_objects; i++)); do
	influxuser=$(echo "${influxauthlist}" | jq -r .[$i].userName)
	if [[ "${influxuser}" -eq "${INFLUXDB_GRAFANAUSER}" ]]; then
		INFLUXDB_ROTOKEN = $(echo "${influxauthlist}" | jq -r .[$i].token)
	fi
done

# Create influxdb ro-token for grafana if it does not exist
if [ -z "${INFLUXDB_ROTOKEN}" ]; then 
	influxrotokenjson=$(influx auth create \
	  --description "nanohome grafana ro user" \
	  --org "${INFLUXDB_ORG}" \
	  --read-bucket "${INFLUXDB_BUCKET_DEVICES}" \
	  --read-bucket "${INFLUXDB_BUCKET_MEASUREMENTS}" \
	  --json)
	INFLUXDB_ROTOKEN=$(echo "${influxrotokenjson}" | jq -r '.token')
fi

########################
# Grafana       
########################

# If no access token specified inf env file, create it
if [ -z "${GRAFANA_SERVICEUSERTOKEN}" ]; then

	# Define service user json
	sananohome='{
	  "name": "'"${GRAFANA_SERVICEUSER}"'",
	  "role": "Admin",
	  "isDisabled": false
	}'

	# Check if service user exists
	grafanasajson=$(curl \
		-H "Accept: application/json" \
		-H "Content-Type: application/json" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/search?query=${GRAFANA_SERVICEUSER}" | jq)

	# Create service user if it does not exist
	sa_objects=$(echo "${grafanasajson}" | jq -r .totalCount)
	if [ "$sa_objects" -eq 0 ]; then
		grafanasajson=$(curl \
			-H "Accept: application/json" \
			-H "Content-Type: application/json" \
			-X POST -d "${sananohome}" "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts")
	fi

	# Get access tokens of service account
	said=$(echo "${grafanasajson}" | jq -r .serviceAccounts[].id)
	grafanasatokenjson=$(curl \
		-H "Accept: application/json" \
		-H "Content-Type: application/json" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${said}/tokens" | jq)

	# Delete access tokens
	token_objects=$(jq length <<< ${grafanasatokenjson})
	for ((i = 0; i < token_objects; i++)); do
		tokenid=$(echo "${grafanasatokenjson}" | jq -r .[$i].id)
		curl -i \
			-H "Content-Type: application/json" \
			-X DELETE "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${said}/tokens/${tokenid}"
	done

	# Create a new access token
	satokenjson=$(curl \
		-H "Accept: application/json" \
		-H "Content-Type: application/json" \
		-d "${sananohome}" \
		-X POST "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${said}/tokens")

	GRAFANA_SERVICEUSERTOKEN=$(echo "${satokenjson}" | jq -r .key)
fi

########################
# Mosquitto       
########################






# Start crond in the background
crond -f &

# Start nanohome services
/bin/bash /opt/nanohome/services/mqtt_shell -s &
/bin/bash /opt/nanohome/services/devwatcher_shelly_legacy &
# /bin/bash /opt/nanohome/services/devwatcher_shelly_plus &
/bin/bash /opt/nanohome/services/measurements_shelly_legacy &
# /bin/bash /opt/nanohome/services/measurements_shelly_plus &
#/bin/bash /opt/nanohome/services/standby_shelly_plus &

# Start bash
exec bash
