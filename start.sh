#!/bin/bash
# write
# some
# things
# here



# NanoHome Environment         
############################################################

export ROOTPATH="/opt/nanohome"
export GRAFANA_FOLDER_NAME="nanohome"
export GRAFANA_HOME_UID="XieEaLmRk"
export GRAFANA_HOME_FILE="./templates/home.json"
export GRAFANA_DEVICES_UID="fe47pva0wy8lcb"
export GRAFANA_DEVICES_FILE="./templates/devices.json"
export GRAFANA_TIMER_UID="ae489b6q64nwgf"
export GRAFANA_TIMER_FILE="./templates/timer.json"
export GRAFANA_STANDBY_UID="adjak60hekvswd"
export GRAFANA_STANDBY_FILE="./templates/standby.json"
export GRAFANA_MEASUREMENTS_UID="ee8v5d70ojpj4b"
export GRAFANA_MEASUREMENTS_FILE="./templates/measurements.json"
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

# Script logging      
############################################################

LOG_LEVEL="debug"
LOG_GREEN="\033[1;32m"
LOG_YELLOW="\033[0;93m"
LOG_RED="\033[1;31m"
LOG_BLUE="\033[1;34m"
LOG_NC="\033[0m"

LOG_SUCCESS="[${LOG_GREEN}Success${LOG_NC}]"
LOG_INFORMATION="[${LOG_BLUE}Success${LOG_NC}]"
LOG_WARNING="[${LOG_YELLOW}Warning${LOG_NC}]"
LOG_ERROR="[${LOG_RED}Error${LOG_NC}]"

# InfluxDB: Config
############################################################

checkinfluxconfig() {
	local result=$(
		influx config list --json | \
		jq -e ."${INFLUXDB_CONFIG}"
	)

	if [ "${result}" != "null" ]
	then
		echo -e "${LOG_SUCCESS} Influx CLI: Config \"${INFLUXDB_CONFIG}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_INFORMATION} Influx CLI: Config \"${INFLUXDB_CONFIG}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

createinfluxconfig() {
	local result=$(
		influx config create \
		--config-name "${INFLUXDB_CONFIG}" \
		--host-url "http://${INFLUXDB_SERVICE}" \
		--org "${INFLUXDB_ORG}" \
		--token "${INFLUXDB_ADMINTOKEN}" \
		--active \
		--json | \
		jq -e
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCCESS} Influx CLI: Config \"${INFLUXDB_CONFIG}\" created" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERROR} Influx CLI: Config \"${INFLUXDB_CONFIG}\" failed to create" >> /proc/1/fd/1
		exit 1
	fi
}

# Check if influx configuration exists, create it if not
influxconfig=$(
	checkinfluxconfig || createinfluxconfig
)

# Log
jq '.token = "<SECURETOKEN>"' <<< "${influxconfig}" >> /proc/1/fd/1

# InfluxDB buckets - functions
############################################################

getinfluxbucket() {
	local bucket=$1

	local result=$(
		influx bucket list \
		--json | \
		jq -e --arg name "${bucket}" \
		'.[] | select(.name == $name)'
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCCESS} InfluxDB: Bucket \"${bucket}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_WARNING} InfluxDB: Bucket \"${bucket}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

createinfluxbucket() {
	local bucket=$1

	local result=$(
		influx bucket create \
		--name "${bucket}" \
		--org "${INFLUXDB_ORG}" \
		--token "${INFLUXDB_ADMINTOKEN}" \
		--json | \
		jq -e
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCCESS} InfluxDB: Bucket \"${bucket}\" created" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERROR} InfluxDB: Bucket \"${bucket}\" failed to create" >> /proc/1/fd/1
		exit 1
	fi
}

# InfluxDB buckets - devices
############################################################

# Check if devices bucket exists, create it if not
influxbucket_devices=$(
	getinfluxbucket "${INFLUXDB_BUCKET_DEVICES}" || \
	createinfluxbucket "${INFLUXDB_BUCKET_DEVICES}"
)

# Log
jq '. | {id, name, createdAt}' <<< "${influxbucket_devices}" >> /proc/1/fd/1

# Get id of devices bucket for later use
export INFLUXBUCKET_DEVICES_ID=$(
	jq -r '.id' <<< "${influxbucket_devices}"
)

