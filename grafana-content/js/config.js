
/*
===============================================================
	MQTT Options
===============================================================
*/

// Connection parameters for the JavaScript Websocket Client
var host = location.hostname;
var user = "mqtt_grafana"; // will be set from env
var pwd = "Grafana@MQTT"; // will be set from env
var port = 1884;
var useTLS = false;
var mqtt;
var reconnectTimeout = 2000;
var cleansession = true;
var path = "";
var mqttClient = "nanohome_dasboard";
var qos = 2;
var fastsubscribe = 50;
var normalsubscribe = 100;
var longsubscribe = 200;
var mqttConnected = false;

/*
===============================================================
	Nanohome Options
===============================================================
*/

// Nanohome shell topics
var cmdInputTopic = "nanohome/shell/input";
var cmdOutputTopic = "nanohome/shell/output";

// Weather widget preferences (set on first docker run)
var weatherWidgetLink = "https://forecast7.com/en/47d058d31/lucerne/";
var weatherWidgetCity = "Lucerne";

/*
===============================================================
	Global Variables
===============================================================
*/

var legacyKeywords = ["relay"];
var deviceTopicAll = "nanohome/devices/+";
var connectedTopicAll = "+/status/+/connected";
var connectedTopicAllLegacy = "shellies/+/+/+/connected";
var descriptionTopicAll = "+/status/+/description";
var descriptionTopicAllLegacy = "shellies/+/+/+/description";

// Return nanohome mqtt topics - [string payload]
function getNanohomeTopics(description) {
	return {
		deviceConfig:  "nanohome/devices/" + description,
		standbyConfig: "nanohome/standby/" + description,
		timerConfig:   "nanohome/timer/" + description
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

// Simple Paho JS Client
var mqttws31minLocation = "../public/nanohome/js/mqttws31.min.js";

/*
===============================================================
	Global Helper Functions
===============================================================
*/

// Rturn latest index in json array, return 1 if none is set
function getJsonIndex(payload) {
	let jsonIndex = 1;

	// Stop processing if payload is empty
    if ( elementHiddenOrMissing(payload) ) { return false; }

	for (var j = 0; j < payload.length; j++) {
		if (payload[j].index > jsonIndex) {
			jsonIndex = payload[j].index;
		}
	}

	// Increment index
	jsonIndex++;
	return jsonIndex;
}

// Check if html elements are hidden or missing
function elementHiddenOrMissing(...elements) {
	return elements.some(element => element === undefined || element === null);
}

// Check if variable is empty
function checkEmpty(variable) {
    return variable?.toString().trim() === "";
}

// Check if variable contains numbers only
function checkDigit(value) {
	return /^\d+$/.test(value);
}

// Execute command with nanohome shell
function shellCommand(payload) {
	mqttPublish(cmdInputTopic, payload, false);
	// console.log('Execute: ' + payload);
}
