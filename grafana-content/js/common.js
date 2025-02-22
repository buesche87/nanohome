/*
===============================================================
	Global Helper Functions
===============================================================
*/

// Rturn latest index in json array, return 1 if none set
function getJsonIndex(payload) {
	let jsonIndex = 1;

	// Stop processing if payload is empty
    if (elementHiddenOrMissing(payload)) { return; }

	// Get 
	for (var j = 0; j < payload.length; j++) {
		if (payload[j].index > jsonIndex) {
			jsonIndex = payload[j].index;
		}
	}

	// Increment index
	jsonIndex++;
	return jsonIndex;
}

// Check if html element is hidden or missing
function elementHiddenOrMissing(...elements) {
	return elements.some(element => element === undefined || element === null);
}

// Check if variable is empty
function checkEmpty(variable) {
    return variable?.toString().trim() === "";
}

// Execute command with nanohome shell
function shellCommand(payload) {
	mqttPublish(cmdInputTopic, payload, false);
	console.log('Execute: ' + payload);
}
