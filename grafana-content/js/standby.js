// id prefixes of elements on dashboard
var standbyDivPrefix = "standbyActive_";
var standbyPowerPrefix = "standbyPower_";
var standbyWaitPrefix = "standbyWait_";
var standbySaveBtnPrefix = "standbySaveBtn_";

/*
---------------------------------------------------------------
	MQTT Subscribe
---------------------------------------------------------------
*/

// Get Device Info - Subscribe to the MQTT topics
function getStandbyInfo() {
	mqttSubscribe(descriptionTopic, 2000);
	mqttSubscribe(standbyTopic, 2000);
}

/*
---------------------------------------------------------------
	MQTT Publish
---------------------------------------------------------------
*/

// Save standby values
function saveStandby(description) {
	let standbyPower = document.getElementById(standbyPowerPrefix + description).value;
	let publishTopic = nanohomeRootTopic + "/" + description + "/standby";

	if (/^\d+$/.test(standbyPower)) {
		let newJsonElement = generateStandbyJson(description);
		mqttSubscribe(standbyTopic, 1000);
		mqttPublish(publishTopic, JSON.stringify(newJsonElement), true);
	} else {
		alert("Ungültiger Wert");
	}
}

// Clear standby values
function removeStandby(description) {
	let publishTopic = nanohomeRootTopic + "/" + description + "/standby";

	mqttPublish(publishTopic, "", true);
	clearStandby(description);
}

/*
---------------------------------------------------------------
	onMessageArrived MQTT
---------------------------------------------------------------
*/

function onMessageArrived(message) {
	// Topic Extraction
	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	// Status topic
	if (topicSplit[1] == "status") {
		let deviceData = {
			"deviceID": topicSplit[0],
			"component": topicSplit[2]
		};
		populateStandbyJson(payload, deviceAttribute, deviceData);
	}

	// Standby Topic
	if (topicSplit[2] == "standby") {
		populateStandby(topicSplit[1], payload);
	}
}

/*
---------------------------------------------------------------
	Fill Elements
---------------------------------------------------------------
*/

// Fill standby settings with content from mqtt message
function populateStandby(description, payload) {
	let standbyData = JSON.parse(payload);
	let standbyPower = document.getElementById(standbyPowerPrefix + description);
	let standbyWait = document.getElementById(standbyWaitPrefix + description);

	if (/^\d+$/.test(standbyData.standby)) {
		standbyPower.value = standbyData.standby;
	}
	if (/^\d+$/.test(standbyData.wait)) {
		standbyWait.value = standbyData.wait;
	}
	getActiveStandby(description);
}

// Clear standby elements
function clearStandby(description) {
	var standbyPower = document.getElementById(standbyPowerPrefix + description);
	var standbyWait = document.getElementById(standbyWaitPrefix + description);
	
	standbyPower.value = "";
	standbyWait.value = "";
	getActiveStandby(description);
}

// Populate json data from mqtt to element holding the data
function populateStandbyJson(description, dataElement, payload) {
	let jsonDataElement = document.getElementById(standbyDivPrefix + description);
	
	if (checkElement(jsonDataElement)) {
		jsonDataElement.setAttribute(dataElement, JSON.stringify(payload));
	}
}

// Set active state on elements
function getActiveStandby(description) {
	let standbyActive = document.getElementById(standbyDivPrefix + description);
	let standbyPower = document.getElementById(standbyPowerPrefix + description).value;
	
	if (checkElement(standbyPower) && standbyPower != "" ) {
		standbyActive.innerText = "Active";
		standbyActive.classList.remove('statusfalse');
		standbyActive.classList.add('statusgreen');
	} else {
		standbyActive.innerText = "Inactive";
		standbyActive.classList.remove('statusgreen');
		standbyActive.classList.add('statusfalse');
	}
}

/*
---------------------------------------------------------------
	Helper Functions
---------------------------------------------------------------
*/

// Generate Json for TimerData
function generateStandbyJson(description) {
	let jsonAttribute = document.getElementById(standbyDivPrefix + description);
	let standbyPower = document.getElementById(standbyPowerPrefix + description).value;
	let standbyWait = document.getElementById(standbyWaitPrefix + description).value;
	let deviceJson = JSON.parse(jsonAttribute.getAttribute(deviceAttribute));

	if (! checkElement(standbyWait)) { standbyWait = 0; }

	let newElement = {
		"deviceId": deviceJson.deviceID,
		"component": deviceJson.component,
		"description": description,
		"standby": standbyPower,
		"wait": standbyWait
	};
	return newElement;
}

// Validate format of input
function validateStandbyInput(description, inputField) {
	let saveButton = document.getElementById(standbySaveBtnPrefix + description);
	let isValid = /^\d+$/.test(inputField.value)
	
	if (! isValid) { inputField.value = "";	} 		
	if ( inputField.value !== "") { saveButton.disabled = false; } 
	else { saveButton.disabled = true; }
}

