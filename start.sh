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

# TODO: Check communication to influxdb
# TODO: Log


# InfluxDB config
############################################################

influxconfigjson=$( \
	influx config list --json | \
	jq -r ."${INFLUXDB_CONFIG}" )

influxconfigjsonobjects=$( \
	jq length \
	<<< "${influxconfigjson}" )

# Check if influx configuration exists
if [ "$influxconfigjsonobjects" -ne 1 ]
then # Create one it if not
	influxconfigjson=$( \
		influx config create \
	  --config-name "${INFLUXDB_CONFIG}" \
	  --host-url "http://${INFLUXDB_SERVICE}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}" \
	  --active | jq )
fi

# InfluxDB devices bucket
############################################################

influxbucketdevicesjson=$( \
	influx bucket list \
	--name "${INFLUXDB_BUCKET_DEVICES}" \
	--json | jq )

influxbucketdevicesobjects=$( \
	jq length \
	<<< "${influxbucketdevicesjson}" )

# Check if devices bucket exists
if [ "$influxbucketdevicesobjects" -ne 1 ]
then # Create one it if not
	influxbucketdevicesjson=$( \
		influx bucket create \
	  --name "${INFLUXDB_BUCKET_DEVICES}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}" \
	  --json | jq )
fi

# Get id of devices bucket
influxbucketdevicesid=$( \
	echo "${influxbucketdevicesjson}" | \
	jq -r '.[].id' )


# InfluxDB measurements bucket
############################################################

influxbucketmeasurementsjson=$( \
	influx bucket list \
  --name "${INFLUXDB_BUCKET_MEASUREMENTS}" \
  --json | jq )

influxbucketmeasurementsobjects=$( \
	jq length \
	<<< "${influxbucketdevicesjson}" )

# Check if measurements bucket exists
if [ "$influxbucketmeasurementsobjects" -ne 1 ]
then # Create one it if not
	influxbucketmeasurementsjson=$( \
		influx bucket create \
	  --name "${INFLUXDB_BUCKET_MEASUREMENTS}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}" \
	  --json | jq )
fi

# Get id of measurements bucket
influxbucketmeasurementsid=$( \
	echo "${influxbucketmeasurementsjson}" | \
	jq -r '.[].id' )


# InfluxDB RO-Token for Grafana      
############################################################

# Check if influxdb ro-token exists
influxauthtokendescription="nanohome grafana ro token"

influxauthlist=$( \
	influx auth list \
	--json | jq )

influxauthentry=$( \
	jq \
	--arg description "${influxauthtokendescription}" \
	'[.[] | select(.description == $description)]' \
	<<< "${influxauthlist}" )

influxauthobjects=$( \
	jq length \
	<<< "${influxauthentry}" )

# If there are multiple tokens, delete them - we will recreate one later
if [ "$influxauthobjects" -gt 1 ]
then
	for (( i = 0; i < influxauthobjects; i++ ))
	do
		tokenid=$( \
		echo "${influxauthentry}" | \
		jq -r .[$i].id )

		influx auth delete --id "${tokenid}"
	done
	influxauthobjects=0
fi

# If it's just one token, check if it has the right permissions
if [ "$influxauthobjects" -eq 1 ]
then
	tokenpermission=$( \
		jq \
		--arg val1 "${influxbucketdevicesid}" \
		--arg val2 "${influxbucketmeasurementsid}" \
		'[.permissions[]] | contains([$val1, $val2])' \
		<<< "${influxauthentry}" )

	# Delete it if not
	if ( ! $tokenpermission )
	then
		tokenid=$( \
			echo "${influxauthentry}" | \
			jq -r .id )

		influx auth delete --id "${tokenid}"
		influxauthobjects=0
	fi
fi

# Create a new token if needed
if [ "$influxauthobjects" -eq 0 ]
then
	influxrotokenjson=$( \
		influx auth create \
	  --description "${influxauthtokendescription}" \
	  --org "${INFLUXDB_ORG}" \
	  --read-bucket "${influxbucketdevicesid}" \
	  --read-bucket "${influxbucketmeasurementsid}" \
	  --json | jq )

	influxauthentry=$( \
		jq \
		--arg description "${influxauthtokendescription}" \
		'.[] | select(.description == $description)' \
		<<< "$influxauthlist" )
fi

# Extract token from auth json
INFLUXDB_ROTOKEN=$( \
	echo "${influxauthentry}" | \
	jq -r '.token' )

