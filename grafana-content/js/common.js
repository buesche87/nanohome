/*
===============================================================
	Global Helper Functions
===============================================================
*/

// Check latest index in json
function getJsonIndex(payload) {
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
