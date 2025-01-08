#!/bin/bash

# Start crond in the background
crond -f &

# Start nanohome services
#/bin/bash /opt/nanohome/services/mqtt_shell -s &
#/bin/bash /opt/nanohome/driver/shelly_plus_devwatcher &
#/bin/bash /opt/nanohome/driver/shelly_plus_measurements & 
#/bin/bash /opt/nanohome/driver/shelly_plus_standby &
#/bin/bash /opt/nanohome/driver/shelly_legacy_devwatcher &
#/bin/bash /opt/nanohome/driver/shelly_legacy_measurements &

# Start bash
exec bash