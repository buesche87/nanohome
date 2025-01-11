#!/bin/bash

########################
# NanoHome Environment         
########################

export ROOTPATH="/opt/nanohome"
export GRAFANA_HOME_UID="XieEaLmRk"
export GRAFANA_HOME_FILE="./grafana-content/dashboards/home.json"
export GRAFANA_DEVICES_UID="fe47pva0wy8lcb"
export GRAFANA_DEVICES_FILE="./grafana-content/dashboards/devices.json"
export GRAFANA_TIMER_UID="ae489b6q64nwgf"
export GRAFANA_TIMER_FILE="./grafana-content/dashboards/timer.json"
export GRAFANA_STANDBY_UID="adjak60hekvswd"
export GRAFANA_STANDBY_FILE="./grafana-content/dashboards/standby.json"
export GRAFANA_MEASUREMENTS_UID="ee8v5d70ojpj4b"
export GRAFANA_MEASUREMENTS_FILE="./grafana-content/dashboards/measurements.json"
export INFLUXDB_BUCKET_DEVICES="Devices" # Must begin with capital letter
export INFLUXDB_BUCKET_MEASUREMENTS="Measurements" # Must begin with capital letter
export INFLUXDB_TOKEN_DESCRIPTION="nanohome grafana ro-token"
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

# InfluxDB config
############################################################

# Check if influx configuration exists, create it if not
influxconfig=$(
	influx config list --json | \
	jq -e ."${INFLUXDB_CONFIG}"
)

if [ $? -eq 0 ]
then
	echo "Influx config \"${INFLUXDB_CONFIG}\" found" >> /proc/1/fd/1
else
	influxconfig=$( \
		influx config create \
		--config-name "${INFLUXDB_CONFIG}" \
		--host-url "http://${INFLUXDB_SERVICE}" \
		--org "${INFLUXDB_ORG}" \
		--token "${INFLUXDB_ADMINTOKEN}" \
		--active \
		--json | jq )
	
	echo "Influx config \"${INFLUXDB_CONFIG}\" created" >> /proc/1/fd/1
fi

echo "${influxconfig}" | jq '.token = "<SECURETOKEN>"' >> /proc/1/fd/1

# InfluxDB buckets - functions
############################################################

getinfluxbucket() {
	local bucket=$1

	influx bucket list --json | \
		jq -e --arg name "${bucket}" \
		'.[] | select(.name == $name)'
}

createinfluxbucket() {
	local bucket=$1 

	influx bucket create \
	  --name "${bucket}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}" \
	  --json | jq -e
	
	if [ $? -eq 0 ]
	then
		echo "InfluxDB bucket \"${bucket}\" created" >> /proc/1/fd/1
	else
		echo "Error creating InfluxDB bucket \"${bucket}\"" >> /proc/1/fd/1
		Exit 1
	fi
}

# InfluxDB buckets - devices
############################################################

# Check if devices bucket exists, create it if not
influxbucket_devices=$(
	getinfluxbucket "${INFLUXDB_BUCKET_DEVICES}"
)

if [ $? -eq 0 ]
then
	echo "InfluxDB bucket \"${INFLUXDB_BUCKET_DEVICES}\" found" >> /proc/1/fd/1
else
	echo "InfluxDB bucket \"${INFLUXDB_BUCKET_DEVICES}\" not found" >> /proc/1/fd/1

	influxbucket_devices=$( 
		createinfluxbucket "${INFLUXDB_BUCKET_DEVICES}" )
fi

echo "${influxbucket_devices}" | jq >> /proc/1/fd/1

# Get id of devices bucket for later use
influxbucket_devices_id=$(
	echo "${influxbucket_devicesjson}" | \
	jq -r '.id'
)

# InfluxDB buckets - measurements
############################################################

# Check if measurements bucket exists, create it if not
influxbucket_measurements=$(
	getinfluxbucket "${INFLUXDB_BUCKET_MEASUREMENTS}"
)

if [ $? -eq 0 ]
then
	echo "InfluxDB bucket \"${INFLUXDB_BUCKET_MEASUREMENTS}\" found" >> /proc/1/fd/1
else
	echo "InfluxDB bucket \"${INFLUXDB_BUCKET_MEASUREMENTS}\" not found" >> /proc/1/fd/1

	influxbucket_measurements=$(
		createinfluxbucket "${INFLUXDB_BUCKET_MEASUREMENTS}"
	)
fi

echo "${influxbucket_measurements}" | jq >> /proc/1/fd/1

# Get id of measurements bucket for later use
influxbucket_measurements_id=$(
	echo "${influxbucket_measurements}" | \
	jq -r '.id'
)

# InfluxDB auth - Functions   
############################################################

# TODO: Fehler hier

