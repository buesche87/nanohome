#!/bin/bash
#===============================================================
# Nanohome Environment		 
#===============================================================

# Nanohome general
export NANOHOME_ROOTPATH="/nanohome"
export NANOHOME_CRONTABS="/etc/crontabs/root"

# Nanohome services
export NANOHOME_MEASUREMENTS_LEGACY_INTERVAL=30 # interval in seconds
export NANOHOME_NOT_MONITORED_COMPONENTS="input:0,input:1,ble,cloud,mqtt,sys,wifi,ws,status,ht_ui"
export NANOHOME_NOT_MONITORED_COMPONENTS_LEGACY="input,input_event"
export NANOHOME_SHELL_ALLOWED_COMMANDS="create_panel,create_timer,create_standby,clear_measurement,remove_standby,remove_component,remove_device"

# MQTT topics for nanohome
export MQTT_TOPIC_DEVICES="nanohome/devices"
export MQTT_TOPIC_STANDBY="nanohome/standby"
export MQTT_TOPIC_TIMER="nanohome/timer"
export MQTT_TOPIC_CMDINPUT="nanohome/shell/input"
export MQTT_TOPIC_CMDOUTPUT="nanohome/shell/output"

# InfluxDB settings
export INFLUX_BUCKET_DEVICES="Devices" # Must begin with capital letter
export INFLUX_BUCKET_MEASUREMENTS="Measurements" # Must begin with capital letter

# Grafana panel template settings
export GRAFANA_PANEL_TEMPLATE_SWITCH_HTML="${NANOHOME_ROOTPATH}/grafana-templates/shelly_button.html"
export GRAFANA_PANEL_TEMPLATE_SWITCH_HTML_LEGACY="${NANOHOME_ROOTPATH}/grafana-templates/shelly_button_legacy.html"
export GRAFANA_PANEL_TEMPLATE_SWITCH_JSON="${NANOHOME_ROOTPATH}/grafana-templates/shelly_button.json"
export GRAFANA_PANEL_TEMPLATE_COVER_HTML="${NANOHOME_ROOTPATH}/grafana-templates/shelly_slider.html"
export GRAFANA_PANEL_TEMPLATE_COVER_HTML_LEGACY="${NANOHOME_ROOTPATH}/grafana-templates/shelly_slider_legacy.html"
export GRAFANA_PANEL_TEMPLATE_COVER_JSON="${NANOHOME_ROOTPATH}/grafana-templates/shelly_slider.json"

#===============================================================
# Script Variables		
#===============================================================

# InfluxDB settings
INFLUX_ROTOKEN_DESCRIPTION="nanohome grafana ro-token"

# Grafana general settings
GRAFANA_SERVICE=$(echo "$GRAFANA_HOST" | sed -E 's|^https?://||')
GRAFANA_DATASOURCE_DEVICES="Devices"
GRAFANA_DATASOURCE_MEASUREMENTS="Measurements"
GRAFANA_DASHFOLDER_NAME="nanohome"

# Grafana dashboard template settings
GRAFANA_DASHBOARD_UID_HOME="XieEaLmRk"
GRAFANA_DASHBOARD_FILE_HOME="${NANOHOME_ROOTPATH}/grafana-templates/home.json"
GRAFANA_DASHBOARD_UID_DEVICES="fe47pva0wy8lcb"
GRAFANA_DASHBOARD_FILE_DEVICES="${NANOHOME_ROOTPATH}/grafana-templates/devices.json"
GRAFANA_DASHBOARD_UID_TIMER="ae489b6q64nwgf"
GRAFANA_DASHBOARD_FILE_TIMER="${NANOHOME_ROOTPATH}/grafana-templates/timer.json"
GRAFANA_DASHBOARD_UID_STANDBY="adjak60hekvswd"
GRAFANA_DASHBOARD_FILE_STANDBY="${NANOHOME_ROOTPATH}/grafana-templates/standby.json"
GRAFANA_DASHBOARD_UID_MEASUREMENTS="ee8v5d70ojpj4b"
GRAFANA_DASHBOARD_FILE_MEASUREMENTS="${NANOHOME_ROOTPATH}/grafana-templates/measurements.json"

# Mosquitto
MQTT_CONNECTION_STRING=(
	-h "${MQTT_SERVER}"
	-u "${MQTT_USER}"
	-P "${MQTT_PASSWORD}"
)

#===============================================================
# Logging	  
#===============================================================

LOG_BLU="\033[1;36m"
LOG_GRN="\033[1;32m"
LOG_YLW="\033[1;93m"
LOG_RED="\033[1;31m"
LOG_NOC="\033[0m"

export LOG_INFO="[${LOG_BLU}Verbose${LOG_NOC}]"
export LOG_SUCC="[${LOG_GRN}Success${LOG_NOC}]"
export LOG_WARN="[${LOG_YLW}Warning${LOG_NOC}]"
export LOG_ERRO="[${LOG_RED}-Error-${LOG_NOC}]"

