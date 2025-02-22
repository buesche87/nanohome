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

// Get standby and device infos
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
	let nanohomeTopics = getNanohomeTopics(description);
	let standbyThreshold = document.getElementById(standby_thresholdPrefix + description).value;
	let standbyDelay = document.getElementById(standby_delayPrefix + description).value;

	// TODO: Stop processing if entered values are non-digit
	if ( !/^\d+$/.test(standbyThreshold) ) {
		alert("Invalid threshold value");
		return false;
	}

	if ( !/^\d+$/.test(standbyDelay) && standbyDelay != "" ) {
		alert("Invalid delay value");
		return false;
	}

	// Create config and publish if values are digit digits
	let newJsonElement = generateStandbyJson(description);
	mqttSubscribe(nanohomeTopics.standby, longsubscribe);
	mqttPublish(nanohomeTopics.standby, JSON.stringify(newJsonElement), true);
}

// Clear standby values
function removeStandby(description) {
	let nanohomeTopics = getNanohomeTopics(description);

	mqttPublish(nanohomeTopics.standby, "", true);
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

	if ( topicSplit[1] == "devices" ) { saveToDeviceStore(payload); }
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

	// Stop processing if status element is hidden
    if (elementHiddenOrMissing(standbyStatus)) { return; }	

	// If threshold and wait time values are a digit, populate it
	if ( /^\d+$/.test(jsonData.threshold) ) { standbyThreshold.value = jsonData.threshold; }
	if ( /^\d+$/.test(jsonData.wait) ) { standbyWait.value = jsonData.wait;	}

	// If threshold is set bigger than 0 set status element active
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

// Save device details to jsonStore - [json payload]
function saveToDeviceStore(payload) {
	let jsonData = JSON.parse(payload);
	let jsonStore = document.getElementById(standby_statusPrefix + jsonData.description);

	// Stop processing if datastore is hidden
    if (elementHiddenOrMissing(jsonStore)) { return; }

	// Save standby config to devices datastore
	jsonStore.setAttribute(standby_deviceDataAttribute, JSON.stringify(jsonData));

	console.log("json for " + jsonData.description + " populated to " + jsonStore.id);
	console.log(jsonData);
}

/*
===============================================================
	Generate Data
===============================================================
*/

// Generate json for standby configuration
function generateStandbyJson(description) {
	let jsonStore = document.getElementById(standby_statusPrefix + description);
	let jsonData = JSON.parse(jsonStore.getAttribute(standby_deviceDataAttribute));
	let standbyThreshold = document.getElementById(standby_thresholdPrefix + description).value;
	let standbyWait = document.getElementById(standby_delayPrefix + description).value;

	// Set optional wait time to 0 if it was not set
	if (elementHiddenOrMissing(standbyWait)) { standbyWait = 0; }

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