getinfluxauthtoken() {
	local description=$1

	influx auth list --json | \
	jq -e --arg description "${description}" \
	'[.[] | select(.description == $description)]'
}

deleteinfluxauthtoken() {
	local id=$1

	influx auth delete --id "${id}" --json | jq -e

	if [ $? -eq 0 ]
	then
		echo "Removed token with id \"${id}\"" >> /proc/1/fd/1
	else
		echo "Error removing token with id \"${id}\"" >> /proc/1/fd/1
	fi
}

createinfluxauthtoken() {
	local bktid1=$1
	local bktid2=$2

	influx auth create \
	--description "${INFLUXDB_TOKEN_DESCRIPTION}" \
	--org "${INFLUXDB_ORG}" \
	--read-bucket "${influxbucket_devices_id}" \
	--read-bucket "${influxbucket_measurements_id}" \
	--json | jq -e

	if [ $? -eq 0 ]
	then
		echo "${INFLUXDB_TOKEN_DESCRIPTION} created" >> /proc/1/fd/1
	else
		echo "Error creating ${INFLUXDB_TOKEN_DESCRIPTION}" >> /proc/1/fd/1
		Exit 1
	fi	
}

# InfluxDB auth - Token   
############################################################

influxauth_token=$(
	getinfluxauthtoken "${INFLUXDB_TOKEN_DESCRIPTION}"
)

influxauth_token_objects=$(
	jq length <<< "${influxauth_token}"
)

# If there are multiple tokens, delete them - we will recreate one later
if [ "$influxauth_token_objects" -gt 1 ]
then
	echo "Multiple ${INFLUXDB_TOKEN_DESCRIPTION} found" >> /proc/1/fd/1

	for (( i = 0; i < influxauth_token_objects; i++ ))
	do
		influxauth_token_id=$(
			echo "${influxauth_token}" | \
			jq -r .[$i].id
		)

		deleteinfluxauthtoken "${influxauth_token_id}"
	done

	influxauth_token_objects=0
fi

# If there is just one token, check if it has the right permissions
if [ "$influxauth_token_objects" -eq 1 ]
then
	influxauth_token_permissions=$(
		jq \
		--arg val1 "${influxbucket_devices_id}" \
		--arg val2 "${influxbucket_measurements_id}" \
		'[.[].permissions[]] | contains([$val1, $val2])' \
		<<< "${influxauth_token}"
	)

	# Delete it if not
	if ( ! $influxauth_token_permissions )
	then
		echo "${INFLUXDB_TOKEN_DESCRIPTION} found but with wrong permission, remove it" >> /proc/1/fd/1

		influxauth_token_id=$(
			echo "${influxauth_token}" | \
			jq -r .[].id
		)

		deleteinfluxauthtoken "${influxauth_token_id}"

		influxauth_token_objects=0
	fi
fi

# Create a new token if needed
if [ "$influxauth_token_objects" -eq 0 ]
then
	echo "No suitable token found, creating one" >> /proc/1/fd/1

	influxauth_token=$(
		createinfluxauthtoken "${influxbucket_devices_id}" "${influxbucket_measurements_id}"
	)
fi

# Extract token from auth json
export INFLUXDB_ROTOKEN=$(
	echo "${influxauth_token}" | \
	jq -r '.token'
)

# Grafana service account - Functions 
############################################################

setgrafanaserviceaccount() {
	local sa=$1

	echo \
	'{
	  "name": "'"${sa}"'",
	  "role": "Admin",
	  "isDisabled": false
	}'
}

getgrafanaserviceaccount() {
	local sa=$1

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/search?query=${sa}" | \
	jq -e
}

creategrafanaserviceaccount() {
	local sa=$1

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-d "${sa}" \
	-X POST "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts" | \
	jq -e

	if [ $? -eq 0 ]
	then
		echo "service account \"${GRAFANA_SERVICEUSER}\" created" >> /proc/1/fd/1
	else
		echo "Error creating service account \"${GRAFANA_SERVICEUSER}\"" >> /proc/1/fd/1
		Exit 1
	fi
}

getgrafanaserviceaccounttoken() {
	local id=$1

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${id}/tokens" | \
	jq -e
}

deletegrafanaserviceaccounttoken() {
	local uid=$1
	local tid=$2

	curl -s \
	-H "Content-Type: application/json" \
	-X DELETE "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${uid}/tokens/${tid}"
}

creategrafanaserviceaccounttoken() {
	local sa=$1
	local uid=$2

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-d "${sa}" \
	-X POST "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${uid}/tokens" | \
	jq -e

	if [ $? -eq 0 ]
	then
		echo "Token for \"${GRAFANA_SERVICEUSER}\" created" >> /proc/1/fd/1
	else
		echo "Error creating Token for \"${GRAFANA_SERVICEUSER}\"" >> /proc/1/fd/1
		Exit 1
	fi
}

