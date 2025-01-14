#!/bin/bash
# write
# some
# things
# here



# NanoHome Environment         
############################################################

export NANOHOME_ROOTPATH="/opt/nanohome"
export GRAFANA_FOLDER_NAME="nanohome"
export GRAFANA_DASHBOARD_UID_HOME="XieEaLmRk"
export GRAFANA_DASHBOARD_FILE_HOME="${NANOHOME_ROOTPATH}/grafana-templates/home.json"
export GRAFANA_DASHBOARD_UID_DEVICES="fe47pva0wy8lcb"
export GRAFANA_DASHBOARD_FILE_DEVICES="${NANOHOME_ROOTPATH}/grafana-templates/devices.json"
export GRAFANA_DASHBOARD_UID_TIMER="ae489b6q64nwgf"
export GRAFANA_DASHBOARD_FILE_TIMER="${NANOHOME_ROOTPATH}/grafana-templates/timer.json"
export GRAFANA_DASHBOARD_UID_STANDBY="adjak60hekvswd"
export GRAFANA_DASHBOARD_FILE_STANDBY="${NANOHOME_ROOTPATH}/grafana-templates/standby.json"
export GRAFANA_DASHBOARD_UID_MEASUREMENTS="ee8v5d70ojpj4b"
export GRAFANA_DASHBOARD_FILE_MEASUREMENTS="${NANOHOME_ROOTPATH}/grafana-templates/measurements.json"
export GRAFANA_DATASOURCE_DEVICES="Devices"
export GRAFANA_DATASOURCE_MEASUREMENTS="Measurements"
export INFLUXDB_BUCKET_DEVICES="Devices" # Must begin with capital letter
export INFLUXDB_BUCKET_MEASUREMENTS="Measurements" # Must begin with capital letter
export INFLUXDB_SATOKEN_DESCRIPTION="nanohome grafana ro-token"
export NANOHOME_DEVWATCHER_INTERVAL=30
export NANOHOME_NOT_MONITORED_COMPONENTS="ble,cloud,mqtt,sys,wifi,ws,status,ht_ui,input:*,longpush:*"
export NANOHOME_NOT_MONITORED_COMPONENTS_LEGACY="input,input_event"
export NANOHOME_SHELL_ALLOWED_COMMANDS="create_dashboardelement,create_timer,delete_device,delete_measurement"
export NANOHOME_MQTT_TOPIC_STATUS="+/status/+"
export NANOHOME_MQTT_TOPIC_CONNECTED="+/status/+/connected"
export NANOHOME_MQTT_TOPIC_ONLINE="+/online"
export NANOHOME_MQTT_TOPIC_ONLINE_LEGACY="shellies/+/+/+"
export NANOHOME_MQTT_TOPIC_TIMER="nanohome/+/timer"
export NANOHOME_MQTT_TOPIC_STANDBY="nanohome/+/standby"
export NANOHOME_MQTT_TOPIC_DASHBOARD="nanohome/config/dashboard"
export NANOHOME_MQTT_TOPIC_CMDINPUT="input_command"
export NANOHOME_MQTT_TOPIC_CMDOUTPUT="output_command"
export NANOHOME_MQTT_FASTSUBSCRIBE="250"
export NANOHOME_MQTT_NORMALSUBSCRIBE="500"
export NANOHOME_MQTT_LONGSUBSCRIBE="1000"

# Script logging      
############################################################

LOG_DEBUG=true

LOG_BLU="\033[1;36m"
LOG_GRN="\033[1;32m"
LOG_YLW="\033[1;93m"
LOG_RED="\033[1;31m"
LOG_NOC="\033[0m"

LOG_INFO="[${LOG_BLU}Info   ${LOG_NOC}]"
LOG_SUCC="[${LOG_GRN}Success${LOG_NOC}]"
LOG_WARN="[${LOG_YLW}Warning${LOG_NOC}]"
LOG_ERRO="[${LOG_RED}Error  ${LOG_NOC}]"

