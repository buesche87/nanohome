FROM alpine:latest
LABEL maintainer="buesche"
RUN apk add --no-cache bash curl wget sed jq tar mosquitto-clients 
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
RUN wget -qO- influxdb2-client-latest-linux-amd64.tar.gz | tar -xzf - -C "/usr/local/bin/" "./influx"
# RUN wget -qO- https://dl.influxdata.com/influxdb/releases/influxdb2-client-2.7.5-linux-amd64.tar.gz | tar -xzf - -C "/usr/local/bin/" "./influx"
WORKDIR /nanohome
COPY start.sh /start.sh
RUN chmod +x /start.sh
VOLUME /nanohome
CMD ["/start.sh"]
