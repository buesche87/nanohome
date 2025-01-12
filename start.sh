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

LOG_GREEN="\033[1;32m"
LOG_YELLOW="\033[0;93m"
LOG_RED="\033[1;31m"
LOG_NC="\033[0m"

LOG_SUCCESS="[${LOG_GREEN}Success${LOG_NC}]"
LOG_WARNING="[${LOG_YELLOW}Warning${LOG_NC}]"
LOG_ERROR="[${LOG_RED}Error${LOG_NC}]"

# InfluxDB config
############################################################

checkinfluxonfig() {
	local result=$(
		influx config list --json | \
		jq -e ."${INFLUXDB_CONFIG}"
	)

	if [ "${result}" != "null" ]
	then
		echo -e "${LOG_SUCCESS} Influx CLI: Config found \"${INFLUXDB_CONFIG}\"" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_WARNING} Influx CLI: Config not found \"${INFLUXDB_CONFIG}\"" >> /proc/1/fd/1
		return 1
	fi
}

# TODO: result after message

createinfluxconfig() {
	influx config create \
	--config-name "${INFLUXDB_CONFIG}" \
	--host-url "http://${INFLUXDB_SERVICE}" \
	--org "${INFLUXDB_ORG}" \
	--token "${INFLUXDB_ADMINTOKEN}" \
	--active \
	--json | \
	jq -e '.token = "<SECURETOKEN>"' >> /proc/1/fd/1

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} InfluxDB: Config created \"${INFLUXDB_CONFIG}\"" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_ERROR} InfluxDB: Failed to create config \"${INFLUXDB_CONFIG}\"" >> /proc/1/fd/1
		exit 1
	fi
}

# Check if influx configuration exists, create it if not
checkinfluxonfig || createinfluxconfig

# InfluxDB buckets - functions
############################################################

getinfluxbucket() {
	local bucket=$1

	influx bucket list \
	--json | \
	jq -e --arg name "${bucket}" \
	'.[] | select(.name == $name)'

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} InfluxDB buckets: Bucket \"${bucket}\" found" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_WARNING} InfluxDB bucket: Bucket \"${bucket}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

createinfluxbucket() {
	local bucket=$1 

	influx bucket create \
	--name "${bucket}" \
	--org "${INFLUXDB_ORG}" \
	--token "${INFLUXDB_ADMINTOKEN}" \
	--json | \
	jq -e

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} InfluxDB buckets: Created bucket \"${bucket}\"" >> /proc/1/fd/1
		echo "${result}" | jq
		return 0
	else
		echo -e "${LOG_ERROR} InfluxDB buckets: Failed to create bucket \"${bucket}\"" >> /proc/1/fd/1
		# exit 1
	fi
}

# InfluxDB buckets - devices
############################################################

# Check if devices bucket exists, create it if not
influxbucket_devices=$(
	getinfluxbucket "${INFLUXDB_BUCKET_DEVICES}" || \
	createinfluxbucket "${INFLUXDB_BUCKET_DEVICES}"
)

echo "${influxbucket_devices}" | jq >> /proc/1/fd/1

# Get id of devices bucket for later use
export INFLUXBUCKET_DEVICES_ID=$(
	echo "${influxbucket_devices}" | \
	jq -r '.id'
)

# InfluxDB buckets - measurements
############################################################

# Check if measurements bucket exists, create it if not
influxbucket_measurements=$(
	getinfluxbucket "${INFLUXDB_BUCKET_MEASUREMENTS}" || \
	createinfluxbucket "${INFLUXDB_BUCKET_MEASUREMENTS}"
)

echo "${influxbucket_measurements}" | jq >> /proc/1/fd/1

# Get id of measurements bucket for later use
export INFLUXBUCKET_MEASUREMENTS_ID=$(
	echo "${influxbucket_measurements}" | \
	jq -r '.id'
)

# InfluxDB auth - Functions   
############################################################

getinfluxauthtoken() {
	local description=$1

	influx auth list --json | \
	jq -e --arg description "${description}" \
	'[.[] | select(.description == $description)]'

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} InfluxDB auth: Search token \"${description}\" successfull" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} InfluxDB auth: Search token \"${description}\" failed" >> /proc/1/fd/1
		exit 1
	fi
}

