#!/bin/bash
# write
# some
# things
# here



# NanoHome Environment         
############################################################

export ROOTPATH="/opt/nanohome"
export GRAFANA_FOLDER_NAME="nanohome"
export GRAFANA_DASHBOARD_UID_HOME="XieEaLmRk"
export GRAFANA_DASHBOARD_FILE_HOME="./templates/home.json"
export GRAFANA_DASHBOARD_UID_DEVICES="fe47pva0wy8lcb"
export GRAFANA_DASHBOARD_FILE_DEVICES="./templates/devices.json"
export GRAFANA_DASHBOARD_UID_TIMER="ae489b6q64nwgf"
export GRAFANA_DASHBOARD_FILE_TIMER="./templates/timer.json"
export GRAFANA_DASHBOARD_UID_STANDBY="adjak60hekvswd"
export GRAFANA_DASHBOARD_FILE_STANDBY="./templates/standby.json"
export GRAFANA_DASHBOARD_UID_MEASUREMENTS="ee8v5d70ojpj4b"
export GRAFANA_DASHBOARD_FILE_MEASUREMENTS="./templates/measurements.json"
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

LOG_INFO="[${LOG_BLU}Information${LOG_NOC}]"
LOG_SUCC="[${LOG_GRN}Success${LOG_NOC}]"
LOG_WARN="[${LOG_YLW}Warning${LOG_NOC}]"
LOG_ERRO="[${LOG_RED}Error${LOG_NOC}]"

# InfluxDB: Config
############################################################
# Check if influx configuration exists, create it if not

check_influxconfig() {

	local result=$(
		influx config list --json | \
		jq -e ."${INFLUXDB_CONFIG}"
	)

	if [ "${result}" != "null" ]
	then
		echo -e "${LOG_SUCC} Influx CLI: Config \"${INFLUXDB_CONFIG}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_INFO} Influx CLI: Config \"${INFLUXDB_CONFIG}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

create_influxconfig() {

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
		echo -e "${LOG_SUCC} Influx CLI: Config \"${INFLUXDB_CONFIG}\" created" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} Influx CLI: Config \"${INFLUXDB_CONFIG}\" failed to create" >> /proc/1/fd/1
		exit 1
	fi
}

influxconfig=$(
	check_influxconfig || create_influxconfig
)

[ $LOG_DEBUG ] && \
jq '.token = "<SECURETOKEN>"' <<< "${influxconfig}" \
>> /proc/1/fd/1

# InfluxDB: Buckets
############################################################
# Check if buckets exists, create it if not

get_influxbucket() {

	local bucket=$1
	local result=$(
		influx bucket list \
		--json | \
		jq -e --arg name "${bucket}" \
		'.[] | select(.name == $name)'
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCC} InfluxDB: Bucket \"${bucket}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_WARN} InfluxDB: Bucket \"${bucket}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

create_influxbucket() {

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
		echo -e "${LOG_SUCC} InfluxDB: Bucket \"${bucket}\" created" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} InfluxDB: Bucket \"${bucket}\" failed to create" >> /proc/1/fd/1
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

get_influxauthtoken() {

	local description=$1
	local answer=$(
		influx auth list \
		--json | \
		jq -e --arg description "${description}" \
		'[.[] | select(.description == $description)]'
	)

	local result=$(
		jq length <<< "${answer}"
	)

	if [ "$result" -gt 0 ]
	then
		jq <<< "${answer}"
	else
		echo "[]"
	fi
}

check_influxauthtoken_permissions() {

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
		echo -e "${LOG_SUCC} InfluxDB: Auth token \"${INFLUXDB_SATOKEN_DESCRIPTION}\" found with correct permissions" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_WARN} InfluxDB: Auth token \"${INFLUXDB_SATOKEN_DESCRIPTION}\" found with missing permissions" >> /proc/1/fd/1
		return 1
	fi
}

delete_influxauthtoken() {

	local id=$1
	local result=$(
		influx auth delete --id "${id}" --json | \
		jq -e
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCC} InfluxDB: Auth token removed" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_WARN} InfluxDB: Auth token failed to remove" >> /proc/1/fd/1
		return 1
	fi
}

create_influxauthtoken() {

	local result=$(
		influx auth create \
		--description "${INFLUXDB_SATOKEN_DESCRIPTION}" \
		--org "${INFLUXDB_ORG}" \
		--read-bucket "${INFLUXBUCKET_DEVICES_ID}" \
		--read-bucket "${INFLUXBUCKET_MEASUREMENTS_ID}" \
		--json | \
		jq -e
	)

	if [ "${result}" != "" ]
	then
		echo -e "${LOG_SUCC} InfluxDB: Auth token \"${INFLUXDB_SATOKEN_DESCRIPTION}\" created" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} InfluxDB: Auth token \"${INFLUXDB_SATOKEN_DESCRIPTION}\" failed to create" >> /proc/1/fd/1
		exit 1
	fi	
}

influxauth_token=$(
	get_influxauthtoken "${INFLUXDB_SATOKEN_DESCRIPTION}"
)

influxauth_token_objects=$(
	jq length <<< "${influxauth_token}"
)

# One token found
if [ "$influxauth_token_objects" -eq 1 ]
then
	if ( check_influxauthtoken_permissions "${current_influxauth_token}" )
	then
		export INFLUXDB_ROTOKEN=$(
			jq -r '.[].token' <<< "${influxauth_token}"
		)

		[ $LOG_DEBUG ] && \
		jq '. | {id, description, token, permissions} | .token = "<SECURETOKEN>"' <<< "${current_influxauth_token}" \
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
			jq -r .[$i].id <<< "${influxauth_token}"
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