echo -e " " >> /proc/1/fd/1
echo -e "                          _                           "  >> /proc/1/fd/1
echo -e "  _ __   __ _ _ __   ___ | |__   ___  _ __ ___   ___  "  >> /proc/1/fd/1
echo -e " | '_ \ / _' | '_ \ / _ \| '_ \ / _ \| '_ ' _ \ / _ \ "  >> /proc/1/fd/1
echo -e " | | | | (_| | | | | (_) | | | | (_) | | | | | |  __/ "  >> /proc/1/fd/1
echo -e " |_| |_|\__,_|_| |_|\___/|_| |_|\___/|_| |_| |_|\___| "  >> /proc/1/fd/1
echo -e " " >> /proc/1/fd/1
echo -e "${LOG_GRN}Initializing environment...${LOG_NOC}" >> /proc/1/fd/1
echo -e " " >> /proc/1/fd/1

#===============================================================
# InfluxDB: Organization
#===============================================================
# - Get organization ID

influxorgid_get() {

	local answer=$(
		curl -s --request GET "${INFLUX_HOST}/api/v2/orgs" \
		--header "Authorization: Token ${INFLUX_TOKEN}" | jq
	)

	local result=$(
		jq -r --arg orgname "$INFLUX_ORG" '.orgs[] | select(.name == $orgname ) | .id' <<< "$answer"
	)

	if [[ -n "$result" ]]; then
		echo -e "${LOG_SUCC} InfluxDB: OrgID for \"${INFLUX_ORG}\" found" >> /proc/1/fd/1
		echo "$result"
		return 0
	else
		echo -e "${LOG_ERRO} InfluxDB: Failed retriving OrgID for \"${INFLUX_ORG}\"" >> /proc/1/fd/1
		return 1
	fi
}

export INFLUX_ORG_ID=$( influxorgid_get || exit 1 )

#===============================================================
# InfluxDB: Buckets
#===============================================================
# - If buckets do not exist, create them

# Search for an existing InfluxDB bucket
influxbucket_search() {
	local bucket=$1

	local answer=$(
		curl -s --request GET "${INFLUX_HOST}/api/v2/buckets?org=${INFLUX_ORG}" \
		--header "Authorization: Token ${INFLUX_TOKEN}" \
		--header "Accept: application/json"
	)

	local result=$(
		jq -r --arg name "$bucket" '.buckets[] | select(.name == $name)' <<< "$answer"
	)

	if [[ -n "$result" ]]; then
		echo -e "${LOG_SUCC} InfluxDB: Bucket \"${bucket}\" found" >> /proc/1/fd/1
		jq <<< "$result"
		return 0
	else
		echo -e "${LOG_INFO} InfluxDB: Bucket \"${bucket}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

# Create a new InfluxDB bucket
influxbucket_create() {
	local bucket=$1

	local answer=$(
		curl -s --request POST "${INFLUX_HOST}/api/v2/buckets" \
		--header "Authorization: Token ${INFLUX_TOKEN}" \
		--header "Content-Type: application/json" \
		--data '{
			"name": "'"${bucket}"'",
			"orgID": "'"${INFLUX_ORG_ID}"'",
			"retentionRules": []
		}'
	)

	local result=$(
		jq -e --arg name "$bucket" 'select(.name == $name)' <<< "$answer"
	)

	if [[ -n "$result" ]]; then
		echo -e "${LOG_SUCC} InfluxDB: Bucket \"$bucket\" created" >> /proc/1/fd/1
		jq <<< "$result"
		return 0
	else
		echo -e "${LOG_ERRO} InfluxDB: Failed to create bucket \"$bucket\"" >> /proc/1/fd/1
		jq <<< "$answer" >> /proc/1/fd/1
		return 1
	fi
}

# Create or find a bucket and export its ID
influxbucket_prepare() {
	local bucket_name=$1

	local bucket_info=$(
		influxbucket_search "$bucket_name" || influxbucket_create "$bucket_name"
	) || exit 1

	export INFLUX_BUCKET_ID=$( jq -r '.id' <<< "$bucket_info" )

	# Log
	jq '. | {id, name, createdAt}' <<< "$bucket_info" >> /proc/1/fd/1
}

# Process required buckets
influxbucket_prepare "${INFLUX_BUCKET_DEVICES}"
export INFLUX_BUCKET_DEVICES_ID=$INFLUX_BUCKET_ID

influxbucket_prepare "${INFLUX_BUCKET_MEASUREMENTS}"
export INFLUX_BUCKET_MEASUREMENTS_ID=$INFLUX_BUCKET_ID

#===============================================================
# InfluxDB: Auth token (for Grafana datasource)
#===============================================================
# - If no token with correct permissions exists, create one
# - If one token found, validate permissions, exit if failed (manual deletion)
# - If multiple tokens found, exit script (manual deletion)

# Search for existing auth token
influxauthtoken_search() {
	local answer=$(
		curl -s --request GET "${INFLUX_HOST}/api/v2/authorizations" \
		--header "Authorization: Token ${INFLUX_TOKEN}" \
		--header "Accept: application/json"
	)

	local result=$(
		jq -e --arg description "${INFLUX_ROTOKEN_DESCRIPTION}" '
		[.authorizations[] | select(.description == $description)]' <<< "$answer"
	)

	jq <<< "$result"
}

