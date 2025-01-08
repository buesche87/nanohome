#!/bin/bash

# Start crond in the background
crond -f &

# Start the MQTT shell script in the background
/bin/bash /opt/nanohome/driver/mqtt_shell -s &

# Start bash
exec bash