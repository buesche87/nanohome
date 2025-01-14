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

LOG_INFO="[${LOG_BLU}Info${LOG_NOC}]"
LOG_SUCC="[${LOG_GRN}Success${LOG_NOC}]"
LOG_WARN="[${LOG_YLW}Warning${LOG_NOC}]"
LOG_ERRO="[${LOG_RED}Error${LOG_NOC}]"

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
# Check if influx configuration exists, create it if not

# i.O.
check_influxconfig() {

	local answer=$(
		influx config list --json
	)

	local result=$(
		jq -e ."${INFLUXDB_CONFIG}" \
		<<< ${answer}
	)

	if [ "${result}" != "null" ]
	then
		echo -e "${LOG_SUCC} Influx CLI: Config \"${INFLUXDB_CONFIG}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_INFO} Influx CLI: Config \"${INFLUXDB_CONFIG}\" not found" >> /proc/1/fd/1
		jq <<< "${result}" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
create_influxconfig() {

	local result=$(
		influx config create \
		--config-name "${INFLUXDB_CONFIG}" \
		--host-url "http://${INFLUXDB_SERVICE}" \
		--org "${INFLUXDB_ORG}" \
		--token "${INFLUXDB_ADMINTOKEN}" \
		--active \
		--json
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCC} Influx CLI: Config \"${INFLUXDB_CONFIG}\" created" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} Influx CLI: Config \"${INFLUXDB_CONFIG}\" failed to create" >> /proc/1/fd/1
		jq <<< "${result}" >> /proc/1/fd/1
		exit 1
	fi
}

# i.O.
test_influxconfig() {

	local answer=$(
		influx org list \
		--json
	)

	local result=$(
		jq -e '.[] | {id, name}' \
		<<< "${answer}"
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCC} InfluxDB: Connection successful" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} InfluxDB: Connection failed" >> /proc/1/fd/1
		jq <<< "${result}" >> /proc/1/fd/1
		exit 1
	fi	
}

influxconfig=$(
	check_influxconfig || create_influxconfig
)

test_influxconfig

[ $LOG_DEBUG ] && \
jq '.token = "<SECURETOKEN>"' <<< "${influxconfig}" \
>> /proc/1/fd/1

# InfluxDB: Buckets
############################################################
# Check if buckets exists, create it if not

