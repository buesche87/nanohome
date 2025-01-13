/*
 ---------------------------------------------------------------
    MQTT Variables
 ---------------------------------------------------------------
*/

// MQTT Connection
var host = location.hostname;
var user = "mqtt_grafana";
var pwd = "Grafana@MQTT";
var port = 1884;
var useTLS = false;
var mqtt;
var reconnectTimeout = 2000;
var cleansession = true;
var path = "";
var mqttClient = "nanohome_dasboard";
var mqttConnected = false;
var fastsubscribe = 250;
var normalsubscribe = 500;
var longsubscribe = 1000;
var legacyKeywords = ["relay"];

// MQTT Topics
var cmdInputTopic = "input_command";
var cmdOutputTopic = "output_command";
var outputTopic = "+/status/+/output";
var statusOutTopicRoot = "shellystatus";

// Device manager
var connectedTopic = "+/status/+/connected";
var descriptionTopic = "+/status/+/description";
var dashboardTopic = "nanohome/config/dashboard";

// Timer & standby
var timerTopic = "nanohome/+/timer";
var standbyTopic = "nanohome/+/standby";

// Legacy Topics
var legacyTopicRoot = "shellies";
var outputTopicLegacy = "shellies/+/relay/0";
var connectedTopicLegacy = "shellies/+/+/+/connected";
var descriptionTopicLegacy = "shellies/+/+/+/description";

// MQTT Websocket min.js
var mqttws31minLocation = "../public/nanohome/js/mqttws31.min.js";