# Create a new auth token
influxauthtoken_create() {
	local answer=$(
		curl -s --request POST "${INFLUX_HOST}/api/v2/authorizations" \
		--header "Authorization: Token ${INFLUX_TOKEN}" \
		--header "Content-Type: application/json" \
		--data '{
			"description": "'"${INFLUX_ROTOKEN_DESCRIPTION}"'",
			"orgID": "'"${INFLUX_ORG_ID}"'",
			"permissions": [
			{
				"action": "read",
				"resource": {
				"type": "buckets",
				"id": "'"${INFLUX_BUCKET_DEVICES_ID}"'"
				}
			},
			{
				"action": "read",
				"resource": {
				"type": "buckets",
				"id": "'"${INFLUX_BUCKET_MEASUREMENTS_ID}"'"
				}
			}
			]
		}'
	)

	local result=$(
		jq -e --arg description "${INFLUX_ROTOKEN_DESCRIPTION}" '
		.description == $description' <<< "$answer"
	)

	if [[ $result == true ]]; then
		echo -e "${LOG_SUCC} InfluxDB: Auth token \"${INFLUX_ROTOKEN_DESCRIPTION}\" created" >> /proc/1/fd/1
		jq <<< "$answer"
		return 0
	else
		echo -e "${LOG_ERRO} InfluxDB: Failed to create auth token \"${INFLUX_ROTOKEN_DESCRIPTION}\"" >> /proc/1/fd/1
		jq <<< "$answer" >> /proc/1/fd/1
		return 1
	fi
}

# Validate auth token permissions
influxauthtoken_validate() {
	local influxauthtoken_found="$1"

	local result=$(
		jq -e --arg val1 "${INFLUX_BUCKET_DEVICES_ID}" --arg val2 "${INFLUX_BUCKET_MEASUREMENTS_ID}" '
		[.[] | .permissions[].resource.id] | index($val1) and index($val2)
		' <<< "${influxauthtoken_found}"
	)

	if [[ $result == true ]]; then
		echo -e "${LOG_SUCC} InfluxDB: Auth token \"${INFLUX_ROTOKEN_DESCRIPTION}\" has correct permissions" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_WARN} InfluxDB: Auth token \"${INFLUX_ROTOKEN_DESCRIPTION}\" has missing permissions. Delete it first." >> /proc/1/fd/1
		return 1
	fi
}

# Search for existing tokens
influxauthtoken_found=$(
	influxauthtoken_search
)

influxauthtoken_objects=$(
	jq length <<< "$influxauthtoken_found"
)

if [[ "$influxauthtoken_objects" -eq 0 ]]; then
	echo -e "${LOG_INFO} InfluxDB: No auth token found" >> /proc/1/fd/1

	influxauthtoken=$(
		influxauthtoken_create
	) || exit 1
elif [[ "$influxauthtoken_objects" -eq 1 ]]; then
	echo -e "${LOG_INFO} InfluxDB: Auth token \"${INFLUX_ROTOKEN_DESCRIPTION}\" found" >> /proc/1/fd/1

	influxauthtoken_validate "$influxauthtoken_found" || exit 1
	influxauthtoken=$(
		jq '.[]' <<< "$influxauthtoken_found"
	)
else
	echo -e "${LOG_ERRO} InfluxDB: Multiple auth tokens \"${INFLUX_ROTOKEN_DESCRIPTION}\" found. Delete them first." >> /proc/1/fd/1
	exit 1
fi

# Extract token
export INFLUXDB_ROTOKEN=$( jq -r '.token' <<< "$influxauthtoken" )

# Log
jq '.token = "<SECURETOKEN>"' <<< "$influxauthtoken" >> /proc/1/fd/1

#===============================================================
# Grafana: Service account 
#===============================================================
# - If no access token specified in env file
#   - Validate basic auth connection
#   - Check if service account and token exist
#   - Create a service account if needed
#   - Recreate auth token on every docker start

grafanaapiheaders_basicauth=(
	-H "Accept: application/json"
	-H "Content-Type:application/json"
)

grafanaserviceaccount_json='{
	"name": "'"${GRAFANA_SERVICEACCOUNT}"'",
	"role": "Admin",
	"isDisabled": false
}'

# Test API connection with Basic Auth
grafanaapibasicauth_test() {
	local answer=$(
		curl -s "${grafanaapiheaders_basicauth[@]}" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/org"
	)

	local result=$(
		jq -e 'has("name")' <<< "$answer"
	)

	if [[ $result == true ]]; then
		echo -e "${LOG_SUCC} Grafana: Basic auth successful" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Basic auth failed. Check credentials in .env file" >> /proc/1/fd/1
		return 1
	fi
}

