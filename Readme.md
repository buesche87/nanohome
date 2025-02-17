# Features

- Provides a customizable grafana dashboard for touch displays
- Control your shellies with a touch
- Move covers to a desired position with a slide
- Add your own visualizations and panels

![nanohome_home_dashboard](https://github.com/user-attachments/assets/b205292a-8536-4eeb-9875-8112ba491c36)

- Automatically detect shelly devices configured on mosquitto mqtt broker
- Connect devices components to nanohome and give them a name
- Create a dashboard panel with a simple click (button or slider for now)

![nanohome_device_manager](https://github.com/user-attachments/assets/e3c967d8-e1db-43de-b042-aeebb967a9fb)

- Monitor components (power, energy, temperatures and more)
- Write measurements from connected components into influxdb
- Visualize those measurements (a simple dashboard containing measurements for all connected devices is provided)

![nanohome_measurements](https://github.com/user-attachments/assets/b3998a9f-63a2-4d8e-837b-bb98bbf80d09)

- Create multiple timers/schedules for each component
- Turn shelly components on or off
- Open or close covers at a specific time

![nanohome_timer_manager](https://github.com/user-attachments/assets/a3a46be3-5413-4323-b933-81bb83c180da)

- TBD: Manage component standby (kill output if lower than defined power)

# Docker start

Every start the nanohome Docker prepares and validates the environment with the `start.sh` script

- Export additional variables (customize only if you know what you're doing)
- Validate or create an influx cli config
- Find or create neccessary influx buckets
- Validate or create a read-only influxdb api token that will be used in grafana for datasource connections
- If no grafana service account token provided in env-file, a service account will be created
- Additionally a new token will be generated every start, the old one gets deleted
- Validate grafana api connection with provided or created sa token
- Find or create grafana datasources for influx buckets
- Modify credentials in the public nanohome content for grafana
- Copy public content to the mapped directory (nanohome and grafana docker)
- Find or create nanohome dashboard folder in grafana
- Find or create nanohome dashboards in grafana
- Set home dashoard in grafana settings
- Validate connection to mosquitto mqtt broker
- Start nanohome services and cron deamon

# Prerequisites

You will need the following services up and running:

- Grafana
- InfluxDB
- Mosquitto

Preferably use docker and customize the containers as written below

Also your shelly devices need specific mqtt options set

## Shelly devices

Enable the following MQTT settings on your shelly devices:

- Enable 'MQTT Control'
- Enable RPC over MQTT
- RPC status notifications over MQTT
- Generic status update over MQTT

## Grafana docker

Modify the default grafana docker with the following settings

- Map `grafana.ini` to a custom path and modify its `[panels]` section

    ```
    disable_sanitize_html = true
    ```

- Map an additional path to the grafana docker. The host path contains the web content of nanohome. The same host path must be mapped to the nanohome docker.
    
    | Location | Path |
    | ----------- | ----------- |
    | Host | ./appdata/nanohome/data/grafana |
    | Container | /usr/share/grafana/public/nanohome |

- Install grafana plugins by defining corresponding env variable

    | Variable | Value |
    | ----------- | ----------- |
    | GF_INSTALL_PLUGINS | grafana-clock-panel |

## Mosquitto

Modify the default mosquitto docker with the following settings

- Map `mosquitto.conf` to a custom path, for example:

    | Location | Path |
    | ----------- | ----------- |
    | Host | ./appdata/mosquitto/config/mosquitto.conf |
    | Container | /mosquitto/config/mosquitto.conf |

- Copy the provided config file from `configs/mosquitto.conf` to the host path
- Create a password file from within the mosquitto docker

    ```
    mosquitto_passwd -U /mosquitto/data/passwd
    mosquitto_passwd -b /mosquitto/data/passwd <USERNAME> <PASSWORD>
    ```

- Enter these credentials in the nanohome .env file

# Nanohome environment

| Variable | Description | Example |
| ----------- | ----------- | ----------- |
| GRAFANA_HOST | url to grafana dashboard - used for panel and dashboard creation | http://grafana:3000 |
| GRAFANA_SERVICEACCOUNT_TOKEN | service account token - used for panel and dashboard creation |  |
| GRAFANA_SERVICE | only used for basic auth in start.sh | grafana:3000 |
| GRAFANA_ADMIN | only used for basic auth in start.sh | admin |
| GRAFANA_PASS | only used for basic auth in start.sh | admin |
| GRAFANA_SERVICEACCOUNT | only used for basic auth in start.sh | nanohome |
| INFLUX_HOST | url to influxdb - used to write data into buckets | http://influxdb:8086 |
| INFLUX_ORG | organisation name | nanohome |
| INFLUX_TOKEN | admin token - used for influx cli configuration |  |
| INFLUX_CONFIG | name of influx cli config | nanohome |
| MQTT_SERVER | hostname/fqdn of mqtt broker | mosquitto |
| MQTT_USER | mqtt user created with mosquitto_passwd | nanohome |
| MQTT_PASSWORD | mqtt password created with mosquitto_passwd |  |
| LOG_START | enable advanced logging of start.sh | true/false |
| LOG_SERVICES | enable advanced logging of nanohome services | true/false |
| LOG_EXEC | enable advanced logging of nanohome shell executables (bin) | true/false |
| LOG_DEBUG | enable debug logging | true/false |

If `GRAFANA_ADMIN`, `GRAFANA_PASS` and `GRAFANA_SERVICEACCOUNT` are set, a service account will be created automatically. On every start of the nanohome docker, a new api token will be created

# Clone and run

Clone repository to any directory

```
git clone https://github.com/buesche87/nanohome.git
```

## Build

```
cd nanohome
docker build -t nanohome .
```

## Configure

Copy example.env to .env and modify content

```
cp example.env .env
```

## Start

Example for starting the docker

```
docker run \
    --name nanohome \
    --env-file .env \
    --network nanohome \
    --mount type=bind,src=./appdata/nanohome/config,dst=/opt/nanohome/config \
    --mount type=bind,src=./appdata/nanohome/data,dst=/opt/nanohome/data \
    --mount type=bind,src=./appdata/nanohome/log,dst=/opt/nanohome/log \
    nanohome
```

# TODO

- Fix missing datasource in dashboard templates
- Finish and test standby manager
- Manage orphaned components
- Restart legacy measurement services on description change
- Implement shelly dimmer
- More icons for dashboard panels
- Docker health checks
