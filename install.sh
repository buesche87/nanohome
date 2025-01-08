#!/bin/bash
######################################
# NanoHome Automation Server Install
######################################

if [ $(id -u) -ne 0 ]; then
	printf "Script must be run as root. Try 'sudo ./install.sh'\n"
	exit 1
fi

# load settings
source ./install.cfg

# TODO - Create nanohome config
touch $rootpath/config.cfg


echo ""
echo "##################################"
echo "# Create user for NanoHome       #"
echo "##################################"
echo ""

# test if user exists, create if not
if getent passwd $linuxuser > /dev/null ; then
	echo "use existing user \"$linuxuser\""
else
	echo "create user $linuxuser"
	useradd -p $(openssl passwd -1 $linuxpass) $linuxuser
fi

echo ""
echo "##################################"
echo "# Create files and direcories    #"
echo "##################################"
echo ""

# create directories
mkdir -p $rootpath/bin/
mkdir -p $rootpath/conf/
mkdir -p $rootpath/drivers/
mkdir -p $rootpath/services/
mkdir -p $rootpath/template/
mkdir -p $temppath/dashboards
mkdir -p $temppath/services
mkdir -p $grafanapath/public/nanohome/

echo ""
echo "##################################"
echo "# Copy files                     #"
echo "##################################"
echo ""

