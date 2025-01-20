// TODO: Test


/*
---------------------------------------------------------------
	Attributes and html element prefixes on dashboard (REMOVE)
---------------------------------------------------------------
*/

var deviceAttribute = "deviceData";
var timerAttribute = "timerData";
var standbyAttribute = "standbyData";

/*
---------------------------------------------------------------
	Global Functions
---------------------------------------------------------------
*/

// return device commands for current device
function getDeviceCommands(device, deviceDetails) {
	if (deviceDetails.legacy) {
		return {
			createPanel:      'create_panel "' + deviceDetails.description + '" "legacy"',
			removeDevice:     'remove_device "' + device + '" "' + deviceDetails.component + '" "' + deviceDetails.description + '" "legacy"',
			clearMeasurement: 'clear_measurement "' + deviceDetails.description + '"'
		}
	} else {
		return {
			createPanel:      'create_panel "' + deviceDetails.description + '"',
			removeDevice:     'remove_device "' + device + '" "' + deviceDetails.component + '" "' + deviceDetails.description + '"',
			clearMeasurement: 'clear_measurement "' + deviceDetails.description + '"'
		}
	}
}

// return mqtt topics for current device
function getMqttTopics(device, deviceDetails) {
	if (deviceDetails.legacy) {
		let componentSplit = deviceDetails.component.split(":");
		return {
			connected:   "shellies/" + device + "/" + componentSplit[0] + "/" + componentSplit[1] + "/connected",
			description: "shellies/" + device + "/" + componentSplit[0] + "/" + componentSplit[1] + "/description",
			device:      "nanohome/devices/" + deviceDetails.description,
			home:        "nanohome/home/" + deviceDetails.description, 
			standby:     "nanohome/standby/" + deviceDetails.description,
			timer:       "nanohome/timer/" + deviceDetails.description
		}
	} else {
		return {
			connected:    device + "/status/" + deviceDetails.component + "/connected",
			description:  device + "/status/" + deviceDetails.component + "/description",
			device:      "nanohome/devices/" + deviceDetails.description,
			home:        "nanohome/home/" + deviceDetails.description, 
			standby:     "nanohome/standby/" + deviceDetails.description,
			timer:       "nanohome/timer/" + deviceDetails.description,
			rpc:          device + "/rpc",
			rpcStatus:   "nanohome/devices/" + deviceDetails.description + "/status/rpc"
		}
	}
}

// OLD: REMOVE
function getTimerTopics(description) {
	return {
		deviceTopic: "nanohome/" + description + "/device",
		timerTopic:  "nanohome/" + description + "/timer"
	}
}

// generate component json for deviceData Attribute
// gets published to "nanohome/devices/description"
function createComponentJson(device, componentDetails) {
	let newElement = {
		"usage": "device",
		"deviceId": device,
		"component": componentDetails.component,
		"description": componentDetails.description,
		"legacy": componentDetails.legacy
	};
	return newElement;
}

// create a json to be used for "create_panel"
// gets merged into json from "nanohome/devices/description"
function createDashboardJson(device, componentDetails, index) {
	let newElement = {
		"index": index,
		"usage": "dashboard",
		"deviceId": device,
		"component": componentDetails.component,
		"description": componentDetails.description,
		"icon": componentDetails.exButtonImage
	};
	return newElement;
}


/*
---------------------------------------------------------------
	Helper Functions
---------------------------------------------------------------
*/

// check latest index in json
function checkJsonIndex(payload) {
	let jsonIndex = 1;

	if (checkElement(payload)) {
		for (var j = 0; j < payload.length; j++) {
			if (payload[j].index > jsonIndex) {
				jsonIndex = payload[j].index;
			}
		}
		jsonIndex++;
	}
	return jsonIndex;
}

// check if html element is defined eg. not hidden or missing
function checkElement(element) {
	return typeof element !== "undefined" && element !== null;
}

// send command with mqtt_shell
function shellCommand(payload) {
	mqttPublish(cmdInputTopic, payload, false);
	console.log('Execute: ' + payload);
}