# InfluxDB buckets - measurements
############################################################

# Check if measurements bucket exists, create it if not
influxbucket_measurements=$(
	getinfluxbucket "${INFLUXDB_BUCKET_MEASUREMENTS}" || \
	createinfluxbucket "${INFLUXDB_BUCKET_MEASUREMENTS}"
)

# Log
jq '. | {id, name, createdAt}' <<< "${influxbucket_measurements}" >> /proc/1/fd/1

# Get id of measurements bucket for later use
export INFLUXBUCKET_MEASUREMENTS_ID=$(
	jq -r '.id' <<< "${influxbucket_measurements}"
)

# InfluxDB auth - Functions   
############################################################

getinfluxauthtoken() {
	local description=$1

	local result=$(
		influx auth list \
		--json | \
		jq -e --arg description "${description}" \
		'[.[] | select(.description == $description)]'
	)

	local resultlength=$(
		jq length <<< "${result}"
	)

	if [ "$resultlength" -gt 0 ]
	then
		# echo -e "${LOG_SUCCESS} InfluxDB auth: Token \"${description}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		# echo -e "${LOG_WARNING} InfluxDB auth: Token \"${description}\" not found" >> /proc/1/fd/1
		echo "[]"
	fi
}

checkinfluxauthtokenpermissions() {
	local token=$1

	local result=$(
		jq -e \
		--arg val1 "${INFLUXBUCKET_DEVICES_ID}" \
		--arg val2 "${INFLUXBUCKET_MEASUREMENTS_ID}" \
		'[.[].permissions[]] | contains([$val1, $val2])' \
		<<< "${token}"
	)

	if ( $result )
	then
		echo -e "${LOG_SUCCESS} InfluxDB: Auth token \"${INFLUXDB_TOKEN_DESCRIPTION}\" found with correct permissions" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_WARNING} InfluxDB: Auth token \"${INFLUXDB_TOKEN_DESCRIPTION}\" found with missing permissions" >> /proc/1/fd/1
		return 1
	fi
}

deleteinfluxauthtoken() {
	local id=$1

	local result=$(
		influx auth delete --id "${id}" --json | \
		jq -e
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCCESS} InfluxDB: Auth token removed" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_WARNING} InfluxDB: Auth token failed to remove" >> /proc/1/fd/1
		return 1
	fi
}

createinfluxauthtoken() {
	local result=$(
		influx auth create \
		--description "${INFLUXDB_TOKEN_DESCRIPTION}" \
		--org "${INFLUXDB_ORG}" \
		--read-bucket "${INFLUXBUCKET_DEVICES_ID}" \
		--read-bucket "${INFLUXBUCKET_MEASUREMENTS_ID}" \
		--json | \
		jq -e
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCCESS} InfluxDB: Auth token \"${INFLUXDB_TOKEN_DESCRIPTION}\" created" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERROR} InfluxDB: Auth token \"${INFLUXDB_TOKEN_DESCRIPTION}\" failed to create" >> /proc/1/fd/1
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
	echo -e "${LOG_WARNING} InfluxDB: Multiple auth token \"${INFLUXDB_TOKEN_DESCRIPTION}\" found" >> /proc/1/fd/1

	for (( i = 0; i < influxauth_token_objects; i++ ))
	do
		influxauth_token_id=$(
			echo "${influxauth_token}" | \
			jq -r .[$i].id
		)

		influxauth_deletedtoken=$(
			deleteinfluxauthtoken "${influxauth_token_id}"
		)

		jq '. | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${influxauth_deletedtoken}" >> /proc/1/fd/1

	done
	influxauth_token_objects=0
fi

# If there is just one token, check if it has the right permissions, delete it if not
if [ "$influxauth_token_objects" -eq 1 ]
then
	if ( checkinfluxauthtokenpermissions "${influxauth_token}" )
	then
		export INFLUXDB_ROTOKEN=$(
			jq -r '.[].token' <<< "${influxauth_token}"
		)

		jq '.[] | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${influxauth_token}" >> /proc/1/fd/1
	else
		influxauth_token_id=$(
			jq -r '.[].id' <<< "${influxauth_token}"
		)

		influxauth_deletedtoken=$(
			deleteinfluxauthtoken "${influxauth_token_id}"
		)

		jq '. | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${influxauth_deletedtoken}" >> /proc/1/fd/1

		influxauth_token_objects=0
	fi