# Copy files
cp ./config.cfg $rootpath
cp ./bin/* $rootpath/bin/
cp ./driver/* $rootpath/driver/
cp ./templates/* $rootpath/templates/
cp ./dashboards/* $temppath/dashboards/
cp ./services/* $temppath/services/
cp ./res/* $grafanapath/public/nanohome/

# Change installation parameters
for i in $rootpath/bin/*; do
    sed -i "s#INSTALLDIR#$rootpath#g" "$i"
done

for i in $rootpath/drivers/*; do
    sed -i "s#INSTALLDIR#$rootpath#g" "$i"
done

sed -i "s#;disable_sanitize_html.*#disable_sanitize_html = true#g" "/etc/grafana/grafana.ini"

for i in $temppath/services/*; do
    sed -i "s#INSTALLDIR#$rootpath#g" "$i"
	sed -i "s#SVCUSER#$linuxuser#g" "$i"
done

# Copy services
cp $temppath/services/* /etc/systemd/system/

# Make binaries executable
chmod +x $rootpath/bin/*
chmod +x $rootpath/driver/*

# Link binaries
ln -sf $rootpath/bin/* /usr/local/bin/

echo ""
echo "##################################"
echo "# Configure mosquitto            #"
echo "##################################"
echo ""

# configure mosquitto
touch /etc/mosquitto/conf.d/nanohome.conf
echo password_file /etc/mosquitto/passwd > /etc/mosquitto/conf.d/nanohome.conf
echo allow_anonymous false >> /etc/mosquitto/conf.d/nanohome.conf
echo listener 1883 >> /etc/mosquitto/conf.d/nanohome.conf
echo listener 1884 >> /etc/mosquitto/conf.d/nanohome.conf
echo protocol websockets >> /etc/mosquitto/conf.d/nanohome.conf

# create mosquitto user
touch /etc/mosquitto/passwd
mosquitto_passwd -U /etc/mosquitto/passwd
mosquitto_passwd -b /etc/mosquitto/passwd $mqtt_system_user $mqtt_system_pass
mosquitto_passwd -b /etc/mosquitto/passwd $mqtt_grafana_user $mqtt_grafana_pass
mosquitto_passwd -b /etc/mosquitto/passwd $mqtt_shelly_user $mqtt_shelly_pass
mosquitto_passwd -b /etc/mosquitto/passwd $mqtt_dash_user $mqtt_dash_pass

echo ""
echo "##################################"
echo "# Configure InfluxDB             #"
echo "##################################"
echo ""

# You need to be running an influxdb

# Create measurement bucket
curl --request POST \
  "${influxdb_url}api/v2/buckets" \
  --header "Authorization: Token ${influxdb_apitoken}" \
  --header "Content-type: application/json" \
  --data '{
    "orgID": "'"${influxdb_orgid}"'",
    "name": "'"${influxdb_measurements_bucket}"'",
    "retentionRules": [
      {
        "type": "expire",
        "everySeconds": 0,
        "shardGroupDurationSeconds": 0
      }
    ]
  }'

# Create devices bucket
curl --request POST \
  "${influxdb_url}api/v2/buckets" \
  --header "Authorization: Token ${influxdb_apitoken}" \
  --header "Content-type: application/json" \
  --data '{
    "orgID": "'"${influxdb_orgid}"'",
    "name": "'"${influxdb_devices_bucket}"'",
    "retentionRules": [
      {
        "type": "expire",
        "everySeconds": 0,
        "shardGroupDurationSeconds": 0
      }
    ]
  }'


# Create InfluxDB configuration profiles
influx config create \
  --config-name $influxdb_config \
  --host-url $influxdb_url \
  --org $influxdb_org \
  --token $influxdb_token \
  --active

# Get ID from newly created buckets
measurement_bucket_json=$(influx bucket list -n $influxdb_measurements_bucket --json)
measurement_bucket_id="$(echo $measurement_bucket_json | jq -r '.[].id')"
devices_bucket_json=$(influx bucket list -n $influxdb_devices_bucket --json)
devices_bucket_id="$(echo $devices_bucket_json | jq -r '.[].id')"

# Create read-only token for grafana
influxdb_ro_token_json=$(influx auth create \
  --description grafana \
  --org $influxdb_org \
  --read-bucket $measurement_bucket_id \
  --read-bucket $devices_bucket_id \
  --json)

influxdb_ro_token="$(echo $influxdb_ro_token_json | jq -r '.token')"

echo ""
echo "##################################"
echo "# Configure Grafana              #"
echo "##################################"
echo ""

# Create Grafana Service Account
sa_nanohome()
{
  cat <<EOF
{
  "name":"nanohome",
  "role":"Admin",
  "isDisabled":false
}
EOF
}

curl -i \
-H "Accept: application/json" \
-H "Content-Type:application/json" \
-X POST -d "$(sa_nanohome)" "http://admin:admin@$grafana_url/api/serviceaccounts"

# Create Serviceaccount Token
token_json="$(curl -X POST -H "Content-Type: application/json" -d '{"name":"nanohome"}' http://admin:admin@$grafana_url/api/serviceaccounts/2/tokens)"
echo "$token_json" | sudo tee $rootpath/conf/sa_token.json
sa_token="$(echo "$token_json" | jq -r '.key')"

# Create InfluxDB datasources in Grafana
generate_measurement_datasource()
{
  cat <<EOF
{
  "name":"Measurement",
  "type":"influxdb",
  "typeName":"InfluxDB",
  "access":"proxy",
  "url":"$influxdb_url",
  "jsonData":{"dbName":"$influxdb_measurements_bucket","httpMode":"GET","httpHeaderName1":"Authorization"},
  "secureJsonData":{"httpHeaderValue1":"Token $influxdb_ro_token"},
  "isDefault":true,
  "readOnly":false
}
EOF
}

generate_devices_datasource()
{
  cat <<EOF
{
  "name":"Devices",
  "type":"influxdb",
  "typeName":"InfluxDB",
  "access":"proxy",
  "url":"$influxdb_url",
  "jsonData":{"dbName":"$influxdb_devices_bucket","httpMode":"GET","httpHeaderName1":"Authorization"},
  "secureJsonData":{"httpHeaderValue1":"Token $influxdb_ro_token"},
  "isDefault":true,
  "readOnly":false
}
EOF
}

curl -i \
-H "Accept: application/json" \
-H "Content-Type:application/json" \
-H "Authorization: Bearer $sa_token" \
-X POST -d "$(generate_measurement_datasource)" "http://$grafana_url/api/datasources"

curl -i \
-H "Accept: application/json" \
-H "Content-Type:application/json" \
-H "Authorization: Bearer $sa_token" \
-X POST -d "$(generate_devices_datasource)" "http://$grafana_url/api/datasources"

echo ""
echo ""
echo "##################################"
echo "# Create dashboards              #"
echo "##################################"
echo ""

# Create Grafana home dashboard
sed -i 's#var user = \\\"\\\"#var user = \\\"'$mqtt_grafana_user'\\\"#' $temppath/dashboards/home.json
sed -i 's#var pwd = \\\"\\\"#var pwd = \\\"'$mqtt_grafana_pass'\\\"#' $temppath/dashboards/home.json
 
curl -i \
-H "Accept: application/json" \
-H "Content-Type:application/json" \
-H "Authorization: Bearer $sa_token" \
-X POST -d @$temppath/dashboards/home.json "http://$grafana_url/api/dashboards/db"

# TODO - Create Grafana device manager dashboard
sed -i 's#var user = \\\"\\\"#var user = \\\"'$mqtt_grafana_user'\\\"#' $temppath/dashboards/devicemanager.json
sed -i 's#var pwd = \\\"\\\"#var pwd = \\\"'$mqtt_grafana_pass'\\\"#' $temppath/dashboards/devicemanager.json
 
curl -i \
-H "Accept: application/json" \
-H "Content-Type:application/json" \
-H "Authorization: Bearer $sa_token" \
-X POST -d @$temppath/dashboards/devicemanager.json "http://$grafana_url/api/dashboards/db"

# TODO - Create Grafana timer manager dashboard
sed -i 's#var user = \\\"\\\"#var user = \\\"'$mqtt_grafana_user'\\\"#' $temppath/dashboards/timermanager.json
sed -i 's#var pwd = \\\"\\\"#var pwd = \\\"'$mqtt_grafana_pass'\\\"#' $temppath/dashboards/timermanager.json
 
curl -i \
-H "Accept: application/json" \
-H "Content-Type:application/json" \
-H "Authorization: Bearer $sa_token" \
-X POST -d @$temppath/dashboards/timermanager.json "http://$grafana_url/api/dashboards/db"
 
# TODO - Create Grafana standby manager dashboard
sed -i 's#var user = \\\"\\\"#var user = \\\"'$mqtt_grafana_user'\\\"#' $temppath/dashboards/standbymanager.json
sed -i 's#var pwd = \\\"\\\"#var pwd = \\\"'$mqtt_grafana_pass'\\\"#' $temppath/dashboards/standbymanager.json

curl -i \
-H "Accept: application/json" \
-H "Content-Type:application/json" \
-H "Authorization: Bearer $sa_token" \
-X POST -d @$temppath/dashboards/standbymanager.json "http://$grafana_url/api/dashboards/db"

# Create Grafana measurement dashboard
curl -i \
-H "Accept: application/json" \
-H "Content-Type:application/json" \
-H "Authorization: Bearer $sa_token" \
-X POST -d @$temppath/dashboards/measurements.json "http://$grafana_url/api/dashboards/db"

# Create Grafana carpetplot dashboard
curl -i \
-H "Accept: application/json" \
-H "Content-Type:application/json" \
-H "Authorization: Bearer $sa_token" \
-X POST -d @$temppath/dashboards/carpetplot.json "http://$grafana_url/api/dashboards/db"   

# Set Grafana home dashboard
home_id="$(curl -X GET -H "Authorization: Bearer $sa_token" -H "Content-Type: application/json" http://$grafana_url/api/dashboards/uid/$home_uid | jq -r '.dashboard.id')"

curl -i \
-H "Accept: application/json" \
-H "Content-Type:application/json" \
-H "Authorization: Bearer $sa_token" \
-X PUT -d '{"homeDashboardId":'$home_id'}' http://$grafana_url/api/org/preferences

echo ""
echo ""
echo "##################################"
echo "# Postprocessing                 #"
echo "##################################"
echo ""

# Change user running nanohome
chown -R $linuxuser:$linuxuser $rootpath

# Install Grafana Plugins
$grafanapath/bin/grafana cli plugins install grafana-clock-panel
$grafanapath/bin/grafana cli plugins install volkovlabs-variable-panel
# $grafanapath/bin/grafana cli plugins install petrslavotinek-carpetplot-panel

# Prepare Crontab 
echo "" >> /etc/crontab
echo "# Nanohome Crontabs" >> /etc/crontab

# Cleanup
rm -rf /tmp/*.json

echo "##################################"
echo "# Start services                 #"
echo "##################################"
echo ""

# Start services
systemctl restart influxdb
systemctl restart grafana-server
systemctl restart mosquitto
systemctl enable mqtt_shell.service
systemctl start mqtt_shell.service

echo ""
echo "##################################"
echo "# Finish                         #"
echo "##################################"
echo ""