# Grafana service account and token   
############################################################

# If no access token specified in env file, create it
if [ -z "${GRAFANA_SERVICEUSERTOKEN}" ]
then
	# Define service user json
	grafanasauser='{
	  "name": "'"${GRAFANA_SERVICEUSER}"'",
	  "role": "Admin",
	  "isDisabled": false
	}'

	# Check if service user exists
	grafanasajson=$( \
		curl \
		-H "Accept: application/json" \
		-H "Content-Type: application/json" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/search?query=${GRAFANA_SERVICEUSER}" | \
		jq )

	grafanasaobjects=$( \
		echo "${grafanasajson}" | \
		jq -r .totalCount )

	# Create service user if it does not exist
	if [ "$grafanasaobjects" -eq 0 ]
	then
		grafanasajson=$( \
			curl \
			-H "Accept: application/json" \
			-H "Content-Type: application/json" \
			-d "${grafanasauser}" \
			-X POST "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts" | \
			jq )
	fi

	# Get id of service user
	said=$( \
		echo "${grafanasajson}" | \
		jq -r .id )

	# Get token of service user
	grafanasatokenjson=$( \
		curl \
		-H "Accept: application/json" \
		-H "Content-Type: application/json" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${said}/tokens" | \
		jq )

	grafanasatokenobjects=$( \
		jq length \
		<<< ${grafanasatokenjson} )

	# Delete access tokens if there are any
	for (( i = 0; i < grafanasatokenobjects; i++ ))
	do
		tokenid=$( \
		echo "${grafanasatokenjson}" | \
		jq -r .[$i].id )
		
		curl \
		-H "Content-Type: application/json" \
		-X DELETE "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${said}/tokens/${tokenid}"
	done

	# Create a new access token
	satokenjson=$( \
		curl \
		-H "Accept: application/json" \
		-H "Content-Type: application/json" \
		-d "${grafanasauser}" \
		-X POST "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${said}/tokens" | \
		jq )

	# Extract token
	GRAFANA_SERVICEUSERTOKEN=$( \
		echo "${satokenjson}" | \
		jq -r .key )
fi

# Grafana datasources
############################################################

# Devices datasource
datasourcedevices='{
	"name":"Devices",
	"type":"influxdb",
	"typeName":"InfluxDB",
	"access":"proxy",
	"url":"http://'"${INFLUXDB_SERVICE}"'",
	"jsonData":{"dbName":"'"${INFLUXDB_BUCKET_DEVICES}"'","httpMode":"GET","httpHeaderName1":"Authorization"},
	"secureJsonData":{"httpHeaderValue1":"Token '"${INFLUXDB_ROTOKEN}"'"},
	"isDefault":true,
	"readOnly":false
}'

# Measurements datasource
datasourcemeasurements='{
	"name":"Measurements",
	"type":"influxdb",
	"typeName":"InfluxDB",
	"access":"proxy",
	"url":"http://'"${INFLUXDB_SERVICE}"'",
	"jsonData":{"dbName":"'"${INFLUXDB_BUCKET_MEASUREMENTS}"'","httpMode":"GET","httpHeaderName1":"Authorization"},
	"secureJsonData":{"httpHeaderValue1":"Token '"${INFLUXDB_ROTOKEN}"'"},
	"isDefault":true,
	"readOnly":false
}'

# Get available datasources
datasourcesjson=$( \
	curl \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
	-X GET "http://${GRAFANA_SERVICE}/api/datasources" | \
	jq )

datasourceobjects=$( \
	jq length \
	<<< ${datasourcesjson} )

# Check if devices an mesurements datasources exist, if so get their ID
for (( i = 0; i < datasourceobjects; i++ ))
do
	dsname=$( \
		echo "${datasourcesjson}" | \
		jq -r .[$i].name )

	dstype=$( \
		echo "${datasourcesjson}" | \
		jq -r .[$i].type )

	# Check for devices datasource
	if [["${$dsname}" == "${INFLUXDB_BUCKET_DEVICES}"]] && [["${$dstype}" == "influxdb"]]
	then # Get its ID
		datasourcedevicesid=$( \
			echo "${datasourcesjson}" | \
			jq -r .[$i].id )
		
		datasourcedevicesuid=$( \
			echo "${datasourcesjson}" | \
			jq -r .[$i].uid )
	fi

	# Check for measurements datasource
	if [["${$dsname}" == "${INFLUXDB_BUCKET_MEASUREMENTS}"]] && [["${$dstype}" == "influxdb"]]
	then # Get its ID
		datasourcemeasurementsid=$( \
			echo "${datasourcesjson}" | \
			jq -r .[$i].id )
		
		datasourcemeasurementsuid=$( \
			echo "${datasourcesjson}" | \
			jq -r .[$i].uid )
	fi
