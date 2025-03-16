# Features

## Customizable touch dashboard
- Provides a customizable grafana dashboard designed for touch displays
- Control your shellies by touch or swipe
- Add your own visualizations to the dashboard

![screenshot_home](https://github.com/user-attachments/assets/e92c3603-4379-41fe-b807-7ec45e4fe8f9)

## Device management
- Automatically detect Shelly devices on your mqtt broker
- Connect their components to nanohome and give them a name
- Create a dashboard panel in one touch (button or slider)

![screenshot_devicemanager](https://github.com/user-attachments/assets/4707e7d1-5b61-41ae-846b-ecb8e13061a1)

## Measurements
- Monitor your shellies (power, voltage, temperatures and more)
- Archive measurements from connected components in influxdb
- Visualize those measurements on a simple dashboard
- Or create a new dashboard to your liking

![nanohome_measurements](https://github.com/user-attachments/assets/b3998a9f-63a2-4d8e-837b-bb98bbf80d09)

## Timer / Scheduler
- Create multiple timer for each connected component
- Schedule on or off states
- Open or close covers at a specific time

![screenshot_timer](https://github.com/user-attachments/assets/3c8a369d-0e18-4478-a1bc-484619915dbd)

## Standby Manager
- Turn off output if the plugged in device draws less power than defined
- Use a delay to prevent power off during device startup

![screenshot_standby](https://github.com/user-attachments/assets/025dd213-6411-43ea-a607-223ac332ff87)

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
| server | MQTTBROKERIP:1883 |
| username | `MQTT_USER` in `.env` |
| password | `MQTT_PASSWORD` in `.env` |

## Services

Nanohome depends on the following services:

- Grafana
- InfluxDB
- Mosquitto (or any other mqtt broker)

Use the instruction in chapter `Docker Compose` to setup all services

> If you'd like to use an existing installation of those services, use the instructions provided in chapter "Manual Installation"


# Docker Compose

To setup nanohome with all dependencies follow these instructions:

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

- Map a custom `grafana.ini` to the container

    | location | path |
    | ----------- | ----------- |
    | host | ./appdata/grafana/config/grafana.ini |
    | container | /etc/grafana/grafana.ini |

- Modify the `[panels]` section in `grafana.ini`

    ```
    disable_sanitize_html = true
    ```

- Map an additional path to the grafana container

    | location | path |
    | ----------- | ----------- |
    | host | ./appdata/nanohome/data/grafana |
    | container | /usr/share/grafana/public/nanohome |

    > This path will contain nanohomes web content

    > The same path has to be mapped to the nanohome container. Nanohome will copy its web content at container start

- Install grafana plugins by defining corresponding environment variable

    | variable | value |
    | ----------- | ----------- |
    | GF_INSTALL_PLUGINS | grafana-clock-panel |

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
| GRAFANA_SERVICEACCOUNT_TOKEN | service account token - used for panel and dashboard creation |  |
| GRAFANA_SERVICE | only needed if no GRAFANA_SERVICEACCOUNT_TOKEN is set | grafana:3000 |
| GRAFANA_ADMIN | only needed if no GRAFANA_SERVICEACCOUNT_TOKEN is set | admin |
| GRAFANA_PASS | only needed if no GRAFANA_SERVICEACCOUNT_TOKEN is set | admin |
| GRAFANA_SERVICEACCOUNT | only needed if no GRAFANA_SERVICEACCOUNT_TOKEN is set | nanohome |
| INFLUX_HOST | url to influxdb - used to write data into buckets | http://influxdb:8086 |
| INFLUX_ORG | your organisations name | nanohome |
| INFLUX_TOKEN | admin token - used for influx cli |  |
| INFLUX_CONFIG | name of influx cli config | nanohome |
| MQTT_SERVER | hostname/fqdn of mqtt broker | mosquitto |
| MQTT_USER | mqtt user created with mosquitto_passwd | nanohome |
| MQTT_PASSWORD | mqtt password created with mosquitto_passwd |  |
| LOG_START | enable advanced logging of start.sh | true/false |
| LOG_SERVICES | enable advanced logging of nanohome services | true/false |
| LOG_EXEC | enable advanced logging of nanohome shell executables (bin) | true/false |
| LOG_DEBUG | enable debug logging | true/false |

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