# TODO
result_handler() {

	local type=$1
	local result=$2
	local message=$3

	if [ "${result}" != "null" ]
	then
		echo -e "${LOG_SUCC} ${message}" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${type} ${message}" >> /proc/1/fd/1
		jq <<< "${result}" >> /proc/1/fd/1
		return 1
	fi
}


# InfluxDB: Config
############################################################
# if no influx cli configuration exists create one

# i.O.
influxconfig_search() {

	local answer=$(
		influx config list --json
	)

	local result=$(
		jq -e \
		."${INFLUXDB_CONFIG_NAME}" \
		<<< ${answer}
	)

	if [ "${result}" != "null" ]
	then
		echo -e "${LOG_SUCC} Influx CLI: Config \"${INFLUXDB_CONFIG_NAME}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_INFO} Influx CLI: Config \"${INFLUXDB_CONFIG_NAME}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
influxconfig_create() {

	local result=$(
		influx config create \
		--config-name "${INFLUXDB_CONFIG_NAME}" \
		--host-url "http://${INFLUXDB_SERVICE}" \
		--org "${INFLUXDB_ORG}" \
		--token "${INFLUXDB_ADMINTOKEN}" \
		--active \
		--json
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCC} Influx CLI: Config \"${INFLUXDB_CONFIG_NAME}\" created" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} Influx CLI: Config \"${INFLUXDB_CONFIG_NAME}\" failed to create" >> /proc/1/fd/1
		jq <<< "${result}" >> /proc/1/fd/1
		exit 1
	fi
}

# i.O.
influxconfig_validate() {

	local answer=$(
		influx org list \
		--json
	)

	local result=$(
		jq -e \
		'.[] | {id, name, createdAt}' \
		<<< "${answer}"
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCC} Influx CLI: Connection successful" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} Influx CLI: Connection failed" >> /proc/1/fd/1
		jq <<< "${result}" >> /proc/1/fd/1
		exit 1
	fi	
}

influxconfig=$(
	influxconfig_search || influxconfig_create
)

influxconfig_validate

[ $LOG_DEBUG ] && jq '.token = "<SECURETOKEN>"' <<< "${influxconfig}" >> /proc/1/fd/1

# InfluxDB: Buckets
############################################################
# if bucket does not exist create it

# i.O.
influxbucket_search() {
	local bucket=$1

	local answer=$(
		influx bucket list \
		--json
	)

	local result=$(
		jq -e --arg name "${bucket}" \
		'.[] | select(.name == $name)' \
		<<< ${answer}
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCC} InfluxDB: Bucket \"${bucket}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_WARN} InfluxDB: Bucket \"${bucket}\" not found" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
influxbucket_create() {
	local bucket=$1

	local result=$(
		influx bucket create \
		--name "${bucket}" \
		--org "${INFLUXDB_ORG}" \
		--token "${INFLUXDB_ADMINTOKEN}" \
		--json
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCC} InfluxDB: Bucket \"${bucket}\" created" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} InfluxDB: Bucket \"${bucket}\" failed to create" >> /proc/1/fd/1
		jq <<< "${result}" >> /proc/1/fd/1
		exit 1
	fi
}

# Devices
influxbucket_devices=$(
	influxbucket_search "${INFLUXDB_BUCKET_DEVICES}" || \
	influxbucket_create "${INFLUXDB_BUCKET_DEVICES}"
)

export INFLUXBUCKET_DEVICES_ID=$(
	jq -r '.id' \
	<<< "${influxbucket_devices}"
)

[ $LOG_DEBUG ] && \
jq '. | {id, name, createdAt}' <<< "${influxbucket_devices}" >> /proc/1/fd/1

# Measurements
influxbucket_measurements=$(
	influxbucket_search "${INFLUXDB_BUCKET_MEASUREMENTS}" || \
	influxbucket_create "${INFLUXDB_BUCKET_MEASUREMENTS}"
)

export INFLUXBUCKET_MEASUREMENTS_ID=$(
	jq -r '.id' <<< "${influxbucket_measurements}"
)

