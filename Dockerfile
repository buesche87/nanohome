FROM alpine:latest
LABEL maintainer="buesche"
RUN apk add --no-cache bash curl sed jq mosquitto-clients 
WORKDIR /opt/nanohome

# Executables
COPY bin /opt/nanohome/bin
RUN chmod +x /opt/nanohome/bin/*
RUN ln -sf /opt/nanohome/bin/* /usr/local/bin/

# Services
COPY services /opt/nanohome/services
RUN chmod +x /opt/nanohome/services/*

# Templates & config
COPY templates /opt/nanohome/templates

# Startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Volumes
VOLUME /opt/nanohome

# Default command
CMD ["/start.sh"]
