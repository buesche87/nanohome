FROM alpine:latest
LABEL maintainer="buesche"
RUN apk add --no-cache bash curl git sed jq mosquitto-clients 
WORKDIR /opt/nanohome

RUN git clone https://github.com/buesche87/nanohome.git /opt/nanohome


VOLUME /opt/nanohome

# Add a script to start both crond and bash
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Default command
CMD ["/start.sh"]