[ $LOG_DEBUG ] && jq '. | {id, name, createdAt}' <<< "${influxbucket_measurements}" >> /proc/1/fd/1

# InfluxDB: Auth token (for Grafana datasource)
############################################################
# if no active auth token with correct permissions found create it
# if multiple auth tokens with description "${INFLUXDB_SATOKEN_DESCRIPTION}" found
# delete them and recreate one

# i.O.
influxauthtoken_search() {
	local description=$1

	local answer=$(
		influx auth list \
		--json
	)

	local result=$(
		jq -e \
		--arg description "${INFLUXDB_SATOKEN_DESCRIPTION}" \
		'[.[] | select(.description == $description)]' \
		<<< "${answer}"
	)

	jq <<< "${result}"
}

# i.O.
influxauthtoken_test() {
	local influxauthtoken_current=$1

	local result=$(
		jq -e \
		--arg val1 "${INFLUXBUCKET_DEVICES_ID}" \
		--arg val2 "${INFLUXBUCKET_MEASUREMENTS_ID}" \
		'[.[].permissions[]] | contains([$val1, $val2])' \
		<<< "${influxauthtoken_current}"
	)

	if ( $result )
	then
		echo -e "${LOG_SUCC} InfluxDB: Auth token \"${INFLUXDB_SATOKEN_DESCRIPTION}\" found with correct permissions" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_WARN} InfluxDB: Auth token \"${INFLUXDB_SATOKEN_DESCRIPTION}\" found with missing permissions" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
influxauthtoken_delete() {
	local influxauthtoken_current_id=$1

	local result=$(
		influx auth delete \
		--id "${influxauthtoken_current_id}" \
		--json
	)

	if [ "${result}" ]
	then
		echo -e "${LOG_SUCC} InfluxDB: Auth token \"${INFLUXDB_SATOKEN_DESCRIPTION}\" removed" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_WARN} InfluxDB: Auth token \"${INFLUXDB_SATOKEN_DESCRIPTION}\" failed to remove" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
influxauthtoken_create() {

	local result=$(
		influx auth create \
		--description "${INFLUXDB_SATOKEN_DESCRIPTION}" \
		--org "${INFLUXDB_ORG}" \
		--read-bucket "${INFLUXBUCKET_DEVICES_ID}" \
		--read-bucket "${INFLUXBUCKET_MEASUREMENTS_ID}" \
		--json
	)

	if [ "${result}" ]
	then
		echo -e "${LOG_SUCC} InfluxDB: Auth token \"${INFLUXDB_SATOKEN_DESCRIPTION}\" created" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} InfluxDB: Auth token \"${INFLUXDB_SATOKEN_DESCRIPTION}\" failed to create" >> /proc/1/fd/1
		exit 1
	fi	
}

influxauthtoken_current=$(
	influxauthtoken_search
)

influxauthtoken_objects=$(
	jq length <<< "${influxauthtoken_current}"
)

# One token found
if [ "$influxauthtoken_objects" -eq 1 ]
then
	if ( influxauthtoken_test "${influxauthtoken_current}" )
	then
		export INFLUXDB_AUTHTOKEN=$(
			jq -r '.[].token' <<< "${influxauthtoken_current}"
		)

		[ $LOG_DEBUG ] && \
		jq '.[] | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${influxauthtoken_current}" \
		>> /proc/1/fd/1
	else
		influxauthtoken_current_id=$(
			jq -r '.[].id' <<< "${influxauthtoken_current}"
		)

		influxauthtoken_deleted=$(
			influxauthtoken_delete "${influxauthtoken_current_id}"
		)

		influxauthtoken_objects=0

		[ $LOG_DEBUG ] && \
		jq '. | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${influxauthtoken_deleted}" \
		>> /proc/1/fd/1
	fi
fi

