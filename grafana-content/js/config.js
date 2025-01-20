// TODO:
// - Dashbaords: Load config.js

/*
 ---------------------------------------------------------------
    MQTT Configuration
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

/*
---------------------------------------------------------------
	MQTT Topics
---------------------------------------------------------------
*/

// Global Topics
var cmdInputTopic = "nanohome/shell/input";
var cmdOutputTopic = "nanohome/shell/output";
var dashboardTopic = "nanohome/home/dashboard";

// Device topics
var connectedTopicAll = "+/status/+/connected";
var descriptionTopicAll = "+/status/+/description";
var outputTopicAll = "+/status/+/output";
var standbyTopicAll = "nanohome/+/standby";

// Device topics legacy
var outputTopicAllLegacy = "shellies/+/relay/0";
var connectedTopicAllLegacy = "shellies/+/+/+/connected";
var descriptionTopicAllLegacy = "shellies/+/+/+/description";

/*
---------------------------------------------------------------
	3rd party js
---------------------------------------------------------------
*/

// MQTT Websocket min.js
var mqttws31minLocation = "../public/nanohome/js/mqttws31.min.js";