# Grafana service account - Token   
############################################################

# If no access token specified in env file, create it
if [ -z "${GRAFANA_SERVICEACCOUNT_TOKEN}" ]
then
	echo "No grafana service account token provided" >> /proc/1/fd/1

	# Define service account json
	grafanaserviceaccount_json=$(
		setgrafanaserviceaccount "${GRAFANA_SERVICEUSER}"
	)

	# Check if service account exists
	grafanaserviceaccount=$(
		getgrafanaserviceaccount "${GRAFANA_SERVICEUSER}"
	)

	grafanaserviceaccount_objects=$(
		echo "${grafanaserviceaccount}" | \
		jq -r .totalCount
	)

	# Create service account if it does not exist
	if [ "$grafanaserviceaccount_objects" -eq 0 ]
	then
		echo "service account \"${GRAFANA_SERVICEUSER}\" not fund, create it" >> /proc/1/fd/1

		grafanaserviceaccount=$(
			creategrafanaserviceaccount "${grafanaserviceaccount_json}"
		)
	fi

	# Get id of service account for later use
	grafanaserviceaccount_id=$(
		echo "${grafanaserviceaccount}" | \
		jq -r .serviceAccounts.[].id
	)

	# Get token of service user
	grafanaserviceaccount_token=$(
		getgrafanaserviceaccounttoken "${grafanaserviceaccount_id}"
	)

	grafanaserviceaccount_token_objects=$(
		jq length <<< ${grafanaserviceaccount_token}
	)

	# Delete access tokens if there are any
	for (( i = 0; i < grafanaserviceaccount_token_objects; i++ ))
	do
		grafanaserviceaccount_token_id=$(
			echo "${grafanaserviceaccount_token}" | \
			jq -r .[$i].id
		)

		deletegrafanaserviceaccounttoken "${grafanaserviceaccount_id}" "${grafanaserviceaccount_token_id}"
	done

	# Create a new access token
	grafanaserviceaccount_token=$(
		creategrafanaserviceaccounttoken "${grafanaserviceaccount_json}" "${grafanaserviceaccount_id}"
	)

	# Extract token
	export GRAFANA_SERVICEACCOUNT_TOKEN=$( \
		echo "${grafanasatokenjson}" | \
		jq -r .key )
else
	echo "Grafana service account token provided" >> /proc/1/fd/1
fi

# Grafana datasources - functions
############################################################

datasourcejson() {
	local bucket=$1

	echo \
	'{
		"name":"Devices",
		"type":"influxdb",
		"typeName":"InfluxDB",
		"access":"proxy",
		"url":"http://'"${INFLUXDB_SERVICE}"'",
		"jsonData":{"dbName":"'"${bucket}"'","httpMode":"GET","httpHeaderName1":"Authorization"},
		"secureJsonData":{"httpHeaderValue1":"Token '"${INFLUXDB_ROTOKEN}"'"},
		"isDefault":true,
		"readOnly":false
	}' | jq
}

getdatasource() {
	local dsname=$1

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
	-X GET "http://${GRAFANA_SERVICE}/api/datasources" | \
	jq -e \
	--arg name "${dsname}" \
	--arg type "influxdb" \
	'.[] | select(.name == $name and .type == $type)'
}

createdatasource() {
	local dsjson=$1
	local dsname=$(
		echo "${$dsjson}" | \
		jq -r .name
	)

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type:application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
	-X POST -d "${dsjson}" "http://${GRAFANA_SERVICE}/api/datasources" | \
	jq -e
	
	if [ $? -eq 0 ]
	then
		echo "Datasource for influxdb bucket \"${dsname}\" created" >> /proc/1/fd/1
	else
		echo "Error creating datasource for influxdb bucket \"${dsname}\"" >> /proc/1/fd/1
	fi
}

# Grafana datasources - Devices
############################################################

# If datasource Devices does not exist, create it
datasourcedevices_json=$(
	datasourcejson "${INFLUXDB_BUCKET_DEVICES}"
)

datasourcedevices=$(
	getdatasource "${INFLUXDB_BUCKET_DEVICES}"
)

if [ ! $datasourcedevices ]
then
	echo "Datasource for influxdb bucket \"${INFLUXDB_BUCKET_DEVICES}\" not found" >> /proc/1/fd/1
	createdatasource "${datasourcedevices_json}"
else
	echo "Datasource for influxdb bucket \"${INFLUXDB_BUCKET_DEVICES}\" found" >> /proc/1/fd/1
fi

# Grafana datasources - Measurements
############################################################

# If datasource Measurements does not exist, create it
datasourcemeasurements_json=$(
	datasourcejson "${INFLUXDB_BUCKET_MEASUREMENTS}"
)