# Multiple tokens found
if [ "$influxauthtoken_objects" -gt 1 ]
then
	echo -e "${LOG_WARN} InfluxDB: Multiple auth token \"${INFLUXDB_SATOKEN_DESCRIPTION}\" found" >> /proc/1/fd/1

	for (( i = 0; i < influxauthtoken_objects; i++ ))
	do
		influxauthtoken_current_id=$(
			jq -r .[$i].id <<< "${influxauthtoken_current}"
		)

		influxauthtoken_deleted=$(
			influxauthtoken_delete "${influxauthtoken_current_id}"
		)

		[ $LOG_DEBUG ] && \
		jq '. | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${influxauthtoken_deleted}" \
		>> /proc/1/fd/1
	done

	influxauthtoken_objects=0
fi

# No token found
if [ "$influxauthtoken_objects" -eq 0 ]
then
	echo -e "${LOG_WARN} InfluxDB: No suitable auth token found" >> /proc/1/fd/1

	new_influxauth_token=$(
		influxauthtoken_create "${INFLUXBUCKET_DEVICES_ID}" "${INFLUXBUCKET_MEASUREMENTS_ID}"
	)

	export INFLUXDB_AUTHTOKEN=$(
		jq -r '.token' <<< "${new_influxauth_token}"
	)

	[ $LOG_DEBUG ] && \
	jq '. | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${new_influxauth_token}" \
	>> /proc/1/fd/1
fi

# Grafana: Basic Auth connection
############################################################
# test connection to "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/org"

grafanaapiheaders=(
	-s
	-H "Accept: application/json"
	-H "Content-Type:application/json"
)

grafanaserviceaccount_json='{
	"name": "'"${GRAFANA_SERVICEACCOUNT}"'",
	"role": "Admin",
	"isDisabled": false
}'

