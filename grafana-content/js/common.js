// Attributes to store json data
var deviceAttribute = "deviceData";
var timerAttribute = "timerData";
var standbyAttribute = "standbyData";

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