datasourcemeasurements=$(
	getdatasource "${INFLUXDB_BUCKET_MEASUREMENTS}"
)

if [ ! $datasourcemeasurements ]
then
	echo "Datasource for influxdb bucket \"${INFLUXDB_BUCKET_MEASUREMENTS}\" not found" >> /proc/1/fd/1
	createdatasource "${datasourcemeasurements_json}"
else
	echo "Datasource for influxdb bucket \"${INFLUXDB_BUCKET_MEASUREMENTS}\" found" >> /proc/1/fd/1
fi

# Grafana content
############################################################

# TODO: run once

# Set credentials in grafana content
# sed -i 's#var user = \\\"\\\"#var user = \\\"'${MQTT_USER}'\\\"#' ./grafana-content/js/mqttconfig.js
# sed -i 's#var pwd = \\\"\\\"#var pwd = \\\"'${MQTT_PASSWORD}'\\\"#' ./grafana-content/js/mqttconfig.js


# Grafana dashboards - functions
############################################################

getgrafanadashboard() {
	local uid=$1

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
	-X GET "http://${GRAFANA_SERVICE}/api/search?query=&dashboardUIDs=${uid}" | \
	jq -e
}

creategrafanadashboard() {
	local file=$1

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type:application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
	-X POST -d @"${file}" "http://${GRAFANA_SERVICE}/api/dashboards/db" | \
	jq -e

	if [ $? -eq 0 ]
	then
		echo "Dashboard \"${file}\" uploaded" >> /proc/1/fd/1
	else
		echo "Error uploading dashboard \"${file}\"" >> /proc/1/fd/1
	fi	
}

# Grafana dashboards - Home
############################################################

grafanadashboard_home=$(
	getgrafanadashboard "${GRAFANA_HOME_UID}"
)

grafanadashboard_home_objects=$(
	jq length <<< "${grafanadashboard_home}"
)

# Upload home dashboard if it does not exist
if [ "$grafanadashboard_home_objects" -eq 0 ]
then
	echo "Home dashboard not found" >> /proc/1/fd/1
	creategrafanadashboard "${GRAFANA_HOME_FILE}"
else
	echo "Home dashboard found" >> /proc/1/fd/1
fi


# Grafana dashboards - Devices
############################################################

grafanadashboard_devices=$(
	getgrafanadashboard "${GRAFANA_DEVICES_UID}"
)

grafanadashboard_devices_objects=$(
	jq length <<< "${grafanadashboard_devices}"
)

# Upload devices dashboard if it does not exist
if [ "$grafanadashboard_devices_objects" -eq 0 ]
then
	echo "Devices dashboard not found" >> /proc/1/fd/1
	creategrafanadashboard "${GRAFANA_DEVICES_FILE}"
else
	echo "Devices dashboard found" >> /proc/1/fd/1
fi

# Grafana dashboards - Timer
############################################################

grafanadashboard_timer=$(
	getgrafanadashboard "${GRAFANA_TIMER_UID}"
)

grafanadashboard_timer_objects=$(
	jq length <<< "${grafanadashboard_timer}"
)

# Upload timer dashboard if it does not exist
if [ "$grafanadashboard_timer_objects" -eq 0 ]
then
	echo "Timer dashboard not found" >> /proc/1/fd/1
	creategrafanadashboard "${GRAFANA_TIMER_FILE}"
else
	echo "Timer dashboard found" >> /proc/1/fd/1
fi

# Grafana dashboards - Standby
############################################################

grafanadashboard_standby=$(
	getgrafanadashboard "${GRAFANA_STANDBY_UID}"
)

grafanadashboard_standby_objects=$(
	jq length <<< "${grafanadashboard_standby}"
)

# Upload standby dashboard if it does not exist
if [ "$grafanadashboard_standby_objects" -eq 0 ]
then
	echo "Standby dashboard not found" >> /proc/1/fd/1
	creategrafanadashboard "${GRAFANA_STANDBY_FILE}"
else
	echo "Standby dashboard found" >> /proc/1/fd/1
fi

# Grafana dashboards - Measurements
############################################################

grafanadashboard_measurements=$(
	getgrafanadashboard "${GRAFANA_MEASUREMENTS_UID}"
)

grafanadashboard_measurements_objects=$(
	jq length <<< "${grafanadashboard_measurements}"
)

# Upload measurements dashboard if it does not exist
if [ "$grafanadashboard_measurements_objects" -eq 0 ]
then
	echo "Measurements dashboard not found" >> /proc/1/fd/1
	creategrafanadashboard "${GRAFANA_MEASUREMENTS_FILE}"
else
	echo "Measurements dashboard found" >> /proc/1/fd/1
fi


# Mosquitto - Functions
############################################################





# Nanohome services
############################################################

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
