
/*
===============================================================
	MQTT Websocket Connection
===============================================================
*/

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

/*
===============================================================
	Pub/Sub Options
===============================================================
*/

var fastsubscribe = 250;
var normalsubscribe = 500;
var longsubscribe = 1000;

/*
===============================================================
	Nanohome Shell
===============================================================
*/

var cmdInputTopic = "nanohome/shell/input";
var cmdOutputTopic = "nanohome/shell/output";

/*
===============================================================
	Global Variables
===============================================================
*/

var legacyKeywords = ["relay"];

var connectedTopicAll = "+/status/+/connected";
var descriptionTopicAll = "+/status/+/description";
var outputTopicAll = "+/status/+/output";
var deviceTopicAll = "nanohome/devices/+";
var standbyTopicAll = "nanohome/standby/+";
var timerTopicAll = "nanohome/timer/+";

var outputTopicAllLegacy = "shellies/+/relay/0";
var connectedTopicAllLegacy = "shellies/+/+/+/connected";
var descriptionTopicAllLegacy = "shellies/+/+/+/description";

/*
===============================================================
	3rd Party .js
===============================================================
*/

// MQTT Websocket min.js
var mqttws31minLocation = "../public/nanohome/js/mqttws31.min.js";