# Search for existing service account
grafanaserviceaccount_find() {
	local answer=$(
		curl -s "${grafanaapiheaders_basicauth[@]}" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/serviceaccounts/search?query=${GRAFANA_SERVICEACCOUNT}"
	)

	local result=$(
		jq -e --arg name "${GRAFANA_SERVICEACCOUNT}" '
		[.serviceAccounts[] | select(.name == $name)] | length > 0' <<< "$answer"
	)

	if [[ $result == true ]]; then
		echo -e "${LOG_SUCC} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" found" >> /proc/1/fd/1
		jq -e '.serviceAccounts[] | {id, name, login, role}' <<< "$answer"
		return 0
	else
		echo -e "${LOG_INFO} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

# Create new service account
grafanaserviceaccount_create() {
	local answer=$(
		curl -s "${grafanaapiheaders_basicauth[@]}" \
		-d "${grafanaserviceaccount_json}" \
		-X POST "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/serviceaccounts"
	)

	local result=$(
		jq -e --arg name "${GRAFANA_SERVICEACCOUNT}" '.name == $name' <<< "$answer"
	)

	if [[ $result == true ]]; then
		echo -e "${LOG_SUCC} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" created" >> /proc/1/fd/1
		jq '. | {id, name, login, role}' <<< "$answer"
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Service account \"${GRAFANA_SERVICEACCOUNT}\" failed to create" >> /proc/1/fd/1
		jq <<< "$answer" >> /proc/1/fd/1
		return 1
	fi
}

# Search for existing service account token
grafanaserviceaccounttoken_find() {
	local said="$1"

	local answer=$(
		curl -s "${grafanaapiheaders_basicauth[@]}" \
		-X GET "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${said}/tokens"
	)

	local result=$(
		jq -e '[.[] | select(.name == "'"${GRAFANA_SERVICEACCOUNT}"'")] | length > 0' <<< "$answer"
	)

	if [[ $result == true ]]; then
		echo -e "${LOG_SUCC} Grafana: Service account token found" >> /proc/1/fd/1
		jq <<< "$answer"
		return 0
	else
		echo -e "${LOG_INFO} Grafana: Service account token not found" >> /proc/1/fd/1
		return 1
	fi
}

# Delete existing service account token
grafanaserviceaccounttoken_delete() {
	local said="$1"
	local token_id="$2"

	local answer=$(
		curl -s "${grafanaapiheaders_basicauth[@]}" \
		-X DELETE "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${said}/tokens/${token_id}"
	)

	local result=$(
		jq -e '.message == "Service account token deleted"' <<< "$answer"
	)

	if [[ $result == true ]]; then
		echo -e "${LOG_SUCC} Grafana: Service account token deleted" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Failed to delete existing service account token" >> /proc/1/fd/1
		jq <<< "$answer" >> /proc/1/fd/1
		return 1
	fi
}

# Create a new service account token
grafanaserviceaccounttoken_create() {
	local said="$1"

	local answer=$(
		curl -s "${grafanaapiheaders_basicauth[@]}" \
		-d "${grafanaserviceaccount_json}" \
		-X POST "http://${GRAFANA_ADMIN}:${GRAFANA_PASS}@${GRAFANA_SERVICE}/api/serviceaccounts/${said}/tokens"
	)

	local result=$(
		jq -e 'has("name")' <<< "$answer"
	)

	if [[ $result == true ]]; then
		echo -e "${LOG_SUCC} Grafana: New service account token created" >> /proc/1/fd/1
		jq <<< "$answer"
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Error creating new service account token" >> /proc/1/fd/1
		jq <<< "$answer" >> /proc/1/fd/1
		return 1
	fi
}

if [[ -n "${GRAFANA_SERVICEACCOUNT_TOKEN}" ]]; then
	echo -e "${LOG_SUCC} Grafana: Service account token provided" >> /proc/1/fd/1
elif [[ -n "${GRAFANA_ADMIN}" && -n "${GRAFANA_PASS}" && -n "${GRAFANA_SERVICEACCOUNT}" ]]; then
	echo -e "${LOG_WARN} Grafana: No service account token provided in .env file" >> /proc/1/fd/1

	grafanaapibasicauth_test || exit 1

	grafanaserviceaccount=$(
		grafanaserviceaccount_find || grafanaserviceaccount_create
	) || exit 1

	grafanaserviceaccount_id=$(
		jq -r .id <<< "$grafanaserviceaccount"
	)

	# Log
	jq <<< "$grafanaserviceaccount" >> /proc/1/fd/1

	grafanaserviceaccount_token=$(
		grafanaserviceaccounttoken_find "$grafanaserviceaccount_id"
	)

	grafanaserviceaccount_token_objects=$(
		jq length <<< "$grafanaserviceaccount_token"
	)

	for ((i = 0; i < grafanaserviceaccount_token_objects; i++)); do
		grafanaserviceaccount_token_id=$(
			jq -r ".[$i].id" <<< "$grafanaserviceaccount_token"
		)

		grafanaserviceaccounttoken_delete "$grafanaserviceaccount_id" "$grafanaserviceaccount_token_id" || exit 1
	done

	grafanaserviceaccount_token=$(
		grafanaserviceaccounttoken_create "$grafanaserviceaccount_id"
	) || exit 1

	export GRAFANA_SERVICEACCOUNT_TOKEN=$( jq -r .key <<< "$grafanaserviceaccount_token" )

	# Log
	jq '. | {id, name, key} | .key = "<SECUREKEY>"' <<< "$grafanaserviceaccount_token" >> /proc/1/fd/1
else
	echo -e "${LOG_ERRO} Grafana: Neither a service account token nor admin credentials set in .env" >> /proc/1/fd/1
	exit 1
fi

#===============================================================
# Grafana: Test API connection
#===============================================================
# - Test connection to "http://${GRAFANA_SERVICE}/api/org"
# - With provided or created token

grafanaapiheaders_token=(
	-H "Accept: application/json"
	-H "Content-Type:application/json"
	-H "Authorization: Bearer ${GRAFANA_SERVICEACCOUNT_TOKEN}"
)

grafanaapiauthtoken_test() {
	local answer=$(
		curl -s "${grafanaapiheaders_token[@]}" -X GET "http://${GRAFANA_SERVICE}/api/org"
	)

	if [[ -z "$answer" || ! "$answer" =~ ^\{ ]]; then
		echo -e "${LOG_ERRO} Grafana: No or invalid API response" >> /proc/1/fd/1
		return 1
	fi

	local result=$(
		jq -e 'has("name")' <<< "$answer" 2>/dev/null
	)

	if [[ $result == true ]]; then
		echo -e "${LOG_SUCC} Grafana: Service account token valid" >> /proc/1/fd/1
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Connection with service account token failed" >> /proc/1/fd/1
		jq <<< "$answer" >> /proc/1/fd/1
		return 1
	fi
}

grafanaapiauthtoken_test || exit 1

#===============================================================
# Grafana: Datasources
#===============================================================
# - If datasources do not exist create them

# Search for existing datasource
grafanadatasource_search() {
	local dsname=$1

	local answer=$(
		curl -s "${grafanaapiheaders_token[@]}" -X GET "${GRAFANA_HOST}/api/datasources/name/${dsname}"
	)

	if [[ -z "$answer" || ! "$answer" =~ ^\{ ]]; then
		echo -e "${LOG_INFO} Grafana: No or invalid respone searching for datasource \"${dsname}\"" >> /proc/1/fd/1
		return 1
	fi

	local result=$(
		jq -e --arg name "$dsname" '.name == $name' <<< "$answer" 2>/dev/null
	)

	if [[ $result == true ]]; then
		echo -e "${LOG_SUCC} Grafana: Datasource \"${dsname}\" found" >> /proc/1/fd/1
		jq -e --arg name "$dsname" '. | select(.name == $name) | {uid, name, type, url}' <<< "$answer" 2>/dev/null
		return 0
	else
		echo -e "${LOG_INFO} Grafana: Datasource \"${dsname}\" not found" >> /proc/1/fd/1
		return 1
	fi
}

# Prepare datasource in JSON format
grafanadatasource_prepare() {
	local bucket=$1

	local result=$(
		jq -n --arg name "$bucket" --arg url "$INFLUX_HOST" --arg token "$INFLUXDB_ROTOKEN" '{
		name: $name,
		type: "influxdb",
		typeName: "InfluxDB",
		access: "proxy",
		url: $url,
		jsonData: { dbName: $name, httpMode: "GET", httpHeaderName1: "Authorization" },
		secureJsonData: { httpHeaderValue1: ("Token " + $token) },
		isDefault: true,
		readOnly: false
	}')

	echo "$result"
}

# Create a new datasource
grafanadatasource_create() {
	local dsjson=$1
	local dsname=$( jq -r .name <<< "$dsjson" )

	local answer=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X POST -H "Content-Type: application/json" \
		-d "$dsjson" "${GRAFANA_HOST}/api/datasources"
	)

	if [[ -z "$answer" || ! "$answer" =~ ^\{ ]]; then
		echo -e "${LOG_ERRO} Grafana: Error creating datasource \"${dsname}\" - No valid API response" >> /proc/1/fd/1
		return 1
	fi

	local result=$(
		jq -e '.datasource.name == "'"$dsname"'"' <<< "$answer" 2>/dev/null
	)

	if [[ $result == true ]]; then
		echo -e "${LOG_SUCC} Grafana: Datasource \"${dsname}\" created" >> /proc/1/fd/1
		jq -e '.datasource | {uid, name, type, url}' <<< "$answer" 2>/dev/null
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Failed to create datasource \"${dsname}\"" >> /proc/1/fd/1
		jq <<< "$answer" >> /proc/1/fd/1
		return 1
	fi
}

# Datasource: Devices
grafanadatasource_devices_json=$(
	grafanadatasource_prepare "$GRAFANA_DATASOURCE_DEVICES"
)

grafanadatasource_devices=$(
	grafanadatasource_search "$GRAFANA_DATASOURCE_DEVICES" || \
	grafanadatasource_create "$grafanadatasource_devices_json"
) || exit 1

export GRAFANADATASOURCE_DEVICES_UID=$( jq -r .uid <<< "$grafanadatasource_devices" )

# Log
jq <<< "$grafanadatasource_devices" >> /proc/1/fd/1

# Datasource: Measurements
grafanadatasource_measurements_json=$(
	grafanadatasource_prepare "$GRAFANA_DATASOURCE_MEASUREMENTS"
)

grafanadatasource_measurements=$(
	grafanadatasource_search "$GRAFANA_DATASOURCE_MEASUREMENTS" || \
	grafanadatasource_create "$grafanadatasource_measurements_json"
) || exit 1

export GRAFANADATASOURCE_MEASUREMENTS_UID=$( jq -r .uid <<< "$grafanadatasource_measurements" )

# Log
jq <<< "$grafanadatasource_measurements" >> /proc/1/fd/1

#===============================================================
# Grafana: Modify and copy public content
#===============================================================
# - If source folder grafana-content exists
# - Modify mqtt credentials and weather widget in config.js
# - Move content to "${NANOHOME_ROOTPATH}/data/grafana"

grafanacontent_source="${NANOHOME_ROOTPATH}/grafana-content"
grafanacontent_destination="${NANOHOME_ROOTPATH}/data/grafana"

# Set preferences in config.js
grafanacontent_setpreferences() {
	
	# Grafana credentials
	sed -i '/^var user =/c\var user = "'"${MQTT_USER}"'";' "${grafanacontent_source}/js/config.js"
	sed -i '/^var pwd =/c\var pwd = "'"${MQTT_PASSWORD}"'";' "${grafanacontent_source}/js/config.js"

	if ! grep -q "var user = \"${MQTT_USER}\";" "${grafanacontent_source}/js/config.js"; then
		echo -e "${LOG_ERRO} Grafana: Failed setting public content mqtt credentials" >> /proc/1/fd/1
		return 1
	else
		echo -e "${LOG_SUCC} Grafana: Public content mqtt credentials set" >> /proc/1/fd/1
	fi

	# Weather widget
	if [[ -n "${WEATHER_URL}" ]]; then
		sed -i '/^var weatherWidgetLink =/c\var weatherWidgetLink = "'"${WEATHER_URL}"'";' "${grafanacontent_source}/js/config.js"
		sed -i '/^var weatherWidgetCity =/c\var weatherWidgetCity = "'"${WEATHER_LOCATION}"'";' "${grafanacontent_source}/js/config.js"

		if ! grep -q "var weatherWidgetLink = \"${WEATHER_URL}\";" "${grafanacontent_source}/js/config.js"; then
			echo -e "${LOG_ERRO} Grafana: Failed setting weather widget preferences" >> /proc/1/fd/1
			return 1
		else
			echo -e "${LOG_SUCC} Grafana: Public content weather widget preferences set" >> /proc/1/fd/1
		fi
	fi

	return 0
}

# Move grafana content to persistent storage
grafanacontent_move() {
	rm -rf "${grafanacontent_destination}"/*
	mv -f "${grafanacontent_source}"/* "${grafanacontent_destination}"

	if [[ $? -eq 0 ]]; then
		echo -e "${LOG_SUCC} Grafana: Content moved to \"${grafanacontent_destination}\"" >> /proc/1/fd/1
		rm -rf "${grafanacontent_source}"
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Failed moving content to \"${grafanacontent_destination}\"" >> /proc/1/fd/1
		return 1
	fi
}

if [[ -d "${grafanacontent_source}" ]]; then
	echo -e "${LOG_INFO} Grafana: Modify public content" >> /proc/1/fd/1

	grafanacontent_setpreferences || exit 1
	grafanacontent_move || exit 1
else
	echo -e "${LOG_INFO} Grafana: Public content \"${grafanacontent_destination}\" already modified" >> /proc/1/fd/1
fi

#===============================================================
# Grafana: Dashboard folder
#===============================================================
# - If dashboard folder "nanohome" does not exist create it

# Search for existing dahboard folder
grafanadashfolder_search() {
	local foldername=$1

	local answer
	answer=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/search?query=&type=dash-folder") || {
		echo -e "${LOG_ERRO} Grafana: Failed searching for dashboard folder - API request failed" >> /proc/1/fd/1
		return 1
	}

	# Extract folder details
	local result=$(
		jq -e --arg title "$foldername" '.[] | select(.title == $title) | {uid, title, url}' <<< "$answer"
	)

	if [[ -n "$result" ]]; then
		echo -e "${LOG_SUCC} Grafana: Dashboard folder \"$foldername\" found" >> /proc/1/fd/1
		jq <<< "$result"
		return 0
	else
		echo -e "${LOG_INFO} Grafana: Dashboard folder \"$foldername\" not found" >> /proc/1/fd/1
		return 1
	fi
}

# Create a new dahboard folder
grafanadashfolder_create() {
	local foldername=$1

	local answer
	answer=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X POST -H "Content-Type: application/json" \
		-d "{\"title\": \"$foldername\"}" "http://${GRAFANA_SERVICE}/api/folders") || {
		echo -e "${LOG_ERRO} Grafana: Failed creating dashboar folder - API request failed" >> /proc/1/fd/1
		return 1
	}

	# Extract folder details
	local result
	result=$(
		jq -e '. | {uid, title, url}' <<< "$answer") || {
		echo -e "${LOG_ERRO} Grafana: Failed creating dashboar folder - Error parsing API response" >> /proc/1/fd/1
		return 1
	}

	echo -e "${LOG_SUCC} Grafana: Dashboard folder \"$foldername\" created" >> /proc/1/fd/1
	jq <<< "$result"
	return 0
}

# Search for the folder, if not found, create it
grafanadashfolder=$(
	grafanadashfolder_search "${GRAFANA_DASHFOLDER_NAME}" || \
	grafanadashfolder_create "${GRAFANA_DASHFOLDER_NAME}"
) || exit 1

# Extract UID
export GRAFANA_FOLDER_UID=$( jq -r '.uid' <<< "${grafanadashfolder}" 2>/dev/null )

# Ensure UID was successfully extracted
if [[ -z "${GRAFANA_FOLDER_UID}" ]]; then
	echo -e "${LOG_ERRO} Grafana: Failed to retrieve folder UID" >> /proc/1/fd/1
	exit 1
fi

# Log
jq <<< "${grafanadashfolder}" >> /proc/1/fd/1

#===============================================================
# Grafana: Dashboards
#===============================================================
# - If dashbaord does not exist
# - Load dashboard templates, prepare and upload them

grafanadashboard_metadata='{
	"folderUid": "'"${GRAFANA_FOLDER_UID}"'",
	"message": "Initial upload",
	"overwrite": true
}'

# Search for existing dahboard
grafanadashboard_find() {
	local uid=$1

	local answer
	answer=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/search?query=&dashboardUIDs=${uid}") || {
		echo -e "${LOG_ERRO} Grafana: Failed searching dashboard - API request failed" >> /proc/1/fd/1
		return 1
	}

	if [[ -z "${answer}" || "${answer}" == "[]" ]]; then
		echo -e "${LOG_INFO} Grafana: Dashboard \"${uid}\" not found" >> /proc/1/fd/1
		return 1
	fi

	local output
	output=$(
		jq -e --arg uid "${uid}" '.[] | select(.uid == $uid) | {uid, title, url}' <<< "${answer}") || {
		echo -e "${LOG_INFO} Grafana: Dashboard \"${uid}\" not found" >> /proc/1/fd/1
		return 1
	}

	echo -e "${LOG_SUCC} Grafana: Dashboard \"${uid}\" found" >> /proc/1/fd/1
	return 0
}

# Prepare dashboard template for upload (metadata and datasource uid)
grafanadashboard_prepare() {
	local file=$1
	local dsuid=$2

	local result
	result=$(
		jq --arg uid "$dsuid" '
		.dashboard |= walk(if type == "object" and .datasource? and .datasource.type == "influxdb"
						   then .datasource.uid = $uid else . end)' "${file}") || {
		echo -e "${LOG_ERRO} Grafana: Failed preparing dashboard \"${file}\"" >> /proc/1/fd/1
		return 1
	}

	local output=$(
		jq --argjson dashboard "$(jq '.dashboard' <<< "${result}")" \
		'.dashboard = $dashboard' <<< "${grafanadashboard_metadata}"
	)

	echo -e "${LOG_SUCC} Grafana: Dashboard \"${file}\" prepared for upload" >> /proc/1/fd/1
	jq <<< "${output}"
	return 0
}

# Upload new dashboard
grafanadashboard_create() {
	local jsondata=$1

	local result
	result=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X POST -d "${jsondata}" "http://${GRAFANA_SERVICE}/api/dashboards/db") || {
		echo -e "${LOG_ERRO} Grafana: Dashboard upload failed - API request failed" >> /proc/1/fd/1
		return 1
	}

	if jq -e '.status == "success"' <<< "${result}" > /dev/null; then
		echo -e "${LOG_SUCC} Grafana: Dashboard uploaded" >> /proc/1/fd/1
		jq '{uid, slug, url, folderUid}' <<< "${result}"
		return 0
	else
		echo -e "${LOG_ERRO} Grafana: Dashboard upload failed" >> /proc/1/fd/1
		jq <<< "${result}" >> /proc/1/fd/1
		return 1
	fi  
}

# Dashboard: Home
if ! grafanadashboard_find "${GRAFANA_DASHBOARD_UID_HOME}"; then

	grafanadashboard_home_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_HOME}" "${GRAFANADATASOURCE_MEASUREMENTS_UID}"
	) || exit 1

	grafanadashboard_home=$(
		grafanadashboard_create "${grafanadashboard_home_json}"
	) || exit 1

	# Log
	jq '.' <<< "${grafanadashboard_home}" >> /proc/1/fd/1
fi

# Dashboard: Devices
if ! grafanadashboard_find "${GRAFANA_DASHBOARD_UID_DEVICES}"; then

	grafanadashboard_devices_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_DEVICES}" "${GRAFANADATASOURCE_DEVICES_UID}"
	) || exit 1

	grafanadashboard_devices=$(
		grafanadashboard_create "${grafanadashboard_devices_json}"
	) || exit 1

	# Log
	jq '.' <<< "${grafanadashboard_devices}" >> /proc/1/fd/1	
fi

# Dashboard: Timer
if ! grafanadashboard_find "${GRAFANA_DASHBOARD_UID_TIMER}"; then

	grafanadashboard_timer_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_TIMER}" "${GRAFANADATASOURCE_DEVICES_UID}"
	) || exit 1

	grafanadashboard_timer=$(	
		grafanadashboard_create "${grafanadashboard_timer_json}"
	) || exit 1

	# Log
	jq '.' <<< "${grafanadashboard_timer}" >> /proc/1/fd/1
fi

# Dashboard: Standby
if ! grafanadashboard_find "${GRAFANA_DASHBOARD_UID_STANDBY}" ; then

	grafanadashboard_standby_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_STANDBY}" "${GRAFANADATASOURCE_DEVICES_UID}"
	) || exit 1

	grafanadashboard_standby=$(	
		grafanadashboard_create "${grafanadashboard_standby_json}"
	) || exit 1

	# Log
	jq '.' <<< "${grafanadashboard_standby}" >> /proc/1/fd/1
fi

# Dashboard: Measurements
if ! grafanadashboard_find "${GRAFANA_DASHBOARD_UID_MEASUREMENTS}"; then

	grafanadashboard_measurements_json=$(
		grafanadashboard_prepare "${GRAFANA_DASHBOARD_FILE_MEASUREMENTS}" "${GRAFANADATASOURCE_MEASUREMENTS_UID}"
	) || exit 1

	grafanadashboard_measurements=$(	
		grafanadashboard_create "${grafanadashboard_measurements_json}"
	) || exit 1

	# Log
	jq '.' <<< "${grafanadashboard_measurements}" >> /proc/1/fd/1
fi

#===============================================================
# Grafana: Home dashboard preference
#===============================================================
# - Set home dashboard preference in grafana settings

# Validate current home dashboard preference
grafanadashboard_gethomepreference() {
	local answer=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X GET "http://${GRAFANA_SERVICE}/api/org/preferences") || {
		echo -e "${LOG_ERRO} Grafana: Get home preference - API request failed" >> /proc/1/fd/1
		return 1
	}

	if jq -e --arg uid "${GRAFANA_DASHBOARD_UID_HOME}" '.homeDashboardUID == $uid' <<< "$answer" >/dev/null; then
		echo -e "${LOG_SUCC} Grafana: Home dashboard preference is set" >> /proc/1/fd/1
		jq <<< "$answer"
		return 0
	else
		echo -e "${LOG_INFO} Grafana: Home dashboard preference is not set" >> /proc/1/fd/1
		jq <<< "$answer" >> /proc/1/fd/1
		return 1
	fi
}

# Set new home dashbord preference
grafanadashboard_sethomepreference() {
	local id=$1

	local result=$(
		curl -s "${grafanaapiheaders_token[@]}" \
		-X PUT -H "Content-Type: application/json" \
		-d "{\"homeDashboardID\":$id}" "http://${GRAFANA_SERVICE}/api/org/preferences") || {
		echo -e "${LOG_ERRO} Grafana: Set home preference - API request failed" >> /proc/1/fd/1
		return 1
	}

	if jq -e '.message == "Preferences updated"' <<< "$result" >/dev/null; then
		echo -e "${LOG_SUCC} Grafana: Home dashboard preference updated" >> /proc/1/fd/1
		jq <<< "$result"
		return 0
	else
		echo -e "${LOG_WARN} Grafana: Failed to set home dashboard preference" >> /proc/1/fd/1
		jq <<< "$result" >> /proc/1/fd/1
		return 1
	fi
}

grafanadashboard_home_id=$(
	curl -s "${grafanaapiheaders_token[@]}" \
	-X GET "http://${GRAFANA_SERVICE}/api/dashboards/uid/${GRAFANA_DASHBOARD_UID_HOME}" |
	jq -r '.dashboard.id' 2>/dev/null | xargs
)

# Ensure ID retrieval was successful and and set home dashboard if needed
if [[ -z "$grafanadashboard_home_id" || "$grafanadashboard_home_id" == "null" ]]; then
	echo -e "${LOG_ERRO} Grafana: Home preference -  Failed to retrieve home dashboard ID" >> /proc/1/fd/1
else
	grafanadashboard_gethomepreference || grafanadashboard_sethomepreference "$grafanadashboard_home_id"
fi

#===============================================================
# Mosquitto: Validate connection
#===============================================================
# - If connection to mosquitto fails output a warning

mosquitto_sub "${MQTT_CONNECTION_STRING[@]}" \
	--nodelay --quiet -C 1 -W 1 \
	-t "nanohome/startup" 

if [[ $? -ne 1 ]]; then
	echo -e "${LOG_SUCC} MQTT: Connection to \"${MQTT_SERVER}\" successful" >> /proc/1/fd/1
else
	echo -e "${LOG_WARN} MQTT: Could not connect to \"${MQTT_SERVER}\"" >> /proc/1/fd/1
fi

#===============================================================
# Nanohome: Start services
#===============================================================

# Start device watcher
/bin/bash ${NANOHOME_ROOTPATH}/services/devicewatcher &

[[ $? -eq 0 ]] && echo -e "${LOG_SUCC} Nanohome: Devicewatcher started" >> /proc/1/fd/1

# Start  device watcher legacy
/bin/bash ${NANOHOME_ROOTPATH}/services/devicewatcher_legacy &
[[ $? -eq 0 ]] && echo -e "${LOG_SUCC} Nanohome: Devicewatcher legacy started" >> /proc/1/fd/1

# Start measurements for legacy devices
/bin/bash ${NANOHOME_ROOTPATH}/services/measurements_legacy &
[[ $? -eq 0 ]] && echo -e "${LOG_SUCC} Nanohome: Measurements legacy started" >> /proc/1/fd/1

# Start nanohome Shell
/bin/bash ${NANOHOME_ROOTPATH}/services/nanohome_shell &
[[ $? -eq 0 ]] && echo -e "${LOG_SUCC} Nanohome: Shell started" >> /proc/1/fd/1

# Create and fill crontab file
echo "# Nanohome Crontabs" >> "${NANOHOME_CRONTABS}"
/bin/bash ${NANOHOME_ROOTPATH}/bin/create_timer
[[ $? -eq 0 ]] && echo -e "${LOG_SUCC} Nanohome: Timer loaded" >> /proc/1/fd/1

# Start standby managers
/bin/bash ${NANOHOME_ROOTPATH}/bin/create_standby
[[ $? -eq 0 ]] && echo -e "${LOG_SUCC} Nanohome: Standby manager started" >> /proc/1/fd/1

# Start crond
crond -f &

# Finish
tail -f /dev/null
