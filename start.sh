#!/bin/bash

# Start crond in the background
crond -f &

# Start nanohome services
/bin/bash /opt/nanohome/services/mqtt_shell -s &
/bin/bash /opt/nanohome/services/devwatcher_shelly_legacy &
#/bin/bash /opt/nanohome/services/devwatcher_shelly_plus & 
#/bin/bash /opt/nanohome/services/measurements_shelly_legacy &
#/bin/bash /opt/nanohome/services/measurements_shelly_plus &
#/bin/bash /opt/nanohome/standby_shelly_plus &

# Start bash
exec bash
