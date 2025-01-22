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
			connected:   device + "/status/" + deviceDetails.component + "/connected",
			description: device + "/status/" + deviceDetails.component + "/description",
			device:      "nanohome/devices/" + deviceDetails.description,
			home:        "nanohome/home/" + deviceDetails.description, 
			standby:     "nanohome/standby/" + deviceDetails.description,
			timer:       "nanohome/timer/" + deviceDetails.description,
			rpc:         device + "/rpc",
			rpcStatus:   "nanohome/devices/" + deviceDetails.description + "/status/rpc"
		}
	}
}

// Generate component json for deviceData Attribute
// Gets published to "nanohome/devices/#"
function createComponentJson(device, componentDetails) {
	let newComponentJson = {
		"deviceId": device,
		"component": componentDetails.component,
		"description": componentDetails.description,
		"legacy": componentDetails.legacy
	};
	return newComponentJson;
}

// Create timer json entry for "create_panel"
// Gets merged into json from "nanohome/devices/#"
function createDashboardJson(device, componentDetails, index) {
	let newPanelJson = {
		"index": index,
		"deviceId": device,
		"component": componentDetails.component,
		"description": componentDetails.description,
		"icon": componentDetails.exButtonImage,
		"legacy": componentDetails.legacy
	};
	return newPanelJson;
}

/*
---------------------------------------------------------------
	Helper Functions
---------------------------------------------------------------
*/

// Check latest index in json
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

// Check if html element is defined eg. not hidden or missing
function checkElement(element) {
	return typeof element !== "undefined" && element !== null;
}

// Execute command with nanohome shell
function shellCommand(payload) {
	mqttPublish(cmdInputTopic, payload, false);
	console.log('Execute: ' + payload);
}

