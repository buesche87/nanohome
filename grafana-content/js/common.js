/*
===============================================================
	Global Helper Functions
===============================================================
*/

// Check latest index in json, return 1 
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
	// TODO: Prüfen ob immer +1 zu viel ist
	jsonIndex++;
	return jsonIndex;
}

// Check if html element is defined eg. not hidden or missing
function elementHiddenOrMissing(element) {
	return typeof element === "undefined" || element === null;
  }

// Execute command with nanohome shell
function shellCommand(payload) {
	mqttPublish(cmdInputTopic, payload, false);
	console.log('Execute: ' + payload);
}
