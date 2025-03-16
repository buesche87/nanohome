# Features

## Customizable touch dashboard
- Provides a customizable dashboard designed for touch displays
- Control your shellies by touch or swipe
- Add a control panel from the devicemanager or your own visualizations

![screenshot_home](https://github.com/user-attachments/assets/d9677096-298b-4b6f-997f-f8830d34a192)

## Device management
- Automatically detect Shelly devices on your mqtt broker
- Connect their output(s) to nanohome, give them a name and an icon
- Create a dashboard panel by touching the example panel (button or slider)

![screenshot_devicemanager](https://github.com/user-attachments/assets/6f68a453-f050-44b3-b7b6-2e5189bea46a)

## Measurements
- Monitor your shellies (power, current, temperatures and more)
- Archive these measurements in influxdb and visualize them on this simple dashboard
- Or create a new dashboard to your liking

![screenshot_measurements](https://github.com/user-attachments/assets/7d1185df-571b-4bba-9692-0e1e797b6d54)

## Timer / Scheduler
- Create multiple timer for each connected output
- Schedule on or off states or open/close covers at a specific time

![screenshot_timer](https://github.com/user-attachments/assets/3f9ecb12-52f9-4b18-95dd-7cdd90b84d0b)

## Standby Manager
- Turn off an output if the plugged in device draws less power than defined
- Use a delay to prevent power off during device startup

![screenshot_standby](https://github.com/user-attachments/assets/be150755-f227-4a9d-9cdd-87e704d17c25)

# Prerequisites

## Shelly Devices

Your Shelly devices need specific mqtt options set. Make sure the following settings are enabled:

- Enable 'MQTT Control'
- Enable RPC over MQTT
- RPC status notifications over MQTT
- Generic status update over MQTT

To connect your shellies to your mqtt broker use the following credentials

| setting | value |
| ----------- | ----------- |
| server | `MQTT_Server`:1883 |
| username | `MQTT_USER` |
| password | `MQTT_PASSWORD` |

> You can use the credentials from your `.env` file or create new ones with

```
docker exec -ti mosquitto mosquitto_passwd -b /mosquitto/data/passwd <USERNAME> <PASSWORD>
```

## Services

Nanohome depends on the following services:

- Grafana
- InfluxDB
- Mosquitto (or any other mqtt broker)

Use the quick start chapter to get up and running in no time

If you'd like to manually setup your environment, use the instructions provided in chapter "Manual Installation"

# Quick Start - Docker Compose

To setup nanohome with all dependencies follow these instructions.

- Clone repository to any directory

```
git clone https://github.com/buesche87/nanohome.git
cd nanohome
```

- Make a copy of `example.env` and modify its content

```
cp example.env .env
nano .env
```

> You can find more information about nanohomes environment variables in the "Manual Installation" chapter

- Create neccessary directories and copy config files

```
/bin/bash prepare.sh
```

- Get the stack up and running

```
docker compose up -d
```

# Standalone Installation

If you'd like to use existing containers of Grafana, InfluxDB and/or Mosquitto you can prepare them with the following steps

## Prepare Grafana

- Map an additional path to the grafana container

    | location | path |
    | ----------- | ----------- |
    | host | ./appdata/nanohome/data/grafana |
    | container | /usr/share/grafana/public/nanohome |

    > This path will contain nanohomes web content

    > The same path has to be mapped to the nanohome container. Nanohome will copy its web content at container start

- Define the following variables

    | variable | value | description |
    | ----------- | ----------- | ----------- |
    | GF_PANELS_DISABLE_SANITIZE_HTML | true | allow html tags in markup panels |
    | GF_INSTALL_PLUGINS | grafana-clock-panel | install clock panel |

- Provide a service account token or admin credentials in nanohomes `.env` file

    > You can manually create a service account and an api token. The service account needs admin rights. Add the token secret to the `.env` file

    > Or you can provide admin credentials and a name for a new service account in the `.env` file. Nanohome will then create a service account and api token at container start

## Prepare InfluxDB

- Manually generate an `all access token` in InfluxDB
- Provide its secret in nanohomes `.env` file
- Provide your organisation name in nanohomes `.env` file

## Prepare Mosquitto

- Extend your `mosquitto.conf` with the settings provided in `configs/mosquitto.conf`

- Create a password file and/or a user from within the mosquitto docker

    ```
    touch /mosquitto/data/passwd
    mosquitto_passwd -b /mosquitto/data/passwd <USERNAME> <PASSWORD>
    ```

- Provide the same credentials in nanohomes `.env` file

## Run Nanohome

https://hub.docker.com/repository/docker/buesche87/nanohome

Alterantively:

- Clone repository to any directory

```
git clone https://github.com/buesche87/nanohome.git
cd nanohome
```

- Make a copy of `example.env` and modify its content

```
cp example.env .env
nano .env
```

- Prepare the directories

    > Use the commands in `prepare.sh` to get an idea

- Build the container

```
docker build -t nanohome .
```

- Start the container

```
docker run \
    --name nanohome \
    --env-file .env \
    --mount type=bind,src=./appdata/nanohome/data,dst=/nanohome/data \
    nanohome
```

# Additional Information

## Nanohome environment

| Variable | Description | Example |
| ----------- | ----------- | ----------- |
| GRAFANA_HOST | url to grafana dashboard - used for panel and dashboard creation | http://grafana:3000 |
| GRAFANA_SERVICEACCOUNT_TOKEN | service account token with admin privileges - used for panel and dashboard creation |  |
| GRAFANA_SERVICE | only needed if no GRAFANA_SERVICEACCOUNT_TOKEN is set | grafana:3000 |
| GRAFANA_ADMIN | only needed if no GRAFANA_SERVICEACCOUNT_TOKEN is set | admin |
| GRAFANA_PASS | only needed if no GRAFANA_SERVICEACCOUNT_TOKEN is set | admin |
| INFLUXDB_HOST | url to influxdb - used to write data into buckets | http://influxdb:8086 |
| INFLUXDB_ORG | your organisations name | nanohome |
| INFLUXDB_TOKEN | admin token - used for influx cli |  |
| MQTT_SERVER | hostname/fqdn of mqtt broker | mosquitto |
| MQTT_USER | mqtt user created with mosquitto_passwd | nanohome |
| MQTT_PASSWORD | mqtt password created with mosquitto_passwd | securepassword |
| LOG_SERVICES | enable advanced logging of nanohome services | true |
| LOG_EXEC | enable advanced logging of nanohome shell executables (bin) | true |
| LOG_DEBUG | enable debug logging | true |

## Docker start procedure

Every container start the nanohome validates the environment with the commands found in `start.sh`

- Export additional variables (customize only if you know what you're doing)
- Validate or create an influx cli config
- Find or create neccessary influx buckets
- Validate or create a read-only influxdb api token that will be used for grafana datasource connections
- If no grafana service account token provided in env-file, a service account will be created
- Additionally a new token will be generated every start, the old one gets deleted
- Validate grafana api connection with provided or created sa token
- Find or create grafana datasources for influx buckets
- Modify credentials in nanohomes web content for grafana
- Replace web content in mapped directory
- Find or create nanohome dashboard folder in grafana
- Find or create nanohome dashboards in grafana
- Set home dashoard in grafana settings
- Validate connection to mqtt broker
- Start nanohome services and cron deamon

## TODO

- [done] Fix missing datasource in dashboard templates
- [done] start.sh: only set home dashboard if not already set
- [done] Docker health checks
- [done] Create/finish a docker compose for all services
- Finish and test standby manager
- Manage orphaned devices and components
- Restart legacy measurement services on description change
- Implement shelly dimmer
- More icons for dashboard panels
