#!/bin/bash

# nanohome Environment         
############################################################

export NANOHOME_ROOTPATH="/opt/nanohome"
export NANOHOME_CRONTABS="/etc/crontabs/nanohome"
export NANOHOME_DEVWATCHER_INTERVAL=30
export NANOHOME_NOT_MONITORED_COMPONENTS="input:0,input:1,ble,cloud,mqtt,sys,wifi,ws,status,ht_ui"
export NANOHOME_NOT_MONITORED_COMPONENTS_LEGACY="input,input_event"
export NANOHOME_SHELL_ALLOWED_COMMANDS="create_dashboardelement,create_timer,delete_device,delete_measurement"

export INFLUX_BUCKET_DEVICES="Devices" # Must begin with capital letter
export INFLUX_BUCKET_MEASUREMENTS="Measurements" # Must begin with capital letter
export INFLUX_TOKEN_DESCRIPTION="nanohome grafana ro-token"

export MQTT_TOPIC_STATUS="+/status/+"
export MQTT_TOPIC_ONLINE="+/online"
export MQTT_TOPIC_ONLINE_LEGACY="shellies/+/+/+"

export MQTT_TOPIC_CONNECTED="+/status/+/connected"
export MQTT_TOPIC_DESCRIPTION="+/status/+/description"
export MQTT_TOPIC_OUTPUT="+/status/+/output"

export MQTT_TOPIC_CONNECTED_LEGACY="shellies/+/+/+/connected"
export MQTT_TOPIC_DESCRIPTION_LEGACY="shellies/+/+/+/description"
export MQTT_TOPIC_OUTPUT_LEGACY="shellies/+/+/+/output"

export MQTT_TOPIC_DEVICES="nanohome/devices/+"
export MQTT_TOPIC_HOME="nanohome/home/+"
export MQTT_TOPIC_STANDBY="nanohome/standby/+"
export MQTT_TOPIC_TIMER="nanohome/timer/+"

export MQTT_TOPIC_DASHBOARD="nanohome/home/dashboard"
export MQTT_TOPIC_CMDINPUT="nanohome/shell/input"
export MQTT_TOPIC_CMDOUTPUT="nanohome/shell/output"

export MQTT_FASTSUBSCRIBE="250"
export MQTT_NORMALSUBSCRIBE="500"
export MQTT_LONGSUBSCRIBE="1000"

export GRAFANA_DASHFOLDER_NAME="nanohome"
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


# Script logging      
############################################################

export LOG_START=true
export LOG_SCRIPT=true
export LOG_SERVICES=true

export LOG_BLU="\033[1;36m"
export LOG_GRN="\033[1;32m"
export LOG_YLW="\033[1;93m"
export LOG_RED="\033[1;31m"
export LOG_NOC="\033[0m"

export LOG_INFO="[${LOG_BLU}Verbose${LOG_NOC}]"
export LOG_SUCC="[${LOG_GRN}Success${LOG_NOC}]"
export LOG_WARN="[${LOG_YLW}Warning${LOG_NOC}]"
export LOG_ERRO="[${LOG_RED}Error  ${LOG_NOC}]"

# InfluxDB: Config
############################################################
# if no influx cli configuration exists create one

