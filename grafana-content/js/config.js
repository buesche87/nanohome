
/*
===============================================================
	MQTT Options
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
var fastsubscribe = 250;
var normalsubscribe = 500;
var longsubscribe = 1000;
var mqttConnected = false;

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
var deviceTopicAll = "nanohome/devices/+";
var outputTopicAll = "+/status/+/output";
var outputTopicAllLegacy = "shellies/+/relay/0";
var connectedTopicAll = "+/status/+/connected";
var connectedTopicAllLegacy = "shellies/+/+/+/connected";
var descriptionTopicAll = "+/status/+/description";
var descriptionTopicAllLegacy = "shellies/+/+/+/description";

// Return nanohome mqtt topics
function getNanohomeTopics(description) {
	return {
		device:      "nanohome/devices/" + description,
		standby:     "nanohome/standby/" + description,
		timer:       "nanohome/timer/" + description
	}
}

// Return devices mqtt topics - [object payload]
function getDeviceTopics(componentDetails) {
	if ( componentDetails.legacy ) {
		let componentSplit = componentDetails.component.split(":");
		return {
			connected:   "shellies/" + componentDetails.deviceId + "/" + componentSplit[0] + "/" + componentSplit[1] + "/connected",
			description: "shellies/" + componentDetails.deviceId + "/" + componentSplit[0] + "/" + componentSplit[1] + "/description",
		}
	} else {
		return {
			connected:   componentDetails.deviceId + "/status/" + componentDetails.component + "/connected",
			description: componentDetails.deviceId + "/status/" + componentDetails.component + "/description",
			rpc:         componentDetails.deviceId + "/rpc",
			rpcSource:   "nanohome/devicestatus/" + componentDetails.deviceId,
			rpcDest:     "nanohome/devicestatus/" + componentDetails.deviceId + "/rpc"
		}
	}
}

/*
===============================================================
	3rd Party .js
===============================================================
*/

// MQTT Websocket min.js
var mqttws31minLocation = "../public/nanohome/js/mqttws31.min.js";