done

# If devices datasource does not exist, create it
if ( ! $datasourcedevicesid )
then
	datasourcedevicesjson=$( \
		curl \
		-H "Accept: application/json" \
		-H "Content-Type:application/json" \
		-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
		-X POST -d "${datasourcedevices}" "http://${GRAFANA_SERVICE}/api/datasources" | \
		jq )
fi

# If measurements datasource does not exist, create it
if ( ! $datasourcemeasurementsid )
then
	datasourcemeasurementsjson=$( \
		curl \
		-H "Accept: application/json" \
		-H "Content-Type:application/json" \
		-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
		-X POST -d "${datasourcemeasurements}" "http://${GRAFANA_SERVICE}/api/datasources" | \
		jq )
fi

# Grafana content
############################################################

# Set credentials in grafana content
sed -i 's#var user = \\\"\\\"#var user = \\\"'${MQTT_USER}'\\\"#' ./grafana-content/js/mqttconfig.js
sed -i 's#var pwd = \\\"\\\"#var pwd = \\\"'${MQTT_PASSWORD}'\\\"#' ./grafana-content/js/mqttconfig.js


# Grafana dashboards
############################################################

grafanadashboardsjson=$( \
	curl \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
	-X GET "http://${GRAFANA_SERVICE}/api/dashboards" | \
	jq )


homedashboardjson=$( \
	curl \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
	-X GET "http://${GRAFANA_SERVICE}/api/dashboards" | \
	jq )

# Check if home dashboard exists, if not upload it
if ( ! $homedashboardjson )
then
	homedashboardjson=$( \
		curl \
		-H "Accept: application/json" \
		-H "Content-Type:application/json" \
		-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
		-X POST -d @./grafana-content/dashboards/home.json "http://${GRAFANA_SERVICE}/api/dashboards/db" | \
		jq )
fi

devicesdashboardjson=$( \
	curl \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
	-X GET "http://${GRAFANA_SERVICE}/api/dashboards" | \
	jq )

# Check if devices dashboard exists, if not upload it
if ( ! $devicesdashboardjson )
then
	devicesdashboardjson=$( \
		curl -i \
		-H "Accept: application/json" \
		-H "Content-Type:application/json" \
		-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
		-X POST -d @./grafana-content/dashboards/devices.json "http://${GRAFANA_SERVICE}/api/dashboards/db" | \
		jq )
fi

timerdashboardjson=$( \
	curl \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
	-X GET "http://${GRAFANA_SERVICE}/api/dashboards" | \
	jq )

# Check if timer dashboard exists, if not upload it
if ( ! $timerdashboardjson )
then
	timerdashboardjson=$( \
		curl -i \
		-H "Accept: application/json" \
		-H "Content-Type:application/json" \
		-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
		-X POST -d @./grafana-content/dashboards/timer.json "http://${GRAFANA_SERVICE}/api/dashboards/db" | \
		jq )
fi

standbydashboardjson=$( \
	curl \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
	-X GET "http://${GRAFANA_SERVICE}/api/dashboards" | \
	jq )

# Check if standby dashboard exists, if not upload it
if ( ! $standbydashboardjson )
then
	standbydashboardjson=$( \
		curl -i \
		-H "Accept: application/json" \
		-H "Content-Type:application/json" \
		-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
		-X POST -d @./grafana-content/dashboards/standby.json "http://${GRAFANA_SERVICE}/api/dashboards/db" | \
		jq )
fi

measurementsdashboardjson=$( \
	curl \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
	-X GET "http://${GRAFANA_SERVICE}/api/dashboards" | \
	jq )

# Check if standby dashboard exists, if not upload it
if ( ! $measurementsdashboardjson )
then
	measurementsdashboardjson=$( \
		curl -i \
		-H "Accept: application/json" \
		-H "Content-Type:application/json" \
		-H "Authorization: Bearer ${GRAFANA_SERVICEUSERTOKEN}" \
		-X POST -d @./grafana-content/dashboards/measurements.json "http://${GRAFANA_SERVICE}/api/dashboards/db" | \
		jq )
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