fi

# Create a new token if needed
if [ "$influxauth_token_objects" -eq 0 ]
then
	echo -e "${LOG_WARNING} InfluxDB: No suitable auth token found" >> /proc/1/fd/1

	influxauth_token=$(
		createinfluxauthtoken "${INFLUXBUCKET_DEVICES_ID}" "${INFLUXBUCKET_MEASUREMENTS_ID}"
	)

	# Extract token from auth json
	export INFLUXDB_ROTOKEN=$(
		echo "${influxauth_token}" | \
		jq -r '.token'
	)

	jq '. | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${influxauth_token}" >> /proc/1/fd/1
fi

############################################################
# Grafana
############################################################

grafanaapiheader=$(
	echo -e '-H "Accept: application/json" \'
	echo -e '-H "Content-Type:application/json" \'
	echo -e '-H "Authorization: Bearer '"${GRAFANA_SERVICEACCOUNT_TOKEN}"
)

echo "${grafanaapiheader}"

# Grafana service account - Account 
############################################################

setgrafanaserviceaccount() {
	local result='{
	  "name": "'"${GRAFANA_SERVICEACCOUNT}"'",
	  "role": "Admin",
	  "isDisabled": false
	}'

	jq <<< "${result}"
}

getgrafanaserviceaccount() {
	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/search?query=${GRAFANA_SERVICEACCOUNT}" | \
	jq -e

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" found" >> /proc/1/fd/1
	else
		echo -e "${LOG_WARNING} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" not found" >> /proc/1/fd/1
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
		echo -e "${LOG_SUCCESS} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" created" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" failed to create" >> /proc/1/fd/1
		exit 1
	fi
}

# Grafana service account - Token 
############################################################

getgrafanaserviceaccounttoken() {
	local id=$1

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type: application/json" \
	-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${id}/tokens" | \
	jq -e

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} Grafana: Service account token found" >> /proc/1/fd/1
	else
		echo -e "${LOG_WARNING} Grafana: Service account token not found" >> /proc/1/fd/1
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
		echo -e "${LOG_SUCCESS} Grafana: Old service account token deleted" >> /proc/1/fd/1
	else
		echo -e "${LOG_WARNING} Grafana: Old service account token failed to delete" >> /proc/1/fd/1
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
		echo -e "${LOG_SUCCESS} Grafana: New service account token created" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} Grafana: Error creating new service account token" >> /proc/1/fd/1
		exit 1
	fi
}

# Grafana service account   
############################################################

# If no access token specified in env file, create it
if [ -z "${GRAFANA_SERVICEACCOUNT_TOKEN}" ]
then
	echo -e "${LOG_WARNING} Grafana: No service account token provided in env-file" >> /proc/1/fd/1

	# Define service account json
	grafanaserviceaccount_json=$(
		setgrafanaserviceaccount
	)

	# Check if service account exists
	grafanaserviceaccount=$(
		getgrafanaserviceaccount
	)

	# Log
	jq '.serviceAccounts[] | {id, name, login, role, isDisabled}' <<< "${grafanaserviceaccount}" >> /proc/1/fd/1

	grafanaserviceaccount_objects=$(
		jq '.totalCount' <<< "${grafanaserviceaccount}"
	)

	# Create service account if it does not exist
	if [ "$grafanaserviceaccount_objects" -eq 0 ]
	then
		grafanaserviceaccount=$(
			creategrafanaserviceaccount "${grafanaserviceaccount_json}"
		)

		grafanaserviceaccount_id=$(
			echo "${grafanaserviceaccount}" | \
			jq -r .id
		)
	else
		grafanaserviceaccount_id=$(
			echo "${grafanaserviceaccount}" | \
			jq -r .serviceAccounts.[].id
		)
	fi

	# Get token of service user
	grafanaserviceaccount_token=$(
		getgrafanaserviceaccounttoken "${grafanaserviceaccount_id}"
	)

	# Log
	jq '.[] | {id, name, created}' <<< "${grafanaserviceaccount_token}" >> /proc/1/fd/1	

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

		grafanaserviceaccount_token_deleted=$(
			deletegrafanaserviceaccounttoken "${grafanaserviceaccount_id}" "${grafanaserviceaccount_token_id}"
		)

		# Log
		jq '.[] | {id, name, created}' <<< "${grafanaserviceaccount_token}" >> /proc/1/fd/1	
	done

	# Create a new access token
	grafanaserviceaccount_token=$(
		creategrafanaserviceaccounttoken "${grafanaserviceaccount_json}" "${grafanaserviceaccount_id}"
	)

	# Log
	jq '.key = "<SECUREKEY>"' <<< "${grafanaserviceaccount_token}" >> /proc/1/fd/1

	# Extract token
	export GRAFANA_SERVICEACCOUNT_TOKEN=$(
		jq -r .key <<< "${grafanaserviceaccount_token}"
	)