# i.O.
get_influxbucket() {

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
		jq <<< "${result}" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
create_influxbucket() {
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
	get_influxbucket "${INFLUXDB_BUCKET_DEVICES}" || \
	create_influxbucket "${INFLUXDB_BUCKET_DEVICES}"
)

export INFLUXBUCKET_DEVICES_ID=$(
	jq -r '.id' <<< "${influxbucket_devices}"
)

[ $LOG_DEBUG ] && \
jq '. | {id, name, createdAt}' <<< "${influxbucket_devices}" \
>> /proc/1/fd/1

# Measurements
influxbucket_measurements=$(
	get_influxbucket "${INFLUXDB_BUCKET_MEASUREMENTS}" || \
	create_influxbucket "${INFLUXDB_BUCKET_MEASUREMENTS}"
)

export INFLUXBUCKET_MEASUREMENTS_ID=$(
	jq -r '.id' <<< "${influxbucket_measurements}"
)

[ $LOG_DEBUG ] && \
jq '. | {id, name, createdAt}' <<< "${influxbucket_measurements}" \
>> /proc/1/fd/1

# InfluxDB: Auth token for Grafana datasource
############################################################
# Search for active token
# If found, check for correct permissions
# If multiple found, delte and recreate them
# If none found, create oone

# i.O.
get_influxauthtoken() {
	local description=$1

	local answer=$(
		influx auth list \
		--json
	)

	local result=$(
		jq -e --arg description "${INFLUXDB_SATOKEN_DESCRIPTION}" \
		'[.[] | select(.description == $description)]' \
		<<< "${answer}"
	)

	jq <<< "${result}"
}

# i.O.
check_influxauthtoken_permissions() {
	local current_influxauth_token=$1

	local result=$(
		jq -e \
		--arg val1 "${INFLUXBUCKET_DEVICES_ID}" \
		--arg val2 "${INFLUXBUCKET_MEASUREMENTS_ID}" \
		'[.[].permissions[]] | contains([$val1, $val2])' \
		<<< "${current_influxauth_token}"
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
delete_influxauthtoken() {
	local current_influxauth_token_id=$1

	local result=$(
		influx auth delete \
		--id "${current_influxauth_token_id}" \
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
create_influxauthtoken() {

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

current_influxauth_token=$(
	get_influxauthtoken
)

influxauth_token_objects=$(
	jq length <<< "${current_influxauth_token}"
)

# One token found
if [ "$influxauth_token_objects" -eq 1 ]
then
	if ( check_influxauthtoken_permissions "${current_influxauth_token}" )
	then
		export INFLUXDB_ROTOKEN=$(
			jq -r '.[].token' <<< "${current_influxauth_token}"
		)

		[ $LOG_DEBUG ] && \
		jq '.[] | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${current_influxauth_token}" \
		>> /proc/1/fd/1
	else
		current_influxauth_token_id=$(
			jq -r '.[].id' <<< "${current_influxauth_token}"
		)

		deleted_influxauth_token=$(
			delete_influxauthtoken "${current_influxauth_token_id}"
		)

		influxauth_token_objects=0

		[ $LOG_DEBUG ] && \
		jq '. | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${deleted_influxauth_token}" \
		>> /proc/1/fd/1
	fi
fi

# Multiple tokens found
if [ "$influxauth_token_objects" -gt 1 ]
then
	echo -e "${LOG_WARN} InfluxDB: Multiple auth token \"${INFLUXDB_SATOKEN_DESCRIPTION}\" found" >> /proc/1/fd/1

	for (( i = 0; i < influxauth_token_objects; i++ ))
	do
		current_influxauth_token_id=$(
			jq -r .[$i].id <<< "${current_influxauth_token}"
		)

		deleted_influxauth_token=$(
			delete_influxauthtoken "${current_influxauth_token_id}"
		)

		[ $LOG_DEBUG ] && \
		jq '. | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${deleted_influxauth_token}" \
		>> /proc/1/fd/1
	done

	influxauth_token_objects=0
fi

# No token found
if [ "$influxauth_token_objects" -eq 0 ]
then
	echo -e "${LOG_WARN} InfluxDB: No suitable auth token found" >> /proc/1/fd/1

	new_influxauth_token=$(
		create_influxauthtoken "${INFLUXBUCKET_DEVICES_ID}" "${INFLUXBUCKET_MEASUREMENTS_ID}"
	)

	export INFLUXDB_ROTOKEN=$(
		jq -r '.token' <<< "${new_influxauth_token}"
	)

	[ $LOG_DEBUG ] && \
	jq '. | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${new_influxauth_token}" \
	>> /proc/1/fd/1
fi

# Grafana: Service account 
############################################################
# If no access token specified in env file
# Check if service account and token exist
# Create a service account if needed
# Recreate auth token

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

# TODO: Wenn Result leer ist / wenn Result "null" enthält
check_grafanaapiconnection() {

	local answer=$(
		curl "${grafanaapiheaders[@]}" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/org"
	)

	local result=$(
		jq -e 'has("name")' <<< "${answer}"
	)	

	if [ "${result}" = "true" ]
	then
		echo -e "${LOG_SUCC} Grafana: Basic auth connection successful" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Basic auth connection failed" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

# i.O.
get_grafanaserviceaccount() {

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
create_grafanaserviceaccount() {

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
get_grafanaserviceaccount_token() {

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
delete_grafanaserviceaccount_token() {

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
create_grafanaserviceaccount_token() {

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

check_grafanaapiconnection

if [ -z "${GRAFANA_SERVICEACCOUNT_TOKEN}" ]
then
	echo -e "${LOG_INFO} Grafana: No service account token provided in env-file" >> /proc/1/fd/1

	# Service account
	grafanaserviceaccount=$(
		get_grafanaserviceaccount "${GRAFANA_SERVICEACCOUNT}" || \
		create_grafanaserviceaccount
	)

	grafanaserviceaccount_id=$(
		jq -r .id <<< "${grafanaserviceaccount}"
	)

	[ $LOG_DEBUG ] && \
	jq '. | {name, login, role}' <<< "${grafanaserviceaccount}" \
	>> /proc/1/fd/1

	# Token
	grafanaserviceaccount_token=$(
		get_grafanaserviceaccount_token "${grafanaserviceaccount_id}"
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
			delete_grafanaserviceaccount_token "${grafanaserviceaccount_id}" "${grafanaserviceaccount_token_id}"
		)
		
		[ $LOG_DEBUG ] && \
		jq '.[] | {id, name, created}' <<< "${grafanaserviceaccount_token}" \
		>> /proc/1/fd/1
	done

	# Create a new token
	grafanaserviceaccount_token=$(
		create_grafanaserviceaccount_token "${grafanaserviceaccount_id}"
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

# Grafana: Datasources
############################################################
# If datasource does not exist, create it

grafanaapiheaders_token=(
	-s
	-H "Accept: application/json"
	-H "Content-Type:application/json"
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}"
)

# i.O.
check_grafanaapiconnection_token() {

	local answer=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/org"
	)

	local result=$(
		jq -e 'has("name")' <<< "${answer}"
	)	

	if ( $result )
	then
		echo -e "${LOG_SUCC} Grafana: Token connection successful" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Token connection failed" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

# i.O.
set_grafanadatasource_json() {

	local bucket=$1
	local result='{
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

# i.O.
get_grafanadatasource() {

	local dsname=$1
	local answer=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/datasources/name/${dsname}"
	)
	local result=$(
		jq -e '.type == "influxdb"' <<< "${answer}"
	)

	if ( $result )
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
create_grafanadatasource() {

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
	
	if ( $result )
	then
		echo -e "${LOG_SUCC} Grafana: Datasource \"${dsname}\" created" >> /proc/1/fd/1
		jq -e '.datasource' <<< "${answer}"
	else
		echo -e "${LOG_ERRO} Grafana: Error creating datasource \"${dsname}\"" >> /proc/1/fd/1
		jq <<< "${answer}" >> /proc/1/fd/1
		exit 1
	fi
}

check_grafanaapiconnection_token

# Devices
grafanadatasource_devices_json=$(
	set_grafanadatasource_json "${GRAFANA_DATASOURCE_DEVICES}"
)

grafanadatasource_devices=$(
	get_grafanadatasource "${GRAFANA_DATASOURCE_DEVICES}" || \
	create_grafanadatasource "${grafanadatasource_devices_json}"
)

[ $LOG_DEBUG ] && \
jq '. | {uid, name, type, url, jsonData, secureJsonFields}' <<< "${grafanadatasource_devices}" \
>> /proc/1/fd/1

# Measurements
grafanadatasource_measurements_json=$(
	set_grafanadatasource_json "${GRAFANA_DATASOURCE_MEASUREMENTS}"
)

grafanadatasource_measurements=$(
	get_grafanadatasource "${GRAFANA_DATASOURCE_MEASUREMENTS}" || \
	create_grafanadatasource "${grafanadatasource_measurements_json}"
)

[ $LOG_DEBUG ] && \
jq '. | {uid, name, type, url, jsonData, secureJsonFields}' <<< "${grafanadatasource_measurements}" \
>> /proc/1/fd/1

# Grafana: Content
############################################################
# Check if content on bind mounted volume exists, if not
# - Modify mqtt credentials for mqtt js client
# - Copy grafana public content to bind mounted volume

grafanacontent_source="${NANOHOME_ROOTPATH}/grafana-content"
grafanacontent_destination="${NANOHOME_ROOTPATH}/data/grafana"

# i.O.
modify_grafanacontent() {
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
move_grafanacontent() {
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

	modify_grafanacontent
	move_grafanacontent
else
	echo -e "${LOG_INFO} Grafana: Content \"${grafanacontent_destination}\" already created" >> /proc/1/fd/1
fi

# Grafana: Dashboard folder
############################################################
# Create the dashboard folder if it does not exist

# i.O.
get_grafanafolder() {

	local answer=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/search?query=&type=dash-folder"
	)

	local result=$(
		jq -e ".[] | select(.title==\"${GRAFANA_FOLDER_NAME}\")" <<< "${answer}"
	)

	if [ "${result}" ]
	then
		echo -e "${LOG_SUCC} Grafana: Folder \"${GRAFANA_FOLDER_NAME}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_WARN} Grafana: Folder \"${GRAFANA_FOLDER_NAME}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

# i.O.
create_grafanafolder() {

	local result=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X POST -d '{"title": "'"${GRAFANA_FOLDER_NAME}"'"}' "http://${GRAFANA_SERVICE}/api/folders"
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCC} Grafana: Folder \"${GRAFANA_FOLDER_NAME}\" created" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} Grafana: Error creating folder \"${GRAFANA_FOLDER_NAME}\"" >> /proc/1/fd/1
		exit 1
	fi
}

grafanafolder=$(
	get_grafanafolder || \
	create_grafanafolder
)

export GRAFANA_FOLDER_UID=$(
	jq -r '.uid' <<< "${grafanafolder}"
)

[ $LOG_DEBUG ] && \
jq '. | {uid, title, url}' <<< "${grafanafolder}" \
>> /proc/1/fd/1

# Grafana: Dashboards
############################################################
# Check if dashbaord exists, if not
# - Load dshboards and prepare json for upload
# - Upload dashboards

# i.O.
check_grafanadashboard() {

	local uid=$1
	local answer=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/search?query=&dashboardUIDs=${uid}"
	)

	local result=$(
		jq -e '.[] | {id, name}' <<< "${answer}"
	)

	if [ "${result}" != "" ]
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
prepare_grafanadashboard() {

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

	if [ "${result}" != "" ]
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
create_grafanadashboard() {

	local jsondata=$1
	local answer=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X POST -d "${jsondata}" "http://${GRAFANA_SERVICE}/api/dashboards/db"
	)

	local result=$(
		jq -e '. | select(.status == "success")' <<< "${answer}"
	)

	if [ "${result}" != "" ]
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
	check_grafanadashboard "${GRAFANA_DASHBOARD_UID_HOME}"
)

if [ "${grafanadashboard_home_exists}" == "" ]
then
	grafanadashboard_home_json=$(
		prepare_grafanadashboard "${GRAFANA_DASHBOARD_FILE_HOME}"
	)

	grafanadashboard_home=$(
		create_grafanadashboard "${grafanadashboard_home_json}"
	)

	[ $LOG_DEBUG ] && \
	jq '.' <<< "${grafanadashboard_home}" \
	>> /proc/1/fd/1
fi

# Devices
grafanadashboard_devices_exists=$(
	check_grafanadashboard "${GRAFANA_DASHBOARD_UID_DEVICES}"
)

if [ "${grafanadashboard_devices_exists}" == "" ]
then
	grafanadashboard_devices_json=$(
		prepare_grafanadashboard "${GRAFANA_DASHBOARD_FILE_DEVICES}"
	)

	grafanadashboard_devices=$(
		create_grafanadashboard "${grafanadashboard_devices_json}"
	)

	[ $LOG_DEBUG ] && \
	jq '.' <<< "${grafanadashboard_devices}" \
	>> /proc/1/fd/1	
fi

# Timer
grafanadashboard_timer_exists=$(
	check_grafanadashboard "${GRAFANA_DASHBOARD_UID_TIMER}"
)

if [ "${grafanadashboard_timer_exists}" == "" ]
then
	grafanadashboard_timer_json=$(
		prepare_grafanadashboard "${GRAFANA_DASHBOARD_FILE_TIMER}"
	)

	grafanadashboard_timer=$(	
		create_grafanadashboard "${grafanadashboard_timer_json}"
	)

	[ $LOG_DEBUG ] && \
	jq '.' <<< "${grafanadashboard_timer}" \
	>> /proc/1/fd/1
fi

# Standby
grafanadashboard_standby_exists=$(
	check_grafanadashboard "${GRAFANA_DASHBOARD_UID_STANDBY}"
)

if [ "${grafanadashboard_standby_exists}" == "" ]
then
	grafanadashboard_standby_json=$(
		prepare_grafanadashboard "${GRAFANA_DASHBOARD_FILE_STANDBY}"
	)

	grafanadashboard_standby=$(	
		create_grafanadashboard "${grafanadashboard_standby_json}"
	)

	[ $LOG_DEBUG ] && \
	jq '.' <<< "${grafanadashboard_standby}" \
	>> /proc/1/fd/1
fi

# Measurements
grafanadashboard_measurements_exists=$(
	check_grafanadashboard "${GRAFANA_DASHBOARD_UID_MEASUREMENTS}"
)

if [ "${grafanadashboard_measurements_exists}" == "" ]
then
	grafanadashboard_measurements_json=$(
		prepare_grafanadashboard "${GRAFANA_DASHBOARD_FILE_MEASUREMENTS}"
	)

	grafanadashboard_measurements=$(	
		create_grafanadashboard "${grafanadashboard_measurements_json}"
	)

	[ $LOG_DEBUG ] && \
	jq '.' <<< "${grafanadashboard_measurements}" \
	>> /proc/1/fd/1
fi


# Mosquitto: 
############################################################
# TODO: Passwörter






# Nanohome: Services
############################################################

crond -f &

/bin/bash /opt/nanohome/services/mqtt_shell -s &
/bin/bash /opt/nanohome/services/devwatcher_shelly_legacy &
# /bin/bash /opt/nanohome/services/devwatcher_shelly_plus &
/bin/bash /opt/nanohome/services/measurements_shelly_legacy &
# /bin/bash /opt/nanohome/services/measurements_shelly_plus &
#/bin/bash /opt/nanohome/services/standby_shelly_plus &

exec bash
