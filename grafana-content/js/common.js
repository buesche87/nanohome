// Attributes to store json data
var deviceAttribute = "deviceData";
var timerAttribute = "timerData";
var standbyAttribute = "standbyData";

/*
---------------------------------------------------------------
	Global Functions
---------------------------------------------------------------
*/

// Device commands
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

function getTimerTopics(description) {
	return {
		deviceTopic: "nanohome/" + description + "/device",
		timerTopic:  "nanohome/" + description + "/timer"
	}
}


/*
---------------------------------------------------------------
	Helper Functions
---------------------------------------------------------------
*/

// Check index in timer json
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

// Check if element defined
function checkElement(element) {
	return typeof element !== "undefined" && element !== null;
}

// Send command with mqtt_shell
function shellCommand(payload) {
	mqttPublish(cmdInputTopic, payload, false);
	console.log('Execute: ' + payload);
}

