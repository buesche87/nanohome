# syntax=docker/dockerfile:1
FROM alpine:latest
WORKDIR /nanohome
LABEL maintainer="buesche"
RUN apk add --no-cache bash curl wget sed jq tar mosquitto-clients tzdata
ENV TZ=${TZ}
RUN mkdir -p /nanohome/config
RUN mkdir -p /nanohome/data
RUN mkdir -p /nanohome/log
COPY bin /nanohome/bin
RUN chmod +x /nanohome/bin/*
RUN ln -sf /nanohome/bin/* /usr/local/bin/
COPY services /nanohome/services
RUN chmod +x /nanohome/services/*
COPY grafana-content /nanohome/grafana-content
COPY grafana-templates /nanohome/grafana-templates
# RUN wget -qO- https://dl.influxdata.com/influxdb/releases/influxdb2-client-latest-linux-amd64.tar.gz | tar -xzf - -C "/usr/local/bin/" "./influx"
COPY start.sh /start.sh
RUN chmod +x /start.sh
VOLUME /nanohome
CMD ["/start.sh"]