else
	echo -e "${LOG_SUCCESS} Grafana: Service account token provided" >> /proc/1/fd/1
fi

# Grafana datasources - functions
############################################################

setgrafanadatasourcejson() {
	local bucket=$1

	local result=\
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
	}'
	
	jq <<< "${result}"
}

getgrafanadatasource() {
	local dsname=$1

	local result=$(
		curl -s \
		-H "Accept: application/json" \
		-H "Content-Type: application/json" \
		-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
		-X GET "http://${GRAFANA_SERVICE}/api/datasources"
	)

	# TODO: Omit "true/false"

	if ( $(jq -e 'type == "array"' <<< "${result}") )
	then
		local datasource=$(
			jq -e \
			--arg name "${dsname}" \
			--arg type "influxdb" \
			'.[] | select(.name == $name and .type == $type)' \
			<<< "${result}"
		)

		if [ "${datasource}" != "" ]
		then
			echo -e "${LOG_SUCCESS} Grafana: Datasource \"${dsname}\" found" >> /proc/1/fd/1
			jq <<< "${datasource}"
		else
			echo -e "${LOG_WARNING} Grafana: Datasource \"${dsname}\" not found" >> /proc/1/fd/1
			return 1
		fi
	else
		echo -e "${LOG_ERROR} Grafana: Could not connect to Grafana" >> /proc/1/fd/1
		jq <<< "${result}"
		exit 1
	fi
}

creategrafanadatasource() {
	local dsjson=$1
	local dsname=$(
		jq -r .name <<< "${1}"
	)

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type:application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
	-X POST -d "${dsjson}" "http://${GRAFANA_SERVICE}/api/datasources" | \
	jq -e
	
	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} Grafana: Datasource \"${dsname}\" created" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} Grafana: Error creating datasource \"${dsname}\"" >> /proc/1/fd/1
		exit 1
	fi
}

# Grafana datasources - Devices
############################################################

# If datasource Devices does not exist, create it
grafanadatasource_devices_json=$(
	setgrafanadatasourcejson "${INFLUXDB_BUCKET_DEVICES}"
)

grafanadatasource_devices=$(
	getgrafanadatasource "${INFLUXDB_BUCKET_DEVICES}" || \
	creategrafanadatasource "${grafanadatasource_devices_json}"
)

# Log
jq '. | {uid, name, type, url}' <<< "${grafanadatasource_devices}" >> /proc/1/fd/1

# Grafana datasources - Measurements
############################################################

# If datasource Measurements does not exist, create it
grafanadatasource_measurements_json=$(
	setgrafanadatasourcejson "${INFLUXDB_BUCKET_MEASUREMENTS}"
)

grafanadatasource_measurements=$(
	getgrafanadatasource "${INFLUXDB_BUCKET_MEASUREMENTS}" || \
	creategrafanadatasource "${grafanadatasource_measurements_json}"
)

# TODO: Maybe - jq > unterscheiden create / found 

# Log
jq '. | {uid, name, type, url}' <<< "${grafanadatasource_measurements}" >> /proc/1/fd/1

# Grafana content
############################################################

# TODO: AB HIER
# TODO: Copy content to persistent storage / if dest exist > do nothing
# TODO: run once


# Set credentials in grafana content
# sed -i 's#var user = \\\"\\\"#var user = \\\"'${MQTT_USER}'\\\"#' ./grafana-content/js/mqttconfig.js
# sed -i 's#var pwd = \\\"\\\"#var pwd = \\\"'${MQTT_PASSWORD}'\\\"#' ./grafana-content/js/mqttconfig.js


# Grafana dashboards - folder
############################################################

