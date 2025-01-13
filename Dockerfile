FROM alpine:latest
LABEL maintainer="buesche"
RUN apk add --no-cache bash curl wget sed jq tar mosquitto-clients 

# runonce
RUN mkdir -p /opt/nanohome/config
RUN mkdir -p /opt/nanohome/log

# influx-cli
RUN mkdir -p ./influx-cli
RUN wget https://dl.influxdata.com/influxdb/releases/influxdb2-client-2.7.5-linux-amd64.tar.gz -O ./influx-cli/influx-cli.tar.gz
RUN tar xvzf ./influx-cli/influx-cli.tar.gz -C ./influx-cli
RUN mv ./influx-cli/influx /usr/local/bin/
RUN rm -rf ./influx-cli

WORKDIR /opt/nanohome

# Nanohome
COPY bin /opt/nanohome/bin
RUN chmod +x /opt/nanohome/bin/*
RUN ln -sf /opt/nanohome/bin/* /usr/local/bin/

COPY services /opt/nanohome/services
RUN chmod +x /opt/nanohome/services/*

COPY grafana-content /opt/nanohome/grafana-content
COPY grafana-templates /opt/nanohome/grafana-templates

# Defaults
COPY start.sh /start.sh
RUN chmod +x /start.sh
VOLUME /opt/nanohome
CMD ["/start.sh"]
