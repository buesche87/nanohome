/*
---------------------------------------------------------------
	Global Functions
---------------------------------------------------------------
*/

// return device commands for current device
function getDeviceCommands(device, deviceDetails) {
	if (deviceDetails.legacy) {
		return {
			createPanel:      'create_panel "' + deviceDetails.description + '"',
			removeComponent:  'remove_component "' + deviceDetails.description + '"',
			clearMeasurement: 'clear_measurement "' + deviceDetails.description + '"'
		}
	} else {
		return {
			createPanel:      'create_panel "' + deviceDetails.description + '"',
			removeComponent:  'remove_component "' + deviceDetails.description + '"',
			clearMeasurement: 'clear_measurement "' + deviceDetails.description + '"'
		}
	}
}

// return mqtt topics for current device
function getDeviceTopics(device, componentDetails) {
	if (componentDetails.legacy) {
		let componentSplit = componentDetails.component.split(":");
		return {
			connected:   "shellies/" + device + "/" + componentSplit[0] + "/" + componentSplit[1] + "/connected",
			description: "shellies/" + device + "/" + componentSplit[0] + "/" + componentSplit[1] + "/description",
		}
	} else {
		return {
			connected:   device + "/status/" + componentDetails.component + "/connected",
			description: device + "/status/" + componentDetails.component + "/description",
			rpc:         device + "/rpc",
			rpcSource:   "nanohome/devicestatus/" + device,
			rpcDest:     "nanohome/devicestatus/" + device + "/rpc"
		}
	}
}

// return mqtt topics for current device
function getNanohomeTopics(description) {
	return {
		device:      "nanohome/devices/" + description,
		standby:     "nanohome/standby/" + description,
		timer:       "nanohome/timer/" + description
	}
}

// Generate component, gets published to "nanohome/devices"
function createComponentJson(device, componentDetails) {
	let newComponentJson = {
		"deviceId": device,
		"component": componentDetails.component,
		"description": componentDetails.description,
		"icon": componentDetails.exButtonImage,
		"legacy": componentDetails.legacy
	};
	return newComponentJson;
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

