TODO:

- Scripte: Variabeln aus ENV lesen
- For your specific case, it might be better to use an ENTRYPOINT script which does the initialization, irrespective of wthether bash or sh or something else is called.
- When invoked as an interactive shell with the name sh, Bash looks for the variable ENV, expands its value if it is defined, and uses the expanded value as the name of a file to read and execute.
- timer.css  & standby.css cleanup
- influx-cli commands auf influx api umschreiben
- mosquitto_sub mit json format abholen > -F "%t,%p"
  - %j oder %J und --pretty
- /etc/crontab existiert nicht > root crontab nutzen?

------------------------------------
Build & Run:

    docker build -t nanohome .
    docker run -it --env-file .env --rm nanohome

------------------------------------
Folders:

    /mnt/data/appdata/nanohome
    /mnt/data/appdata/nanohome/bin/
    /mnt/data/appdata/nanohome/conf
    /mnt/data/appdata/nanohome/driver/
    /mnt/data/appdata/nanohome/grafana-content

------------------------------------
Install:

    bash
    influxcli
    influxdb2-client
    mosquitto-client


------------------------------------
ENV:

    # nanohome settings
[-] linuxuser="nanohome"
[-] linuxpass="DitoPI64"
[-] rootpath="/opt/nanohome"
[-] temppath="/tmp/nanohome"
[!] device_watcher_interval=30
[!] not_monitored_components=("ble" "cloud" "mqtt" "sys" "wifi" "ws" "status" "ht_ui" "input:*" "longpush:*")
    not_monitored_components_legacy=("input" "input_event")

    # Grafana Settings
[!] grafana_service="grafana:3000"

    # InfluxDB settings
[!] influxdb_service="influx:8086"
    influxdb_adminpass="DitoPI64"
[!] influxdb_admintoken="EJIOHNSXDTZBDWIU23"
[!] influxdb_bucket_devices="devices"
[!] influxdb_bucket_measurements="measurements"

    # MQTT settings
[!] mqtt_service="mosquitto:1883"
[!] mqtt_service_user="mqtt_system"
[!] mqtt_service_password="System@MQTT"

    var fastsubscribe = 250;
    var normalsubscribe = 500;
    var longsubscribe = 1000;



    # MQTT Shell settings
[!] allowed_commands=("create_dashboardelement" "create_timer" "delete_device" "delete_measurement" )


    # Deprecated?
[-] mqtt_grafana_user="mqtt_grafana"
[-] mqtt_grafana_pass="Grafana@MQTT"
[-] mqtt_shelly_user="mqtt_shelly"
[-] mqtt_shelly_pass="Shelly@MQTT"
[-] mqtt_dash_user="mqtt_dash"
[-] mqtt_dash_pass="Dash@MQTT"
[-] home_uid="XieEaLmRk"
[-] zsp_uid="MCbNuLdVk"
[-] settings_uid="sYOGRUiRz"


------------------------------------
Durch ENV überschereiben:

   /mnt/data/appdata/nanohome/grafana-content/js/mqttconfig.js
   - var host = location.hostname;
   - var user = "mqtt_grafana";
   - var pwd = "Grafana@MQTT";
   - var port = 1884;