# i.O.
influxconfig_search() {

	local answer=$(
		influx config list --json
	)

	local result=$(
		jq --arg name "${INFLUX_CONFIG}" \
		'. | has($name)' \
		<<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Influx CLI: Config \"${INFLUX_CONFIG}\" found" >> /proc/1/fd/1
		jq '.token = "<SECURETOKEN>"' <<< ${answer}
		return 0
	else
		echo -e "${LOG_INFO} Influx CLI: Config \"${INFLUX_CONFIG}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
influxconfig_create() {

	local answer=$(
		influx config create \
		--config-name "${INFLUX_CONFIG}" \
		--host-url "${INFLUX_HOST}" \
		--org "${INFLUX_ORG}" \
		--token "${INFLUX_TOKEN}" \
		--active \
		--json
	)

	local result=$(
		jq -e '. | has("token")' <<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Influx CLI: Config \"${INFLUX_CONFIG}\" created" >> /proc/1/fd/1
		jq '.token = "<SECURETOKEN>"' <<< ${answer}
		return 0
	else
		echo -e "${LOG_ERRO} Influx CLI: Config \"${INFLUX_CONFIG}\" failed to create" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
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
		jq -e '.[] | has("name")' <<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Influx CLI: Successfully connected to ${INFLUX_HOST}" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_ERRO} Influx CLI: Connection to ${INFLUX_HOST} failed" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi	
}

influxconfig=$(
	influxconfig_search || influxconfig_create
)

influxconfig_validate

# i.O.
[[ $LOG_START ]] && jq <<< "${influxconfig}" >> /proc/1/fd/1

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
		'.[] | select(.name == $name) | .name == $name' \
		<<< "${answer}"
	)

	local output=$(
		jq -e --arg name "${bucket}" \
		'.[] | select(.name == $name)' \
		<<< ${answer}
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} InfluxDB: Bucket \"${bucket}\" found" >> /proc/1/fd/1
		jq <<< "${output}"
		return 0
	else
		echo -e "${LOG_INFO} InfluxDB: Bucket \"${bucket}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
influxbucket_create() {

	local bucket=$1

	local answer=$(
		influx bucket create \
		--name "${bucket}" \
		--org "${INFLUX_ORG}" \
		--token "${INFLUX_TOKEN}" \
		--json
	)

	local result=$(
		jq -e --arg name "${bucket}" \
		'. | select(.name == $name) | .name == $name' \
		<<< "${answer}"
	)

	local output=$(
		jq -e --arg name "${bucket}" \
		'select(.name == $name)' \
		<<< ${answer}
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} InfluxDB: Bucket \"${bucket}\" created" >> /proc/1/fd/1
		jq <<< "${output}"
		return 0
	else
		echo -e "${LOG_ERRO} InfluxDB: Bucket \"${bucket}\" failed to create" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

# Devices
influxbucket_devices=$(
	influxbucket_search "${INFLUX_BUCKET_DEVICES}" || \
	influxbucket_create "${INFLUX_BUCKET_DEVICES}"
)

export INFLUX_BUCKET_DEVICES_ID=$(
	jq -r '.id'	<<< "${influxbucket_devices}"
)

[[ $LOG_START ]] && jq  '. | {id, name, createdAt}' <<< "${influxbucket_devices}" >> /proc/1/fd/1

# Measurements
influxbucket_measurements=$(
	influxbucket_search "${INFLUX_BUCKET_MEASUREMENTS}" || \
	influxbucket_create "${INFLUX_BUCKET_MEASUREMENTS}"
)

export INFLUX_BUCKET_MEASUREMENTS_ID=$(
	jq -r '.id' <<< "${influxbucket_measurements}"
)

[[ $LOG_START ]] && jq  '. | {id, name, createdAt}' <<< "${influxbucket_measurements}" >> /proc/1/fd/1

# InfluxDB: Auth token (for Grafana datasource)
############################################################
# if no active auth token with permissions to nanohome buckts found
# or if multiple auth tokens with description "${INFLUX_TOKEN_DESCRIPTION}" found
# delete them and recreate one before 

# TODO: TEST
influxauthtoken_search() {

	local answer=$(
		influx auth list \
		--json
	)

	local result=$(
		jq -e --arg description "${INFLUX_TOKEN_DESCRIPTION}" \
		'[.[] | select(.description == $description)]' \
		<<< "${answer}"
	)

	jq <<< "${result}"
}

# TODO: TEST
influxauthtoken_create() {

	local answer=$(
		influx auth create \
		--description "${INFLUX_TOKEN_DESCRIPTION}" \
		--org "${INFLUX_ORG}" \
		--read-bucket "${INFLUX_BUCKET_DEVICES_ID}" \
		--read-bucket "${INFLUX_BUCKET_MEASUREMENTS_ID}" \
		--json
	)

	local result=$(
		jq -e --arg description "${INFLUX_TOKEN_DESCRIPTION}" \
		'.description == $description' \
		<<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} InfluxDB: Auth token \"${INFLUX_TOKEN_DESCRIPTION}\" created" >> /proc/1/fd/1
		jq <<< "${answer}"
	else
		echo -e "${LOG_ERRO} InfluxDB: Auth token \"${INFLUX_TOKEN_DESCRIPTION}\" failed to create" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi	
}

# TODO: TEST
influxauthtoken_validate() {

	local influxauthtoken_found=$1

	local result=$(
		jq -e \
		--arg val1 "${INFLUX_BUCKET_DEVICES_ID}" \
		--arg val2 "${INFLUX_BUCKET_MEASUREMENTS_ID}" \
		'[.[].permissions[]] | contains([$val1, $val2])' \
		<<< "${influxauthtoken_found}"
	)

	if ( $result )
	then
		echo -e "${LOG_SUCC} InfluxDB: Auth token \"${INFLUX_TOKEN_DESCRIPTION}\" found with correct permissions" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_WARN} InfluxDB: Auth token \"${INFLUX_TOKEN_DESCRIPTION}\" found with missing permissions. Delete it first" >> /proc/1/fd/1
		exit 1
	fi
}

influxauthtoken_found=$(
	influxauthtoken_search
)

influxauthtoken_objects=$(
	jq length <<< "${influxauthtoken_found}"
)

# No token found
if [[ "$influxauthtoken_objects" -eq 0 ]]
then
	influxauthtoken=$(influxauthtoken_create)
fi

# One token found - check permissions
if [[ "$influxauthtoken_objects" -eq 1 ]]
then
	influxauthtoken_validate "${influxauthtoken_found}"

	influxauthtoken=$(
		jq '.[]' <<< $influxauthtoken_found
	)
fi

# Multiple tokens found
if [[ "$influxauthtoken_objects" -gt 1 ]]
then
	echo -e "${LOG_ERRO} InfluxDB: Multiple auth token \"${INFLUX_TOKEN_DESCRIPTION}\" found. Delete them first" >> /proc/1/fd/1
	exit 1
fi

export INLUX_TOKEN=$(
	jq -r '.token' <<< "${influxauthtoken}"
)

[[ $LOG_START ]] && jq '.token = "<SECURETOKEN>"' <<< "${influxauthtoken}" >> /proc/1/fd/1

# Grafana: Basic Auth connection
############################################################
# test connection to "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/org"

grafanaapiheaders=(
	-H "Accept: application/json"
	-H "Content-Type:application/json"
)

grafanaserviceaccount_json='{
	"name": "'"${GRAFANA_SERVICEACCOUNT}"'",
	"role": "Admin",
	"isDisabled": false
}'

# i.O.
grafanaapibasicauth_test() {

	local answer=$(
		curl "${grafanaapiheaders[@]}" \
		--progress-bar \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/org"
	)

	local result=$(
		jq -e '. | has("name")' <<< "${answer}"
	)	

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: Basic auth successful" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Basic auth failed" >> /proc/1/fd/1
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

# TODO: TEST
grafanaserviceaccount_find() {

	local answer=$(
		curl -s "${grafanaapiheaders[@]}" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/serviceaccounts/search?query=${GRAFANA_SERVICEACCOUNT}"
	)

	local result=$(
		jq -e --arg name "${GRAFANA_SERVICEACCOUNT}" \
		'.serviceAccounts[].name == $name' \
		<<< "${answer}"
	)

	local output=$(
		jq -e --arg title "${foldername}" \
		'.serviceAccounts[] | {id, name, login, role}' \
		<<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" found" >> /proc/1/fd/1
		jq <<< "${output}"
	else
		echo -e "${LOG_WARN} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" not found" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		return 1
	fi
}

# TODO: TEST
grafanaserviceaccount_create() {

	local answer=$(
		curl -s "${grafanaapiheaders[@]}" \
		-d "${grafanaserviceaccount_json}" \
		-X POST "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/serviceaccounts"
	)

	local result=$(
		jq -e --arg name "${GRAFANA_SERVICEACCOUNT}" \
		'.name == $name' \
		<<< "${answer}"
	)

	local output=$(
		jq -e --arg title "${foldername}" \
		'. | {id, name, login, role}' \
		<<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" created" >> /proc/1/fd/1
		jq <<< "${output}"
	else
		echo -e "${LOG_ERRO} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" failed to create" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

# TODO: TEST
grafanaserviceaccounttoken_find() {

	local said=$1

	local answer=$(
		curl -s "${grafanaapiheaders[@]}" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${said}/tokens"
	)

	local result=$(
		jq -e --arg name "${GRAFANA_SERVICEACCOUNT}" \
		'.[].name == $name' \
		<<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: Service account token found" >> /proc/1/fd/1
		jq <<< "${answer}"
	else
		echo -e "${LOG_WARN} Grafana: Service account token not found" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		return 1
	fi
}

# TODO: TEST
grafanaserviceaccounttoken_delete() {

	local grafanaserviceaccount_id=$1
	local grafanaserviceaccount_token_id=$2

	local answer=$(
		curl -s "${grafanaapiheaders[@]}" \
		-X DELETE "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${grafanaserviceaccount_id}/tokens/${grafanaserviceaccount_token_id}"
	)

	local result=$(
		jq -e '.message == "Service account token deleted"' <<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: Existing service account token deleted" >> /proc/1/fd/1
	else
		echo -e "${LOG_WARN} Grafana: Existing service account token failed to delete" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		return 1
	fi
}

# TODO: TEST
grafanaserviceaccounttoken_create() {

	local grafanaserviceaccount_id=$1

	local answer=$(
		curl -s "${grafanaapiheaders[@]}" \
		-d "${grafanaserviceaccount_json}" \
		-X POST "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${grafanaserviceaccount_id}/tokens"
	)

	local result=$(
		jq -e 'has("name")' <<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: New service account token created" >> /proc/1/fd/1
		jq <<< "${answer}"
	else
		echo -e "${LOG_ERRO} Grafana: Error creating new service account token" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

if [[ -z "${GRAFANA_SERVICEACCOUNT_TOKEN}" ]]
then
	echo -e "${LOG_INFO} Grafana: No service account token provided in env-file, creating one" >> /proc/1/fd/1

	# Service account
	grafanaserviceaccount=$(
		grafanaserviceaccount_find "${GRAFANA_SERVICEACCOUNT}" || \
		grafanaserviceaccount_create
	)

	grafanaserviceaccount_id=$(
		jq -r .id <<< "${grafanaserviceaccount}"
	)

	[[ $LOG_START ]] && jq <<< "${grafanaserviceaccount}" >> /proc/1/fd/1

	# Token
	grafanaserviceaccount_token=$(
		grafanaserviceaccounttoken_find "${grafanaserviceaccount_id}"
	)

	grafanaserviceaccount_token_objects=$(
		jq length <<< ${grafanaserviceaccount_token}
	)

	# Delete existing tokens | TODO: TEST
	for (( i = 0; i < grafanaserviceaccount_token_objects; i++ ))
	do
		grafanaserviceaccount_token_current=$(
			jq .[$i] <<< "${grafanaserviceaccount_token}"
		)

		grafanaserviceaccount_token_id=$(
			jq -r .[$i].id <<< "${grafanaserviceaccount_token}"
		)

		grafanaserviceaccount_token_deleted=$(
			grafanaserviceaccounttoken_delete "${grafanaserviceaccount_id}" "${grafanaserviceaccount_token_id}"
		)
		
		[[ $LOG_START ]] && jq '. | {id, name, created}' <<< "${grafanaserviceaccount_token_current}" >> /proc/1/fd/1
	done

	# Create a new token | TODO: TEST
	grafanaserviceaccount_token=$(
		grafanaserviceaccounttoken_create "${grafanaserviceaccount_id}"
	)

	export GRAFANA_SERVICEACCOUNT_TOKEN=$(
		jq -r .key <<< "${grafanaserviceaccount_token}"
	)

	# TODO: TEST
	[[ $LOG_START ]] && jq '. | {id, name, key} | .key = "<SECUREKEY>"' <<< "${grafanaserviceaccount_token}" >> /proc/1/fd/1
else
	echo -e "${LOG_SUCC} Grafana: Service account token provided" >> /proc/1/fd/1
fi

# Grafana: API connection
############################################################
# test connection to "http://${GRAFANA_SERVICE}/api/org"
# with "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}"

grafanaapiheaders_token=(
	-H "Accept: application/json"
	-H "Content-Type:application/json"
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}"
)

# i.O.
grafanaapiauthtoken_test() {

	local answer=$(
		curl "${grafanaapiheaders_token[@]}" \
		--progress-bar \
		-X GET "http://${GRAFANA_SERVICE}/api/org"
	)

	local result=$(
		jq -e '. | has("name")' <<< "${answer}"
	)	

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: Service account token valid" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Connection with service account token failed" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

grafanaapiauthtoken_test

# Grafana: Datasources
############################################################
# if datasource does not exist create it

# TODO: TEST
grafanadatasource_search() {

	local dsname=$1
	local answer=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X GET "${GRAFANA_HOST}/api/datasources/name/${dsname}"
	)

	local result=$(
		jq -e --arg name "${dsname}" \
		'.name == $name' \
		<<< "${answer}"
	)	

	local output=$(
		jq -e --arg name "${dsname}" \
		'. | select (.name == $name) | {uid, name, type, url}' \
		<<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: Datasource \"${dsname}\" found" >> /proc/1/fd/1
		jq <<< "${output}"
		return 0
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
		"url":"'"${INFLUX_HOST}"'",
		"jsonData":{"dbName":"'"${bucket}"'","httpMode":"GET","httpHeaderName1":"Authorization"},
		"secureJsonData":{"httpHeaderValue1":"Token '"${INFLUX_TOKEN}"'"},
		"isDefault":true,
		"readOnly":false
	}'

	echo "${result}"
	jq <<< "${result}"
}

# TODO: TEST
grafanadatasource_create() {

	local dsjson=$1
	local dsname=$(
		jq -r .name <<< "${1}"
	)

	local answer=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X POST -d "${dsjson}" "${GRAFANA_HOST}/api/datasources"
	)

	local result=$(
		jq -e --arg name "${dsname}" \
		'.name == $name' \
		<<< "${answer}"
	)	

	local output=$(
		jq -e --arg name "${dsname}" \
		'.datasource | {uid, name, type, url}' \
		<<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: Datasource \"${dsname}\" created" >> /proc/1/fd/1
		jq <<< "${output}"
		return 0
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

[[ $LOG_START ]] && jq <<< "${grafanadatasource_devices}" >> /proc/1/fd/1

# Measurements
grafanadatasource_measurements_json=$(
	grafanadatasource_prepare "${GRAFANA_DATASOURCE_MEASUREMENTS}"
)

grafanadatasource_measurements=$(
	grafanadatasource_search "${GRAFANA_DATASOURCE_MEASUREMENTS}" || \
	grafanadatasource_create "${grafanadatasource_measurements_json}"
)

[[ $LOG_START ]] && jq <<< "${grafanadatasource_measurements}" >> /proc/1/fd/1

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

	if [[ $? -eq 0 ]]; then
		echo -e "${LOG_SUCC} Grafana: Content credentials set" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Failed setting content credentials" >> /proc/1/fd/1
		exit 1
	fi	
}

# i.O.
grafanacontent_move() {
	rm -rf "${grafanacontent_destination}"/*
	mv -f "${grafanacontent_source}"/* "${grafanacontent_destination}"

	if [[ $? -eq 0 ]]; then
		echo -e "${LOG_SUCC} Grafana: Content moved to \"${grafanacontent_destination}\"" >> /proc/1/fd/1
		rm -rf "${grafanacontent_source}"
	else
		echo -e "${LOG_ERRO} Grafana: Failed moving content to \"${grafanacontent_destination}\"" >> /proc/1/fd/1
		exit 1
	fi
}

if [[ -d "${grafanacontent_source}" ]]
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

###### HIER GUT ############

# i.O.
grafanadashfolder_search() {
	local foldername=$1

	local answer=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/search?query=&type=dash-folder"
	)

	local result=$(
		jq -e --arg title "${foldername}" \
		'.[] | select(.title == $title) | .title == $title' \
		<<< "${answer}"
	)

	local output=$(
		jq -e --arg title "${foldername}" \
		'.[] | select(.title == $title) | {uid, title, url}' \
		<<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: Folder \"${foldername}\" found" >> /proc/1/fd/1
		jq <<< "${output}"
		return 0
	else
		echo -e "${LOG_WARN} Grafana: Folder \"${foldername}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
grafanadashfolder_create() {
	local foldername=$1

	local answer=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X POST -d '{"title": "'"${foldername}"'"}' "http://${GRAFANA_SERVICE}/api/folders"
	)

	local result=$(
		jq -e --arg title "${foldername}" \
		'.title == $title' \
		<<< "${answer}"
	)

	local output=$(
		jq -e --arg title "${foldername}" \
		'. | {uid, title, url}' \
		<<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: Folder \"${foldername}\" created" >> /proc/1/fd/1
		jq <<< "${output}"
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Error creating folder \"${foldername}\"" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

grafanadashfolder=$(
	grafanadashfolder_search "${GRAFANA_DASHFOLDER_NAME}" || \
	grafanadashfolder_create "${GRAFANA_DASHFOLDER_NAME}"
)

export GRAFANA_FOLDER_UID=$(
	jq -r '.uid' <<< "${grafanadashfolder}"
)

[[ $LOG_START ]] && jq <<< "${grafanadashfolder}" >> /proc/1/fd/1

# Grafana: Dashboards
############################################################
# if dashbaord does not exist
# load dshboard-json, prepare and upload it

# i.O.
grafanadashboard_find() {

	local uid=$1

	local answer=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/search?query=&dashboardUIDs=${uid}"
	)

	local result=$(
		jq -e --arg uid "${uid}" \
		'.[].uid == $uid' \
		<<< "${answer}"
	)

	local output=$(
		jq -e --arg title "${uid}" \
		'.[] | {uid, title, url}' \
		<<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: Dashboard \"${uid}\" found" >> /proc/1/fd/1
		jq <<< "${output}"
		return 0
	else
		echo -e "${LOG_WARN} Grafana: Dashboard \"${uid}\" not found" >> /proc/1/fd/1
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

	local output=$(
		jq --argjson dashboard "${filecontent}" \
		'.dashboard = $dashboard' \
		<<< "${jsondata}"
	)

	if [[ -n "${output}" ]]; then
		echo -e "${LOG_SUCC} Grafana: Dashboard \"${file}\" prepared for upload" >> /proc/1/fd/1
		jq <<< "${output}"
	else
		echo -e "${LOG_ERRO} Grafana: Failed preparing dashboard \"${file}\" for upload" >> /proc/1/fd/1
		jq <<< "${jsondata}" >> /proc/1/fd/1
		exit 1
	fi	
}

# i.O.
grafanadashboard_create() {

	local jsondata=$1

	local answer=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X POST -d "${jsondata}" "http://${GRAFANA_SERVICE}/api/dashboards/db"
	)

	local result=$(
		jq -e '.status == "success"' <<< "${answer}"
	)

	if [[ "${result}" == "true" ]]; then
		echo -e "${LOG_SUCC} Grafana: Dashboard uploaded" >> /proc/1/fd/1
		jq <<< "${result}"
		return 0
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

# Test
if [[ -z "${grafanadashboard_home_exists}" ]]
then
	grafanadashboard_home_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_HOME}"
	)

	grafanadashboard_home=$(
		grafanadashboard_create "${grafanadashboard_home_json}"
	)

	[[ $LOG_START ]] && jq '.' <<< "${grafanadashboard_home}" >> /proc/1/fd/1
fi

# Devices
grafanadashboard_devices_exists=$(
	grafanadashboard_find "${GRAFANA_DASHBOARD_UID_DEVICES}"
)

# Test
if [[ -z "${grafanadashboard_devices_exists}" ]]
then
	grafanadashboard_devices_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_DEVICES}"
	)

	grafanadashboard_devices=$(
		grafanadashboard_create "${grafanadashboard_devices_json}"
	)

	[[ $LOG_START ]] && jq '.' <<< "${grafanadashboard_devices}" >> /proc/1/fd/1	
fi

# Timer
grafanadashboard_timer_exists=$(
	grafanadashboard_find "${GRAFANA_DASHBOARD_UID_TIMER}"
)

# Test
if [[ -z "${grafanadashboard_timer_exists}" ]]
then
	grafanadashboard_timer_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_TIMER}"
	)

	grafanadashboard_timer=$(	
		grafanadashboard_create "${grafanadashboard_timer_json}"
	)

	[[ $LOG_START ]] && jq '.' <<< "${grafanadashboard_timer}" >> /proc/1/fd/1
fi

# Standby
grafanadashboard_standby_exists=$(
	grafanadashboard_find "${GRAFANA_DASHBOARD_UID_STANDBY}"
)

# TODO: log
if [[ -z "${grafanadashboard_standby_exists}" ]]
then
	grafanadashboard_standby_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_STANDBY}"
	)

	grafanadashboard_standby=$(	
		grafanadashboard_create "${grafanadashboard_standby_json}"
	)

	[[ $LOG_START ]] && jq '.' <<< "${grafanadashboard_standby}" >> /proc/1/fd/1
fi

# Measurements
grafanadashboard_measurements_exists=$(
	grafanadashboard_find "${GRAFANA_DASHBOARD_UID_MEASUREMENTS}"
)

# Test
if [[ -z "${grafanadashboard_measurements_exists}" ]]
then
	grafanadashboard_measurements_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_MEASUREMENTS}"
	)

	grafanadashboard_measurements=$(	
		grafanadashboard_create "${grafanadashboard_measurements_json}"
	)

	[[ $LOG_START ]] && jq '.' <<< "${grafanadashboard_measurements}" >> /proc/1/fd/1
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