getgrafanafolder() {

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type:application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
	-X GET "http://${GRAFANA_SERVICE}/api/search?query=&type=dash-folder" | \
	jq -e

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} Grafana: Folder \"${dsname}\" created" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} Grafana: Error creating datasource \"${dsname}\"" >> /proc/1/fd/1
		exit 1
	fi

}

creategrafanafolder() {

	local result=$(
		curl -s \
		-H "Accept: application/json" \
		-H "Content-Type:application/json" \
		-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
		-X POST -d '{"title": "'"${GRAFANA_FOLDER_NAME}"'"}' "http://${GRAFANA_SERVICE}/api/folders"
	)


	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} Grafana: Folder \"${GRAFANA_FOLDER_NAME}\" created" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} Grafana: Error creating folder \"${GRAFANA_FOLDER_NAME}\"" >> /proc/1/fd/1
	fi

}


getgrafanadashboard() {
	local uid=$1

	local result=$(
		curl -s \
		-H "Accept: application/json" \
		-H "Content-Type: application/json" \
		-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
		-X GET "http://${GRAFANA_SERVICE}/api/search?query=&dashboardUIDs=${uid}" | \
		jq -e
	)

	local result_length=$(
		jq length <<< "${result}"
	)

	if [ "$result_length" -ne 0 ]
	then
		echo -e "${LOG_SUCCESS} Grafana: Dashboard \"${uid}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_WARNING} Grafana: Dashboard \"${uid}\" not found" >> /proc/1/fd/1
		return 1
	fi	
}

# TODO: error
# {
#   "message": "bad request data",
#   "traceID": ""
# }

# TODO: json anpassen, damit es hochgeladen werden kann


setgrafanadashboard() {
	local title=$1
	local folderuid=$2

	local result=\
	'{
		"dashboard": {
			"id": null,
			"uid": null,
			"title": "'"${title}"'",
			"tags": [ "nanohome" ],
			"timezone": "browser",
			"schemaVersion": 16,
			"refresh": "25s"
		},
		"folderUid": "'"${folderuid}"'",
		"message": "Initial upload",
		"overwrite": true
	}'

	jq <<< "${result}"
}

# TODO
creategrafanadashboard() {
	local jsonfile=$1

	echo "${jsonfile}"

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type:application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
	-X POST -d @"${jsonfile}" "http://${GRAFANA_SERVICE}/api/dashboards/db" | \
	jq -e


	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type:application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
	-X POST -d @"./templates/devices.json" "http://${GRAFANA_SERVICE}/api/dashboards/db" | \
	jq -e

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCCESS} Grafana: Dashboard \"${jsonfile}\" uploaded" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERROR} Grafana: Dashboard uploading \"${jsonfile}\" failed" >> /proc/1/fd/1
		return 1
	fi	
}


setgrafanahomedashboard() {

	curl -s \
	-H "Accept: application/json" \
	-H "Content-Type:application/json" \
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
	-X PUT -d '{"homeDashboardId":'"${GRAFANA_HOME_UID}"'}' "http://${GRAFANA_SERVICE}/api/org/preferences" | \
	jq -e

}

# Grafana dashboards - Home
############################################################

grafanadashboard_home=$(
	getgrafanadashboard "${GRAFANA_HOME_UID}" || \
	creategrafanadashboard "${GRAFANA_HOME_FILE}"
)

# Grafana dashboards - Devices
############################################################

grafanadashboard_devices=$(
	getgrafanadashboard "${GRAFANA_DEVICES_UID}" || \
	creategrafanadashboard "${GRAFANA_DEVICES_FILE}"
)

# Grafana dashboards - Timer
############################################################

grafanadashboard_timer=$(
	getgrafanadashboard "${GRAFANA_TIMER_UID}" || \
	creategrafanadashboard "${GRAFANA_TIMER_FILE}"
)

# Grafana dashboards - Standby
############################################################

grafanadashboard_standby=$(
	getgrafanadashboard "${GRAFANA_STANDBY_UID}" || \
	creategrafanadashboard "${GRAFANA_STANDBY_FILE}"
)

# Grafana dashboards - Measurements
############################################################

grafanadashboard_measurements=$(
	getgrafanadashboard "${GRAFANA_MEASUREMENTS_UID}" || \
	creategrafanadashboard "${GRAFANA_MEASUREMENTS_FILE}"
)

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
