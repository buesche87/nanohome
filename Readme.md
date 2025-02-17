# Features

## Customizable touch dashboard
- Provides a customizable grafana dashboard, designed for touch displays
- Control your shellies with a touch or a slide
- Add your own visualizations and panels

![nanohome_home_dashboard](https://github.com/user-attachments/assets/b205292a-8536-4eeb-9875-8112ba491c36)

## Device management
- Automatically detects Shelly devices on your mqtt broker
- Connect their components to nanohome and give them a name
- Create a dashboard panel in one touch (button or slider)

![nanohome_device_manager](https://github.com/user-attachments/assets/e3c967d8-e1db-43de-b042-aeebb967a9fb)

## Measurements
- Monitor your shellies (power, voltage, temperatures and more)
- Archive measurements from connected components in influxdb
- Visualize those measurements on a simple dashboard
- Or create a dashboard to your liking

![nanohome_measurements](https://github.com/user-attachments/assets/b3998a9f-63a2-4d8e-837b-bb98bbf80d09)

## Timer / Scheduler
- Create multiple timer for each connected component
- Turn your components on or off on a schedule
- Open or close covers at a specific time

![nanohome_timer_manager](https://github.com/user-attachments/assets/a3a46be3-5413-4323-b933-81bb83c180da)

## Standby Manager
> Work in progress

Manage your devices standby power
- Turn off a components output if the plugged in device draws less power than defined
- Use a timeout for safety mechanisms like a delay for device startups

# Prerequisites

## Shelly devices

Your Shelly devices need specific mqtt options set. Make sure the following are enabled:

- Enable 'MQTT Control'
- Enable RPC over MQTT
- RPC status notifications over MQTT
- Generic status update over MQTT

## Services

You will need the following services up and running

- Grafana
- InfluxDB
- Mosquitto (or any other mqtt broker)

> If you choose docker you can customize the containers as written below

### Grafana

There is content to be mapped into the container:

- Map a custom `grafana.ini` to the container

    | location | path |
    | ----------- | ----------- |
    | host | ./appdata/grafana/config/grafana.ini |
    | container | /etc/grafana/grafana.ini |

- Modify the `[panels]` section in `grafana.ini`

    ```
    disable_sanitize_html = true
    ```

- Map an additional path to the grafana container. 

    | location | path |
    | ----------- | ----------- |
    | host | ./appdata/nanohome/data/grafana |
    | container | /usr/share/grafana/public/nanohome |

> This host path contains nanohomes web content. The same path has to be mapped to the nanohome container

- Install grafana plugins by defining corresponding env-variable

    | variable | value |
    | ----------- | ----------- |
    | GF_INSTALL_PLUGINS | grafana-clock-panel |

- Provide a service account token or admin credentials in nanohomes `.env` file

> You can manually create a service account and an api token. For now, the service account needs admin rights. Add the token secret to the `.env` file

> Or you can provide your admin credentials and a name for a new service account in the `.env` file. Then, at docker start, a service account and an api token will be created

### InfluxDB

- Manually generate an `all access token` in InfluxDB
- Provide its secret in nanohomes `.env` file
- Provide your organisation name in nanohomes `.env` file

### Mosquitto

- Replace `./appdata/mosquitto/config/mosquitto.conf` with the provided `configs/mosquitto.conf` 

- Create a password file from within the mosquitto docker

    ```
    mosquitto_passwd -U /mosquitto/data/passwd
    mosquitto_passwd -b /mosquitto/data/passwd <USERNAME> <PASSWORD>
    ```

- Provide the same credentials in nanohomes `.env` file

# Run nanohome

## Clone
- Clone repository to any directory

```
git clone https://github.com/buesche87/nanohome.git

cd nanohome
```

## Configure

- Copy example.env to .env and modify content

```
cp example.env .env
```

## Prepare directories

- You can use the commands in `prepare.sh` to get an idea

## Build

```
docker build -t nanohome .
```

## Start

Start the nanohome container and optionally assign it to a custom network named nanohome

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

# Additional Information

## Nanohome environment

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

## Docker start procedure

Every start the nanohome Docker prepares and validates the environment with the `start.sh` script

- Export additional variables (customize only if you know what you're doing)
- Validate or create an influx cli config
- Find or create neccessary influx buckets
- Validate or create a read-only influxdb api token that will be used in grafana for datasource connections
- If no grafana service account token provided in env-file, a service account will be created
- Additionally a new token will be generated every start, the old one gets deleted
- Validate grafana api connection with provided or created sa token
- Find or create grafana datasources for influx buckets
- Modify credentials in nanohomes web content for grafana
- Copy web content to  mapped directory
- Find or create nanohome dashboard folder in grafana
- Find or create nanohome dashboards in grafana
- Set home dashoard in grafana settings
- Validate connection to mqtt broker
- Start nanohome services and cron deamon

## TODO

- [done] Fix missing datasource in dashboard templates
- start.sh: only set home dashboard if not already set
- Finish and test standby manager
- Manage orphaned devices and components
- Restart legacy measurement services on description change
- Implement shelly dimmer
- More icons for dashboard panels
- Docker health checks
- Create/finish a docker compose for all services
