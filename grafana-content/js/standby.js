/*
===============================================================
	Standby Manager
===============================================================
*/

// Json datastore
var deviceDataAttribute = "deviceData"; // Attribute name

// HTML element prefixes
var standbyThresholdPrefix = "standbyThreshold_";
var standbyDelayPrefix = "standbyDelay_";
var statusPrefix = "standbyStatus_";
var saveBtnPrefix = "standbySaveBtn_";
var removeBtnPrefix = "standbyRemoveBtn_";

/*
===============================================================
	MQTT Subscribe
===============================================================
*/

// Get standby and device infos
function getStandby(description) {
	let nanohomeTopics = getNanohomeTopics(description);

	mqttSubscribe(nanohomeTopics.device, longsubscribe);
	mqttSubscribe(nanohomeTopics.standby, longsubscribe);
}

/*
===============================================================
	MQTT Publish
===============================================================
*/

// Save standby values
function saveStandby(description) {
	let htmlElements = getHtmlElements(description);
	let nanohomeTopics = getNanohomeTopics(description);

	// Stop processing if entered values are non-digit
	if ( !checkDigit(htmlElements.standbyThreshold.value) ) {
		alert("Invalid threshold value");
		return false;
	}

	// Stop processing if entered values are non-digit and not empty
	if ( !checkDigit(htmlElements.standbyDelay.value) && htmlElements.standbyDelay.value != "" ) {
		alert("Invalid delay value");
		return false;
	}

	// Create a standby config
	let newStandbyConfig = generateStandbyConfig(description);

	// Publish config to nanohome/standby/#
	mqttSubscribe(nanohomeTopics.standby, longsubscribe);
	mqttPublish(nanohomeTopics.standby, JSON.stringify(newStandbyConfig), true);

	// Disable save button
	htmlElements.saveButton.disabled = true;
}

// Clear standby values
function removeStandby(description) {
	let nanohomeTopics = getNanohomeTopics(description);

	// Publish nothing to nanohome/standby/#
	mqttPublish(nanohomeTopics.standby, "", true);

	// Clear html elements
	clearPanels(description);$

	// Disable remove button
	htmlElements.removeButton.disabled = true;
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
		saveToStore(JSON.parse(payload)); 
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
function populatePanels(timerConfig) {
	let htmlElements = getHtmlElements(description);

	// TODO: Check if it works
	// let standbyStatus = document.getElementById(statusPrefix + jsonData.description);
	// let standbyThreshold = document.getElementById(standbyThresholdPrefix + timerConfig.description);
	// let standbyDelay = document.getElementById(standbyDelayPrefix + timerConfig.description);

	// Stop processing if status element is hidden
    if ( elementHiddenOrMissing(htmlElements.standbyStatus) ) { return false; }	

	// If threshold and delay values are a digit, populate it
	if ( checkDigit(timerConfig.threshold) ) { htmlElements.standbyThreshold.value = timerConfig.threshold; }
	if ( checkDigit(timerConfig.delay) ) { htmlElements.standbyDelay.value = timerConfig.delay;	}

	// If threshold is set bigger than 0 set status element active
	if ( timerConfig.threshold > 0 ) {
		htmlElements.standbyStatus.innerText = "Active";
		htmlElements.standbyStatus.classList.remove('statusfalse');
		htmlElements.standbyStatus.classList.add('statusgreen');
	} else {
		htmlElements.standbyStatus.innerText = "Inactive";
		htmlElements.standbyStatus.classList.remove('statusgreen');
		htmlElements.standbyStatus.classList.add('statusfalse');
	}

}

// Save device details to datastore - [json payload]
function saveToStore(configJson) {
	let htmlElements = getHtmlElements(configJson.description);
	let dataStore = htmlElements.standbyStatus;

	// Stop processing if datastore is hidden
    if ( elementHiddenOrMissing(dataStore) ) { return false; }

	// Save standby config to devices datastore
	dataStore.setAttribute(deviceDataAttribute, JSON.stringify(configJson));
}

/*
===============================================================
	Generate Data
===============================================================
*/

// Generate json for standby configuration
function generateStandbyConfig(description) {
	let htmlElements = getHtmlElements(description);
	let dataStore = htmlElements.standbyStatus;
	let deviceConfig = JSON.parse(dataStore.getAttribute(deviceDataAttribute));

	// Set optional delay time to 0 if it was not set
	if ( checkEmpty(htmlElements.standbyDelay.value) ) { htmlElements.standbyDelay.value = 0; }

	let newElement = {
		"description": description,
		"deviceId": deviceConfig.deviceId,
		"component": deviceConfig.component,
		"legacy": deviceConfig.legacy,
		"threshold": htmlElements.standbyThreshold.value,
		"delay": htmlElements.standbyDelay.value,
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
	let htmlElements = getHtmlElements(description);

	htmlElements.standbyThreshold.value = "";
	htmlElements.standbyDelay.value = "";
	setStandbyStatus(description);
}

// Validate format of input
function validateStandbyInput(description, inputField) {
	let htmlElements = getHtmlElements(description);

	if ( checkDigit(inputField.value) && inputField.value !== "" ) {
		htmlElements.saveBtn.disabled = false;
	} else {
		inputField.value = "";
		htmlElements.saveBtn.disabled = true;
	}
}

/*
===============================================================
	HTML Element Functions
===============================================================
*/

// Get current devices html elements
function getHtmlElements(description) {
	return {
		standbyThreshold:	document.getElementById(standbyThresholdPrefix + description),
		standbyDelay:		document.getElementById(standbyDelayPrefix + description),
		standbyStatus:		document.getElementById(statusPrefix + description),
		saveButton:			document.getElementById(saveBtnPrefix + description),
		removeButton:		document.getElementById(removeBtnPrefix + description)
	};
}

// Add functions to html elements
function addHtmlElementFunctions(description) {
	let htmlElements = getHtmlElements(description);

	// Stop processing if status elements is hidden
	if ( elementHiddenOrMissing(htmlElements.standbyStatus) ) { return false; }

	/*
	htmlElements.standbyThreshold.onfocus = function() { 
		htmlElements.standbyThreshold.value=""; 
	};
	*/

	htmlElements.standbyThreshold.addEventListener("focus", function() { 
		this.setAttribute("previous-value", this.value);
		this.value = "";
	});

	/*
	htmlElements.standbyThreshold.focusout = function() { 
		validateStandbyInput(description); 
	};
	*/

	htmlElements.standbyThreshold.addEventListener("focusout", function() { 
		validateStandbyInput(description);
		if (this.value === "") {
			this.value = this.getAttribute("previous-value") || "";
		}
	});

	htmlElements.standbyDelay.onfocus = function() { htmlElements.standbyDelay.value=""; };
	htmlElements.saveBtn.onclick = function() { saveStandby(description); };
	htmlElements.removeBtn.onclick = function() { removeStandby(description); };

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