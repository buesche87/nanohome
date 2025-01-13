/*
 ---------------------------------------------------------------
    MQTT Functions
 ---------------------------------------------------------------
*/

// Check MQTT Status
function checkMqttStatus() {
    if(mqttConnected) {
        return true;
    } else {
        window.setTimeout(checkMqttStatus, 50);
        console.log("MQTT not connected. Retrying");
    }
}

// MQTT Connect
function MQTTconnect() {
    mqtt = new Paho.MQTT.Client(host, port, path, mqttClient + parseInt(Math.random() * 100, 10));

    var options = {	timeout: 3,	useSSL: useTLS,	cleanSession: cleansession,	onSuccess: onConnect,
        onFailure: function (message) {
            console.log("Connection failed: " + message.errorMessage + "Retrying");
            setTimeout(MQTTconnect, reconnectTimeout);
        },
    };

    mqtt.onConnectionLost = onConnectionLost;
    mqtt.onMessageArrived = onMessageArrived;

    if (user != null) {
        options.userName = user;
        options.password = pwd;
    }
    mqtt.connect(options);
}

// OnConnect
function onConnect() {
    mqttConnected = true;
    console.log("Connected to: " + host + ":" + port + path);
}

// onConnectionLost - Retry
function onConnectionLost(response) {
    mqttConnected = false;
    setTimeout(MQTTconnect, reconnectTimeout);
    console.log("Connection lost: " + response.errorMessage + ". Reconnecting");
}

// Publish new message to mqtt topic
function mqttPublish(topic, payload, retained) {
    if (!mqttConnected) {
        window.setTimeout(mqttPublish, 50);
        console.log("mqttPublish: MQTT not connected. Retrying - Topic: " + topic);
    } else {
        var message = new Paho.MQTT.Message(payload);
        message.destinationName = topic;
        message.retained = retained;
        mqtt.send(message);
    }

    console.log('Publish: ' + topic + ' < ' + payload);
}

// Check mqtt connection, subscribe to topic and unsubscribe after 2 seconds
function mqttSubscribe(topic, timeout) {
    if (!mqttConnected) {
        window.setTimeout(mqttSubscribe, 50);
        console.log("mqttSubscribe: MQTT not connected. Retrying - Topic: " + topic);
    } else {
        mqtt.subscribe(topic, { qos: 2 });
        setTimeout(() => {
            mqtt.unsubscribe(topic);
        }, timeout);
    }
}

/*
 ---------------------------------------------------------------
    MQTT Connect
 ---------------------------------------------------------------
*/

// Connect MQTT
if (typeof Paho === "undefined") {
    var mqttwsScript = document.createElement("script");
    document.body.appendChild(mqttwsScript);
    mqttwsScript.onload = function () {
        MQTTconnect();
    };
    mqttwsScript.src = mqttws31minLocation;
} else {
    MQTTconnect();
}

