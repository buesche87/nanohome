/*
===============================================================
	Standby Manager
===============================================================
*/

// json datastore
var standby_deviceDataJsonStore = "deviceDataJsonStore"; // HTML element
var standby_deviceDataAttribute = "deviceDataAttribute"; // Attribute name

// HTML element prefixes
var standby_thresholdPrefix = "standbyThreshold_";
var standby_delayPrefix = "standbyDelay_";
var standby_statusPrefix = "standbyStatus_";
var standby_saveBtnPrefix = "standbySaveBtn_";
var standby_removeBtnPrefix = "standbyRemoveBtn_";

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
	let topicSplit = message.destinationName.split("/");
	let description = topicSplit[2];

	if ( topicSplit[1] == "devices" ) { 
		console.log('Device config received:');
		console.log(JSON.parse(payload));
		saveToDeviceStore(JSON.parse(payload)); 
		addHtmlElementFunctions(description);
	} else if ( topicSplit[1] == "standby" ) {	
		console.log('Standby config received:');
		console.log(JSON.parse(payload));
		populatePanels(JSON.parse(payload));
	}
}

/*
===============================================================
	Populate Data
===============================================================
*/

// Populate standby settings with content from mqtt message - [json payload]
function populatePanels(jsonData) {
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
function saveToDeviceStore(jsonData) {
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

/*
===============================================================
	HTML Element Functions
===============================================================
*/

// Get current devices html elements
function getHtmlElements(description) {
	return {
		standbyThreshold:	document.getElementById(standby_thresholdPrefix + description),
		standbyDelay:		document.getElementById(standby_delayPrefix + description),
		standbyStatus:		document.getElementById(standby_statusPrefix + description),
		saveBtn:			document.getElementById(standby_saveBtnPrefix + description),
		removeBtn:			document.getElementById(standby_removeBtnPrefix + description)
	};
}

// Add functions to html elements
function addHtmlElementFunctions(description) {
	let htmlElements = getHtmlElements(description);

	// Stop processing if status elements is hidden
	if ( elementHiddenOrMissing(htmlElements.standbyStatus) ) { return false; };

	htmlElements.standbyThreshold.addEventListener("focusout", function() {
		validateStandbyInput(description);
	});

	htmlElements.standbyThreshold.addEventListener("onfocus", function() {
		htmlElements.standbyThreshold.value="";
	});

	htmlElements.standbyDelay.addEventListener("onfocus", function() {
		htmlElements.standbyDelay.value="";
	});

	htmlElements.saveBtn.addEventListener("onclick", function() {
		saveStandby(description);
	});

	htmlElements.removeBtn.addEventListener("onclick", function() {
		removeStandby(description);
	});

	htmlElements.standbyThreshold.addEventListener("keypress", function(event) {
		if (event.key >= "0" && event.key <= "9") {
		  return true;
		} else {
		  event.preventDefault();
		}
	});

	htmlElements.standbyDelay.addEventListener("keypress", function(event) {
		if (event.key >= "0" && event.key <= "9") {
		  return true;
		} else {
		  event.preventDefault();
		}
	});
}