checkinfluxauthtokenpermissions() {
	local token=$1
	local description=$(
		echo "${1}" | \
		jq -r .[].description
	)

	jq -e \
	--arg val1 "${INFLUXBUCKET_DEVICES_ID}" \
	--arg val2 "${INFLUXBUCKET_MEASUREMENTS_ID}" \
	'[.[].permissions[]] | contains([$val1, $val2])' \
	<<< "${token}"

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} InfluxDB auth: Got permissions of token \"${description}\"" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} InfluxDB auth: Failed to get permissions of token \"${description}\"" >> /proc/1/fd/1
		exit 1
	fi
}

deleteinfluxauthtoken() {
	local id=$1

	influx auth delete --id "${id}" --json | \
	jq -e

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} InfluxDB auth: Removed token \"${id}\"" >> /proc/1/fd/1
	else
		echo -e "${LOG_WARNING} InfluxDB auth: Failed to remove \"${id}\"" >> /proc/1/fd/1
	fi
}

createinfluxauthtoken() {
	influx auth create \
	--description "${INFLUXDB_TOKEN_DESCRIPTION}" \
	--org "${INFLUXDB_ORG}" \
	--read-bucket "${INFLUXBUCKET_DEVICES_ID}" \
	--read-bucket "${INFLUXBUCKET_MEASUREMENTS_ID}" \
	--json | jq -e

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} InfluxDB auth: Created token \"${INFLUXDB_TOKEN_DESCRIPTION}\"" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} InfluxDB auth: Failed to create token \"${INFLUXDB_TOKEN_DESCRIPTION}\"" >> /proc/1/fd/1
		exit 1
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
	echo -e "InfluxDB auth:${LOG_YELLOW} Found multiple tokens \"${INFLUXDB_TOKEN_DESCRIPTION}\" ${LOG_NC}" >> /proc/1/fd/1

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
	# Delete it if not
	if ( ! checkinfluxauthtokenpermissions "${influxauth_token}" )
	then
		echo -e "${LOG_WARNING} InfluxDB auth: Found token \"${INFLUXDB_TOKEN_DESCRIPTION}\" with missing permissions" >> /proc/1/fd/1

		influxauth_token_id=$(
			echo "${influxauth_token}" | \
			jq -r .id
		)

		deleteinfluxauthtoken "${influxauth_token_id}"
		influxauth_token_objects=0
	else
		echo -e "${LOG_SUCCESS} InfluxDB auth: Found token \"${INFLUXDB_TOKEN_DESCRIPTION}\" with correct permissions" >> /proc/1/fd/1

		# Extract token from auth json
		export INFLUXDB_ROTOKEN=$(
			echo "${influxauth_token}" | \
			jq -r '.[].token'
		)

		echo "${influxauth_token}" | jq '.[].token = "<SECURETOKEN>"' >> /proc/1/fd/1
	fi
fi

# Create a new token if needed
if [ "$influxauth_token_objects" -eq 0 ]
then
	echo -e "${LOG_WARNING} InfluxDB auth: No suitable token found" >> /proc/1/fd/1

	influxauth_token=$(
		createinfluxauthtoken "${INFLUXBUCKET_DEVICES_ID}" "${INFLUXBUCKET_MEASUREMENTS_ID}"
	)

	# Extract token from auth json
	export INFLUXDB_ROTOKEN=$(
		echo "${influxauth_token}" | \
		jq -r '.token'
	)

	echo "${influxauth_token}" | jq '.token = "<SECURETOKEN>"' >> /proc/1/fd/1
fi


# Grafana service account - Functions 
############################################################

setgrafanaserviceaccount() {
	echo \
	'{
	  "name": "'"${GRAFANA_SERVICEACCOUNT}"'",
	  "role": "Admin",
	  "isDisabled": false
	}' | \
	jq -e
}

getgrafanaserviceaccount() {
	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/search?query=${GRAFANA_SERVICEACCOUNT}" | \
	jq -e

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} Grafana service account: Account \"${GRAFANA_SERVICEACCOUNT}\" found" >> /proc/1/fd/1
	else
		echo -e "${LOG_WARNING} Grafana service account: Account \"${GRAFANA_SERVICEACCOUNT}\" not found" >> /proc/1/fd/1
	fi
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
		echo -e "${LOG_SUCCESS} Grafana service account: Account \"${GRAFANA_SERVICEACCOUNT}\" created" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} Grafana service account: Failed to create account \"${GRAFANA_SERVICEACCOUNT}\"" >> /proc/1/fd/1
		exit 1
	fi
}

getgrafanaserviceaccounttoken() {
	local id=$1

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${id}/tokens" | \
	jq -e

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} Grafana service account: Found token for account id \"${id}\"" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} Grafana service account: Failed to get token for account id \"${id}\"" >> /proc/1/fd/1
		exit 1
	fi
}

