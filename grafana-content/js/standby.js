/*
===============================================================
	Standby Manager
===============================================================
*/

// json datastore
var standby_deviceDataJsonStore = "deviceDataJsonStore"; // HTML element
var standby_deviceDataAttribute = "deviceDataAttribute"; // Attribute name

// HTML element prefixes
var standby_statusPrefix = "standbyStatus_";
var standby_thresholdPrefix = "standbyThreshold_";
var standby_delayPrefix = "standbyDelay_";
var standby_saveBtnPrefix = "standbySaveBtn_";

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
	clearPanels(description);
}

/*
===============================================================
	onMessageArrived
===============================================================
*/

// Decide what to do with arriving mqtt mesages
function onMessageArrived(message) {
	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	if ( topicSplit[1] == "devices" ) { populateDeviceJsonStore(payload); }
	if ( topicSplit[1] == "standby" ) {	populatePanels(payload);	}
}

/*
===============================================================
	Populate Data
===============================================================
*/

// Populate standby settings with content from mqtt message - [json payload]
function populatePanels(payload) {
	let jsonData = JSON.parse(payload);
	let standbyStatus = document.getElementById(standby_statusPrefix + jsonData.description);
	let standbyThreshold = document.getElementById(standby_thresholdPrefix + jsonData.description);
	let standbyWait = document.getElementById(standby_delayPrefix + jsonData.description);

	if (checkElement(standbyStatus)) {
		if ( /^\d+$/.test(jsonData.threshold) ) {
			standbyThreshold.value = jsonData.threshold;
		}
		if ( /^\d+$/.test(jsonData.wait) ) {
			standbyWait.value = jsonData.wait;
		}
		if ( jsonData.threshold > 0 ) {
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

// Save device details to jsonStore - [json payload]
function populateDeviceJsonStore(payload) {
	let jsonData = JSON.parse(payload);
	let jsonStore = document.getElementById(standby_statusPrefix + jsonData.description);

	if (checkElement(jsonStore)) {
		jsonStore.setAttribute(standby_deviceDataAttribute, JSON.stringify(jsonData));

		console.log("json for " + jsonData.description + " populated to " + jsonStore.id);
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
	let jsonStore = document.getElementById(standby_statusPrefix + description);
	let jsonData = JSON.parse(jsonStore.getAttribute(standby_deviceDataAttribute));

	let standbyThreshold = document.getElementById(standby_thresholdPrefix + description).value;
	let standbyWait = document.getElementById(standby_delayPrefix + description).value;

	if (! checkElement(standbyWait)) { standbyWait = 0; }
	let newElement = {
		"description": description,
		"deviceId": jsonData.deviceId,
		"component": jsonData.component,
		"legacy": jsonData.legacy,
		"threshold": standbyThreshold,
		"wait": standbyWait,
		"state": "off"
	};
	return newElement;
}

/*
===============================================================
	Helper Functions
===============================================================
*/

// Clear standby button
function clearPanels(description) {
	var standbyPower = document.getElementById(standby_thresholdPrefix + description);
	var standbyWait = document.getElementById(standby_delayPrefix + description);
	
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