# TODO
grafanaapibasicauth_test() {

	local answer=$(
		curl "${grafanaapiheaders[@]}" \
		--progress-bar \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/org"
	)

	local result=$(
		jq -e 'has("name")' <<< "${answer}"
	)	

	if [ "${result}" = "true" ]
	then
		echo -e "${LOG_SUCC} Grafana: Basic auth successful" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Basic auth failed" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

grafanaapibasicauth_test

# Grafana: Service account 
############################################################
# if no access token specified in env file
# - check if service account and token exist
# - create a service account if needed
# - recreate auth token

# i.O.
grafanaserviceaccount_find() {

	local answer=$(
		curl "${grafanaapiheaders[@]}" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/search?query=${GRAFANA_SERVICEACCOUNT}"
	)

	local result=$(
		jq -e '.serviceAccounts[].name' <<< "${answer}"
	)

	if [ -n "${result}" ]
	then
		echo -e "${LOG_SUCC} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" found" >> /proc/1/fd/1
		jq '.serviceAccounts[]' <<< "${answer}"
	else
		echo -e "${LOG_WARN} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" not found" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
grafanaserviceaccount_create() {

	local answer=$(
		curl "${grafanaapiheaders[@]}" \
		-d "${grafanaserviceaccount_json}" \
		-X POST "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts"
	)

	local result=$(
		jq -e 'has("name")' <<< "${answer}"
	)

	if ( $result )
	then
		echo -e "${LOG_SUCC} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" created" >> /proc/1/fd/1
		jq <<< "${answer}"
	else
		echo -e "${LOG_ERRO} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" failed to create" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

# i.O.
grafanaserviceaccounttoken_find() {

	local said=$1
	local answer=$(
		curl "${grafanaapiheaders[@]}" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${said}/tokens"
	)
	local result=$(
		jq -e '.[].name' <<< "${answer}"
	)

	if [ "${result}" ]
	then
		echo -e "${LOG_SUCC} Grafana: Service account token found" >> /proc/1/fd/1
		jq <<< "${answer}"
	else
		echo -e "${LOG_WARN} Grafana: Service account token not found" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
grafanaserviceaccounttoken_delete() {

	local grafanaserviceaccount_id=$1
	local grafanaserviceaccount_token_id=$2
	local answer=$(
		curl "${grafanaapiheaders[@]}" \
		-X DELETE "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${grafanaserviceaccount_id}/tokens/${grafanaserviceaccount_token_id}"
	)
	local result=$(
		jq -e '.message == "Service account token deleted"' <<< "${answer}"
	)

	if ( $result )
	then
		echo -e "${LOG_SUCC} Grafana: Existing service account token deleted" >> /proc/1/fd/1
		jq <<< "${answer}"
	else
		echo -e "${LOG_WARN} Grafana: Existing service account token failed to delete" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
grafanaserviceaccounttoken_create() {

	local grafanaserviceaccount_id=$1
	local answer=$(
		curl "${grafanaapiheaders[@]}" \
		-d "${grafanaserviceaccount_json}" \
		-X POST "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${grafanaserviceaccount_id}/tokens"
	)
	local result=$(
		jq -e '.name' <<< "${answer}"
	)

	if [ "${result}" != "null" ]
	then
		echo -e "${LOG_SUCC} Grafana: New service account token created" >> /proc/1/fd/1
		jq <<< "${answer}"
	else
		echo -e "${LOG_ERRO} Grafana: Error creating new service account token" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

if [ -z "${GRAFANA_SERVICEACCOUNT_TOKEN}" ]
then
	echo -e "${LOG_INFO} Grafana: No service account token provided in env-file" >> /proc/1/fd/1

	# Service account
	grafanaserviceaccount=$(
		grafanaserviceaccount_find "${GRAFANA_SERVICEACCOUNT}" || \
		grafanaserviceaccount_create
	)

	grafanaserviceaccount_id=$(
		jq -r .id <<< "${grafanaserviceaccount}"
	)

	[ $LOG_DEBUG ] && \
	jq '. | {name, login, role}' <<< "${grafanaserviceaccount}" \
	>> /proc/1/fd/1

	# Token
	grafanaserviceaccount_token=$(
		grafanaserviceaccounttoken_find "${grafanaserviceaccount_id}"
	)

	grafanaserviceaccount_token_objects=$(
		jq length <<< ${grafanaserviceaccount_token}
	)

	# Delete existing tokens
	for (( i = 0; i < grafanaserviceaccount_token_objects; i++ ))
	do
		grafanaserviceaccount_token_id=$(
			jq -r .[$i].id <<< "${grafanaserviceaccount_token}"
		)
		grafanaserviceaccount_token_deleted=$(
			grafanaserviceaccounttoken_delete "${grafanaserviceaccount_id}" "${grafanaserviceaccount_token_id}"
		)
		
		[ $LOG_DEBUG ] && \
		jq '.[] | {id, name, created}' <<< "${grafanaserviceaccount_token}" \
		>> /proc/1/fd/1
	done

	# Create a new token
	grafanaserviceaccount_token=$(
		grafanaserviceaccounttoken_create "${grafanaserviceaccount_id}"
	)

	export GRAFANA_SERVICEACCOUNT_TOKEN=$(
		jq -r .key <<< "${grafanaserviceaccount_token}"
	)

	[ $LOG_DEBUG ] && \
	jq '.key = "<SECUREKEY>"' <<< "${grafanaserviceaccount_token}" \
	>> /proc/1/fd/1
else
	echo -e "${LOG_SUCC} Grafana: Service account token provided" >> /proc/1/fd/1
fi

# Grafana: API connection
############################################################
# test connection to "http://${GRAFANA_SERVICE}/api/org"
# with "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}"

grafanaapiheaders_token=(
	-s
	-H "Accept: application/json"
	-H "Content-Type:application/json"
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}"
)

# i.O.
grafanaapiauthtoken_test() {

	local answer=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/org"
	)

	local result=$(
		jq -e 'has("name")' <<< "${answer}"
	)	

	if ( $result )
	then
		echo -e "${LOG_SUCC} Grafana: API auth token valid" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Connection with API auth token failed" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

grafanaapiauthtoken_test

# Grafana: Datasources
############################################################
# if datasource does not exist create it

# i.O.
grafanadatasource_search() {

	local dsname=$1
	local answer=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/datasources/name/${dsname}"
	)
	local result=$(
		jq -e '.type == "influxdb"' <<< "${answer}"
	)

	if [ -n "${result}" ]
	then
		echo -e "${LOG_SUCC} Grafana: Datasource \"${dsname}\" found" >> /proc/1/fd/1
		jq <<< "${answer}"
	else
		echo -e "${LOG_WARN} Grafana: Datasource \"${dsname}\" not found" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
grafanadatasource_prepare() {

	local bucket=$1
	local result='{
		"name":"'"${bucket}"'",
		"type":"influxdb",
		"typeName":"InfluxDB",
		"access":"proxy",
		"url":"http://'"${INFLUXDB_SERVICE}"'",
		"jsonData":{"dbName":"'"${bucket}"'","httpMode":"GET","httpHeaderName1":"Authorization"},
		"secureJsonData":{"httpHeaderValue1":"Token '"${INFLUXDB_AUTHTOKEN}"'"},
		"isDefault":true,
		"readOnly":false
	}'

	jq <<< "${result}"
}

# i.O.
grafanadatasource_create() {

	local dsjson=$1
	local dsname=$(
		jq -r .name <<< "${1}"
	)

	local answer=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X POST -d "${dsjson}" "http://${GRAFANA_SERVICE}/api/datasources" | \
		jq -e
	)

	local result=$(
		jq -e '.message == "Datasource added"' <<< "${answer}"
	)
	
	if [ -n "${result}" ]
	then
		echo -e "${LOG_SUCC} Grafana: Datasource \"${dsname}\" created" >> /proc/1/fd/1
		jq -e '.datasource' <<< "${answer}"
	else
		echo -e "${LOG_ERRO} Grafana: Error creating datasource \"${dsname}\"" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

# Devices
grafanadatasource_devices_json=$(
	grafanadatasource_prepare "${GRAFANA_DATASOURCE_DEVICES}"
)

grafanadatasource_devices=$(
	grafanadatasource_search "${GRAFANA_DATASOURCE_DEVICES}" || \
	grafanadatasource_create "${grafanadatasource_devices_json}"
)

[ $LOG_DEBUG ] && \
jq '. | {uid, name, type, url, jsonData, secureJsonFields}' <<< "${grafanadatasource_devices}" \
>> /proc/1/fd/1

# Measurements
grafanadatasource_measurements_json=$(
	grafanadatasource_prepare "${GRAFANA_DATASOURCE_MEASUREMENTS}"
)

grafanadatasource_measurements=$(
	grafanadatasource_search "${GRAFANA_DATASOURCE_MEASUREMENTS}" || \
	grafanadatasource_create "${grafanadatasource_measurements_json}"
)

[ $LOG_DEBUG ] && \
jq '. | {uid, name, type, url, jsonData, secureJsonFields}' <<< "${grafanadatasource_measurements}" \
>> /proc/1/fd/1

# Grafana: Content
############################################################
# if source folder grafana-content exists
# modify mqtt credentials ins mqttconfig.js
# move content to "${NANOHOME_ROOTPATH}/data/grafana"
#
# ! grafana docker:
#    - "/usr/share/grafana/public/nanohome"
#       must be mounted to "${NANOHOME_ROOTPATH}/data/grafana"
#    - "disable_sanitize_html = true" must be set in grafana.ini
#    - plugins needed
#      - grafana-clock-panel
#      - volkovlabs-variable-panel

grafanacontent_source="${NANOHOME_ROOTPATH}/grafana-content"
grafanacontent_destination="${NANOHOME_ROOTPATH}/data/grafana"

# i.O.
grafanacontent_modify() {
	sed -i '/var user/c\var user = "'"${MQTT_USER}"'"' "${grafanacontent_source}/js/mqttconfig.js"
	sed -i '/var pwd/c\var pwd = "'"${MQTT_PASSWORD}"'"' "${grafanacontent_source}/js/mqttconfig.js"

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCC} Grafana: Content credentials set" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERRO} Grafana: Failed setting content credentials" >> /proc/1/fd/1
		exit 1
	fi	
}

# i.O.
grafanacontent_move() {
	rm -rf "${grafanacontent_destination}"/*
	mv -f "${grafanacontent_source}"/* "${grafanacontent_destination}"

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCC} Grafana: Content moved to \"${grafanacontent_destination}\"" >> /proc/1/fd/1
		rm -rf "${grafanacontent_source}"
	else
		echo -e "${LOG_ERRO} Grafana: Failed moving content to \"${grafanacontent_destination}\"" >> /proc/1/fd/1
		exit 1
	fi
}

if [ -d "${grafanacontent_source}" ]
then
	echo -e "${LOG_INFO} Grafana: Creating content \"${grafanacontent_destination}\"" >> /proc/1/fd/1

	grafanacontent_modify
	grafanacontent_move
else
	echo -e "${LOG_INFO} Grafana: Content \"${grafanacontent_destination}\" already created" >> /proc/1/fd/1
fi

# Grafana: Dashboard folder
############################################################
# if dashboard folder "nanohome" does not exist create it

# i.O.
grafanadashfolder_search() {

	local answer=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/search?query=&type=dash-folder"
	)

	local result=$(
		jq -e ".[] | select(.title==\"${GRAFANA_FOLDER_NAME}\")" <<< "${answer}"
	)

	if [ -n "${result}" ]
	then
		echo -e "${LOG_SUCC} Grafana: Folder \"${GRAFANA_FOLDER_NAME}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_WARN} Grafana: Folder \"${GRAFANA_FOLDER_NAME}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
grafanadashfolder_create() {

	local result=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X POST -d '{"title": "'"${GRAFANA_FOLDER_NAME}"'"}' "http://${GRAFANA_SERVICE}/api/folders"
	)

	if [ -n "${result}" ]
	then
		echo -e "${LOG_SUCC} Grafana: Folder \"${GRAFANA_FOLDER_NAME}\" created" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} Grafana: Error creating folder \"${GRAFANA_FOLDER_NAME}\"" >> /proc/1/fd/1
		exit 1
	fi
}

grafanadashfolder=$(
	grafanadashfolder_search || \
	grafanadashfolder_create
)

export GRAFANA_FOLDER_UID=$(
	jq -r '.uid' <<< "${grafanadashfolder}"
)

[ $LOG_DEBUG ] && \
jq '. | {uid, title, url}' <<< "${grafanadashfolder}" \
>> /proc/1/fd/1

# Grafana: Dashboards
############################################################
# if dashbaord does not exist
# load dshboard-json, prepare and upload it

# i.O.
grafanadashboard_find() {

	local uid=$1
	local answer=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/search?query=&dashboardUIDs=${uid}"
	)

	local result=$(
		jq -e '.[] | {id, name}' <<< "${answer}"
	)

	if [ -n "${result}" ]
	then
		echo -e "${LOG_SUCC} Grafana: Dashboard \"${uid}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_WARN} Grafana: Dashboard \"${uid}\" not found" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		return 1
	fi	
}

# i.O.
grafanadashboard_prepare() {

	local file=$1
	local filecontent=$(
		jq '.' "${file}"
	)

	local jsondata='{
		"dashboard": {},
		"folderUid": "'"${GRAFANA_FOLDER_UID}"'",
		"message": "Initial upload",
		"overwrite": true
	}'

	local result=$(
		jq --argjson dashboard "${filecontent}" \
		'.dashboard = $dashboard' \
		<<< "${jsondata}"
	)

	if [ -n "${result}" ]
	then
		echo -e "${LOG_SUCC} Grafana: Dashboard \"${file}\" prepared for upload" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} Grafana: Failed preparing dashboard \"${file}\" for upload" >> /proc/1/fd/1
		jq <<< "${result}" >> /proc/1/fd/1
		exit 1
	fi	
}

# i.O.
grafanadashboard_create() {

	local jsondata=$1
	local answer=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X POST -d "${jsondata}" "http://${GRAFANA_SERVICE}/api/dashboards/db"
	)

	local result=$(
		jq -e '. | select(.status == "success")' <<< "${answer}"
	)

	if [ -n "${result}" ]
	then
		echo -e "${LOG_SUCC} Grafana: Dashboard uploaded" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} Grafana: Dashboard upload failed" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi	
}

# Home
grafanadashboard_home_exists=$(
	grafanadashboard_find "${GRAFANA_DASHBOARD_UID_HOME}"
)

if [ "${grafanadashboard_home_exists}" == "" ]
then
	grafanadashboard_home_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_HOME}"
	)

	grafanadashboard_home=$(
		grafanadashboard_create "${grafanadashboard_home_json}"
	)

	[ $LOG_DEBUG ] && \
	jq '.' <<< "${grafanadashboard_home}" \
	>> /proc/1/fd/1
fi

# Devices
grafanadashboard_devices_exists=$(
	grafanadashboard_find "${GRAFANA_DASHBOARD_UID_DEVICES}"
)

if [ "${grafanadashboard_devices_exists}" == "" ]
then
	grafanadashboard_devices_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_DEVICES}"
	)

	grafanadashboard_devices=$(
		grafanadashboard_create "${grafanadashboard_devices_json}"
	)

	[ $LOG_DEBUG ] && \
	jq '.' <<< "${grafanadashboard_devices}" \
	>> /proc/1/fd/1	
fi

# Timer
grafanadashboard_timer_exists=$(
	grafanadashboard_find "${GRAFANA_DASHBOARD_UID_TIMER}"
)

if [ "${grafanadashboard_timer_exists}" == "" ]
then
	grafanadashboard_timer_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_TIMER}"
	)

	grafanadashboard_timer=$(	
		grafanadashboard_create "${grafanadashboard_timer_json}"
	)

	[ $LOG_DEBUG ] && \
	jq '.' <<< "${grafanadashboard_timer}" \
	>> /proc/1/fd/1
fi

# Standby
grafanadashboard_standby_exists=$(
	grafanadashboard_find "${GRAFANA_DASHBOARD_UID_STANDBY}"
)

if [ "${grafanadashboard_standby_exists}" == "" ]
then
	grafanadashboard_standby_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_STANDBY}"
	)

	grafanadashboard_standby=$(	
		grafanadashboard_create "${grafanadashboard_standby_json}"
	)

	[ $LOG_DEBUG ] && \
	jq '.' <<< "${grafanadashboard_standby}" \
	>> /proc/1/fd/1
fi

# Measurements
grafanadashboard_measurements_exists=$(
	grafanadashboard_find "${GRAFANA_DASHBOARD_UID_MEASUREMENTS}"
)

if [ "${grafanadashboard_measurements_exists}" == "" ]
then
	grafanadashboard_measurements_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_MEASUREMENTS}"
	)

	grafanadashboard_measurements=$(	
		grafanadashboard_create "${grafanadashboard_measurements_json}"
	)

	[ $LOG_DEBUG ] && \
	jq '.' <<< "${grafanadashboard_measurements}" \
	>> /proc/1/fd/1
fi

# Mosquitto: 
############################################################
# if connection to mosquitto fails exit
# ! mosquitto docker:
#   - settings in mosquitto.conf must be adjusted
#   - passwd file "/etc/mosquitto/passwd" must exist and be modified with
#     - mosquitto_passwd -U /etc/mosquitto/passwd
#     - mosquitto_passwd -b /etc/mosquitto/passwd "${MQTT_USER}" "${MQTT_PASSWORD}"



# Nanohome: Config
############################################################
# configure nanohome environment
# TODO: Crontab-File mit Header ausrüsten


# Nanohome: Services
############################################################

crond -f &

#/bin/bash /opt/nanohome/services/mqtt_shell -s &
#/bin/bash /opt/nanohome/services/devwatcher_shelly_legacy &
#/bin/bash /opt/nanohome/services/devwatcher_shelly_plus &
#/bin/bash /opt/nanohome/services/measurements_shelly_legacy &
#/bin/bash /opt/nanohome/services/measurements_shelly_plus &
#/bin/bash /opt/nanohome/services/standby_shelly_plus &

exec bash