deletegrafanaserviceaccounttoken() {
	local uid=$1
	local tid=$2

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-X DELETE "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${uid}/tokens/${tid}" | \
	jq -e

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} Grafana service account: Deleted token \"${tid}\" for account \"${uid}\"" >> /proc/1/fd/1
	else
		echo -e "${LOG_WARNING} Grafana service account: Failed to delete token \"${tid}\" for account \"${uid}\"" >> /proc/1/fd/1
	fi
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
		echo -e "${LOG_SUCCESS} Grafana service account: Token for \"${GRAFANA_SERVICEACCOUNT}\" created" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} Grafana service account: Error creating token for \"${GRAFANA_SERVICEACCOUNT}\"" >> /proc/1/fd/1
		exit 1
	fi
}

# Grafana service account - Token   
############################################################

# If no access token specified in env file, create it
if [ -z "${GRAFANA_SERVICEACCOUNT_TOKEN}" ]
then
	echo -e "${LOG_WARNING} Grafana service account: No token provided" >> /proc/1/fd/1

	# Define service account json
	grafanaserviceaccount_json=$(
		setgrafanaserviceaccount
	)

	# Check if service account exists
	grafanaserviceaccount=$(
		getgrafanaserviceaccount
	)

	grafanaserviceaccount_objects=$(
		echo "${grafanaserviceaccount}" | \
		jq -r .totalCount
	)

	# Create service account if it does not exist
	if [ "$grafanaserviceaccount_objects" -eq 0 ]
	then
		echo -e "${LOG_WARNING} Grafana service account: Account not found \"${GRAFANA_SERVICEACCOUNT}\"" >> /proc/1/fd/1

		grafanaserviceaccount=$(
			creategrafanaserviceaccount "${grafanaserviceaccount_json}"
		)

		grafanaserviceaccount_id=$(
			echo "${grafanaserviceaccount}" | \
			jq -r .id
		)
	else
		echo -e "${LOG_SUCCESS} Grafana service account: Account found \"${GRAFANA_SERVICEACCOUNT}\"" >> /proc/1/fd/1

		grafanaserviceaccount_id=$(
			echo "${grafanaserviceaccount}" | \
			jq -r .serviceAccounts.[].id
		)
	fi

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

	echo "${grafanaserviceaccount_token}" | jq '.key = "<SECUREKEY>"' >> /proc/1/fd/1

	# Extract token
	export GRAFANA_SERVICEACCOUNT_TOKEN=$(
		echo "${grafanaserviceaccount_token}" | \
		jq -r .key
	)
else
	echo -e "${LOG_SUCCESS} Grafana service account: Token provided" >> /proc/1/fd/1
fi

# Grafana datasources - functions
############################################################

datasourcejson() {
	local bucket=$1

	echo \
	'{
		"name":"'"${bucket}"'",
		"type":"influxdb",
		"typeName":"InfluxDB",
		"access":"proxy",
		"url":"http://'"${INFLUXDB_SERVICE}"'",
		"jsonData":{"dbName":"'"${bucket}"'","httpMode":"GET","httpHeaderName1":"Authorization"},
		"secureJsonData":{"httpHeaderValue1":"Token '"${INFLUXDB_ROTOKEN}"'"},
		"isDefault":true,
		"readOnly":false
	}' | \
	jq -e
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

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} Grafana datasources: Datasource \"${dsname}\" found" >> /proc/1/fd/1
	else
		echo -e "${LOG_WARNING} Grafana datasources: Datasource \"${dsname}\" not found" >> /proc/1/fd/1
	fi	
}

createdatasource() {
	local dsjson=$1
	local dsname=$(
		echo "${1}" | \
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
		echo -e "${LOG_SUCCESS} Grafana datasources: Datasource \"${dsname}\" created" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} Grafana datasources: Error creating datasource \"${dsname}\"" >> /proc/1/fd/1
		exit 1
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

[ $datasourcedevices ] || createdatasource "${datasourcedevices_json}"

# Grafana datasources - Measurements
############################################################

# If datasource Measurements does not exist, create it
datasourcemeasurements_json=$(
	datasourcejson "${INFLUXDB_BUCKET_MEASUREMENTS}"
)

datasourcemeasurements=$(
	getdatasource "${INFLUXDB_BUCKET_MEASUREMENTS}"
)

[ $datasourcemeasurements ] || createdatasource "${datasourcemeasurements_json}"


# Grafana content
############################################################

# TODO: run once
# TODO: Test ab hier

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
