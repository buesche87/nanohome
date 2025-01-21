FROM alpine:latest
LABEL maintainer="buesche"
RUN apk add --no-cache bash curl wget sed jq tar mosquitto-clients 
RUN mkdir -p /opt/nanohome/config
RUN mkdir -p /opt/nanohome/data
RUN mkdir -p /opt/nanohome/log
COPY bin /opt/nanohome/bin
RUN chmod +x /opt/nanohome/bin/*
RUN ln -sf /opt/nanohome/bin/* /usr/local/bin/
COPY services /opt/nanohome/services
RUN chmod +x /opt/nanohome/services/*
COPY grafana-content /opt/nanohome/grafana-content
COPY grafana-templates /opt/nanohome/grafana-templates
RUN wget -qO- https://dl.influxdata.com/influxdb/releases/influxdb2-client-2.7.5-linux-amd64.tar.gz | tar -xzf - -C "/usr/local/bin/" "./influx"
WORKDIR /opt/nanohome
COPY start.sh /start.sh
RUN chmod +x /start.sh
VOLUME /opt/nanohome
CMD ["/start.sh"]
