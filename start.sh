#!/bin/bash

# Environment
ROOTPATH="/opt/nanohome"
INFLUXDB_BUCKET_DEVICES="devices"
INFLUXDB_BUCKET_MEASUREMENTS="measurements"
DEVWATCHER_INTERVAL=30
NOT_MONITORED_COMPONENTS="ble,cloud,mqtt,sys,wifi,ws,status,ht_ui,input:*,longpush:*"
NOT_MONITORED_COMPONENTS_LEGACY="input,input_event"
SHELL_ALLOWED_COMMANDS="create_dashboardelement,create_timer,delete_device,delete_measurement"
TOPIC_STATUS="+/status/+"
TOPIC_CONNECTED="+/status/+/connected"
TOPIC_ONLINE="+/online"
TOPIC_TIMER="nanohome/+/timer"
TOPIC_STANDBY="nanohome/+/standby"
TOPIC_DASHBOARD="nanohome/config/dashboard"
TOPIC_CMDINPUT="input_command"
TOPIC_CMDOUTPUT="output_command"
TOPIC_ONLINE_LEGACY="shellies/+/+/+"
MQTT_FASTSUBSCRIBE="250"
MQTT_NORMALSUBSCRIBE="500"
MQTT_LONGSUBSCRIBE="1000"

# Create InfluxDB configuration profile
influx config create \
  --config-name "${INFLUXDB_CONFIG}" \
  --host-url "http://${INFLUXDB_SERVICE}" \
  --org "${INFLUXDB_ORG}" \
  --token "${INFLUXDB_ADMINTOKEN}" \
  --active

# Check if devices bucket exists, create if not
influx bucket list --name "${INFLUXDB_BUCKET_DEVICES}" >/dev/null 2>&1
if [ $? -ne 0 ]; then
	influx bucket create \
	  --name "${INFLUXDB_BUCKET_DEVICES}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}"
fi

# Check if measurement bucket exists, create if not
influx bucket list --name "${INFLUXDB_BUCKET_MEASUREMENTS}" >/dev/null 2>&1
if [ $? -ne 0 ]; then
	influx bucket create \
	  --name "${INFLUXDB_BUCKET_MEASUREMENTS}" \
	  --org "${INFLUXDB_ORG}" \
	  --token "${INFLUXDB_ADMINTOKEN}"
fi

# Start crond in the background
crond -f &

# Start nanohome services
/bin/bash /opt/nanohome/services/mqtt_shell -s &
/bin/bash /opt/nanohome/services/devwatcher_shelly_legacy &
/bin/bash /opt/nanohome/services/devwatcher_shelly_plus &
/bin/bash /opt/nanohome/services/measurements_shelly_legacy &
/bin/bash /opt/nanohome/services/measurements_shelly_plus &
#/bin/bash /opt/nanohome/services/standby_shelly_plus &

# Start bash
exec bash
