/*
===============================================================
	MQTT Subscribe
===============================================================
*/

// Get standby info - OnLoad per device
function getStandby(description) {
	let deviceTopic = "nanohome/devices/" + description; 
	let standbyTopic = "nanohome/standby/" + description; 

	mqttSubscribe(deviceTopic, longsubscribe);
	mqttSubscribe(standbyTopic, longsubscribe);
}

/*
===============================================================
	MQTT Publish
===============================================================
*/

// Save standby values
function saveStandby(description) {
	let standbyThreshold = document.getElementById(standby_thresholdPrefix + description).value;
	let standbyTopic = "nanohome/standby/" + description;

	if ( /^\d+$/.test(standbyThreshold) ) {
		let newJsonElement = generateStandbyJson(description);
		mqttSubscribe(standbyTopic, longsubscribe);
		mqttPublish(standbyTopic, JSON.stringify(newJsonElement), true);
	} else {
		alert("Ungültiger Wert");
	}
}

// Clear standby values
function removeStandby(description) {
	let standbytopic = "nanohome/standby/" + description;

	mqttPublish(standbytopic, "", true);
	clearStandby(description);
}

/*
===============================================================
	onMessageArrived
===============================================================
*/

// Decide what to do with new mqtt mesages
function onMessageArrived(message) {

	// Topic Extraction
	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	if ( topicSplit[1]== "devices" ) {
		populateDeviceAttribute(payload);
	}

	if ( topicSplit[1] == "standby" ) {
		populateStandbyPanels(payload);
	}
}

/*
===============================================================
	Populate Data
===============================================================
*/

// Populate standby settings with content from mqtt message - [json payload]
function populateStandbyPanels(payload) {
	let standbyData = JSON.parse(payload);
	let standbyStatus = document.getElementById(standby_statusPrefix + standbyData.description);
	let standbyThreshold = document.getElementById(standby_thresholdPrefix + standbyData.description);
	let standbyWait = document.getElementById(standby_waitPrefix + standbyData.description);

	if (checkElement(standbyStatus)) {
		if ( /^\d+$/.test(standbyData.threshold) ) {
			standbyThreshold.value = standbyData.threshold;
		}
		if ( /^\d+$/.test(standbyData.wait) ) {
			standbyWait.value = standbyData.wait;
		}
		if ( standbyData.threshold > 0 ) {
			standbyStatus.innerText = "Active";
			standbyStatus.classList.remove('statusfalse');
			standbyStatus.classList.add('statusgreen');
		} else {
			standbyStatus.innerText = "Inactive";
			standbyStatus.classList.remove('statusgreen');
			standbyStatus.classList.add('statusfalse');
		}
	}
}

// Populate device details to jsonDataStore - [json payload]
function populateDeviceAttribute(payload) {
	let jsonData = JSON.parse(payload);
	let jsonDataStore = document.getElementById(standby_statusPrefix + jsonData.description);

	if (checkElement(jsonDataStore)) {
		jsonDataStore.setAttribute(standby_deviceDataAttribute, JSON.stringify(jsonData));

		console.log("Device JSON Populated: ");
		console.log(jsonData);
	}
}

/*
===============================================================
	Generate Data
===============================================================
*/

// Generate Json for StandbyData
function generateStandbyJson(description) {
	let jsonDataStore = document.getElementById(standby_statusPrefix + description);
	let standbyThreshold = document.getElementById(standby_thresholdPrefix + description).value;
	let standbyWait = document.getElementById(standby_waitPrefix + description).value;

	let deviceJson = JSON.parse(jsonDataStore.getAttribute(standby_deviceDataAttribute));

	if (! checkElement(standbyWait)) { standbyWait = 0; }
	let newElement = {
		"deviceId": deviceJson.deviceId,
		"component": deviceJson.component,
		"description": description,
		"threshold": standbyThreshold,
		"wait": standbyWait,
		"state": "off",
		"legacy": deviceJson.legacy
	};
	return newElement;
}

/*
===============================================================
	Helper Functions
===============================================================
*/

// Clear standby button
function clearStandby(description) {
	var standbyPower = document.getElementById(standby_thresholdPrefix + description);
	var standbyWait = document.getElementById(standby_waitPrefix + description);
	
	standbyPower.value = "";
	standbyWait.value = "";
	setStandbyStatus(description);
}

// Validate format of input
function validateStandbyInput(description, inputField) {
	let saveButton = document.getElementById(standby_saveBtnPrefix + description);
	let isValid = /^\d+$/.test(inputField.value)
	
	if (! isValid) { inputField.value = "";	} 		
	if ( inputField.value !== "") { saveButton.disabled = false; } 
	else { saveButton.disabled = true; }
}
