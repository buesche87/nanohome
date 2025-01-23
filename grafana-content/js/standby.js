// TODO:
// - Überarbeiten

/*
---------------------------------------------------------------
	Attributes and html element prefixes on dashboard
---------------------------------------------------------------
*/

var deviceAttribute = "deviceData"; // OLD

var standby_deviceDataJsonStore = "deviceData"; // HTML element
var standby_deviceDataAttribute = "deviceDetails"; // Attribute name of jsonStore element

var standby_activePrefix = "standbyActive_";
var standby_powerPrefix = "standbyPower_";
var standby_waitPrefix = "standbyWait_";
var standby_saveBtnPrefix = "standbySaveBtn_";

/*
---------------------------------------------------------------
	MQTT Subscribe
---------------------------------------------------------------
*/

// Get Device Info - Subscribe to the MQTT topics
function getStandbyInfo() {
	mqttSubscribe(descriptionTopicAll, 2000);
	mqttSubscribe(standbyTopicAll, 2000);
}

/*
---------------------------------------------------------------
	MQTT Publish
---------------------------------------------------------------
*/

// Save standby values
function saveStandby(description) {
	let standbyPower = document.getElementById(standby_powerPrefix + description).value;
	let publishTopic = nanohomeRootTopic + "/" + description + "/standby";

	if (/^\d+$/.test(standbyPower)) {
		let newJsonElement = generateStandbyJson(description);
		mqttSubscribe(standbyTopicAll, 1000);
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
	let standbyPower = document.getElementById(standby_powerPrefix + description);
	let standbyWait = document.getElementById(standby_waitPrefix + description);

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
	var standbyPower = document.getElementById(standby_powerPrefix + description);
	var standbyWait = document.getElementById(standby_waitPrefix + description);
	
	standbyPower.value = "";
	standbyWait.value = "";
	getActiveStandby(description);
}

// Populate json data from mqtt to element holding the data
function populateStandbyJson(description, dataElement, payload) {
	let jsonDataElement = document.getElementById(standby_activePrefix + description);
	
	if (checkElement(jsonDataElement)) {
		jsonDataElement.setAttribute(dataElement, JSON.stringify(payload));
	}
}

// Set active state on elements
function getActiveStandby(description) {
	let standbyActive = document.getElementById(standby_activePrefix + description);
	let standbyPower = document.getElementById(standby_powerPrefix + description).value;
	
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
	let jsonAttribute = document.getElementById(standby_activePrefix + description);
	let standbyPower = document.getElementById(standby_powerPrefix + description).value;
	let standbyWait = document.getElementById(standby_waitPrefix + description).value;
	let deviceJson = JSON.parse(jsonAttribute.getAttribute(deviceAttribute));

	if (! checkElement(standbyWait)) { standbyWait = 0; }

	let newElement = {
		"deviceId": deviceJson.deviceID,
		"component": deviceJson.component,
		"description": description,
		"threshold": standbyPower,
		"wait": standbyWait,
		"state": "off"
	};
	return newElement;
}

// Validate format of input
function validateStandbyInput(description, inputField) {
	let saveButton = document.getElementById(standby_saveBtnPrefix + description);
	let isValid = /^\d+$/.test(inputField.value)
	
	if (! isValid) { inputField.value = "";	} 		
	if ( inputField.value !== "") { saveButton.disabled = false; } 
	else { saveButton.disabled = true; }
}