# TODO: Check connection with credentials

grafanaserviceaccount_json=\
'{
	"name": "'"${GRAFANA_SERVICEACCOUNT}"'",
	"role": "Admin",
	"isDisabled": false
}'

# i.O.
get_grafanaserviceaccount() {

	local account=$1
	local answer=$(
		curl "${grafanaapiheaders[@]}" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_ADMINPASS}@${GRAFANA_SERVICE}/api/serviceaccounts/search?query=${account}"
	)
	local result=$(
		jq -e '.serviceAccounts[].name' <<< "${answer}"
	)

	if [ -n "${result}" ]
	then
		echo -e "${LOG_SUCC} Grafana: Service account \"${account}\" found" >> /proc/1/fd/1
		jq '.serviceAccounts[]' <<< "${answer}"
	else
		echo -e "${LOG_WARN} Grafana: Service account \"${account}\" not found" >> /proc/1/fd/1
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

# TODO: Check connection with token

grafanaapiheaders_token=(
	-s
	-H "Accept: application/json"
	-H "Content-Type:application/json"
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}"
)

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
		return 1
	fi
}

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

# TODO: Copy content to persistent storage / if dest exist > do nothing

# Set credentials in grafana content
# sed -i 's#var user = \\\"\\\"#var user = \\\"'${MQTT_USER}'\\\"#' ./grafana-content/js/mqttconfig.js
# sed -i 's#var pwd = \\\"\\\"#var pwd = \\\"'${MQTT_PASSWORD}'\\\"#' ./grafana-content/js/mqttconfig.js


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
		return 1
	fi
}

grafanafolder=$(
	get_grafanafolder || \
	create_grafanafolder
)

[ $LOG_DEBUG ] && \
jq '. | {uid, title, url}' <<< "${grafanafolder}" \
>> /proc/1/fd/1

# Grafana: Dashboards
############################################################
# TODO: error
# {
#   "message": "bad request data",
#   "traceID": ""
# }
# TODO: json anpassen, damit es hochgeladen werden kann

get_grafanadashboard() {

	local uid=$1
	local result=$(
		curl "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/search?query=&dashboardUIDs=${uid}" | \
		jq -e
	)

	local result_length=$(
		jq length <<< "${result}"
	)

	if [ "$result_length" -ne 0 ]
	then
		echo -e "${LOG_SUCC} Grafana: Dashboard \"${uid}\" found" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_WARN} Grafana: Dashboard \"${uid}\" not found" >> /proc/1/fd/1
		return 1
	fi	
}

# TODO
load_grafanadashboard_json() {

	local dashboard=$1
	local result=$(
		# TODO
	)

	

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCC} Grafana: Dashboard json \"${dashboard}\" loaded" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} Grafana: Loading dashboard json \"${dashboard}\" failed" >> /proc/1/fd/1
		return 1
	fi	
}

# TODO
merge_grafanadashboard_html() {

	local dashboard=$1
	local result=$(
		# TODO
	)

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCC} Grafana: Dashboard html \"${dashboard}\" loaded" >> /proc/1/fd/1
		jq <<< "${result}"
	else
		echo -e "${LOG_ERRO} Grafana: Loading dashboard html \"${dashboard}\" failed" >> /proc/1/fd/1
		return 1
	fi	
}

# TODO
set_grafanadashboard_json() {
	
	local title=$1
	local folderuid=$2
	local json=$3

	local result='{
		"dashboard": "'"${json}"'",
		"folderUid": "'"${folderuid}"'",
		"message": "Initial upload",
		"overwrite": true
	}'

	jq <<< "${result}"
}

# TODO
create_grafanadashboard() {

	local jsonfile=$1

	curl \
		-s \
		-H "Accept: application/json" \
		-H "Content-Type:application/json" \
		-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}" \
		-X POST -d @"${jsonfile}" "http://${GRAFANA_SERVICE}/api/dashboards/db" \
		| jq -e

	if [ $? -eq 0 ]
	then
		echo -e "${LOG_SUCC} Grafana: Dashboard \"${jsonfile}\" uploaded" >> /proc/1/fd/1
	else
		echo -e "${LOG_ERRO} Grafana: Dashboard uploading \"${jsonfile}\" failed" >> /proc/1/fd/1
		return 1
	fi	
}

## Home
#  grafanadashboard_home=$(
# 	get_grafanadashboard "${GRAFANA_DASHBOARD_UID_HOME}" || \
# 	create_grafanadashboard "${GRAFANA_DASHBOARD_FILE_HOME}"
# )
#
## Devices
# grafanadashboard_devices=$(
#	get_grafanadashboard "${GRAFANA_DEVICES_UID}" || \
#	create_grafanadashboard "${GRAFANA_DEVICES_FILE}"
#)
#
## Timer
# grafanadashboard_timer=$(
#	get_grafanadashboard "${GRAFANA_TIMER_UID}" || \
#	create_grafanadashboard "${GRAFANA_TIMER_FILE}"
#)
#
## Standby
# grafanadashboard_standby=$(
#	get_grafanadashboard "${GRAFANA_STANDBY_UID}" || \
#	create_grafanadashboard "${GRAFANA_STANDBY_FILE}"
#)
#
## Measurements
# grafanadashboard_measurements=$(
#	get_grafanadashboard "${GRAFANA_MEASUREMENTS_UID}" || \
#	create_grafanadashboard "${GRAFANA_MEASUREMENTS_FILE}"
#)

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
