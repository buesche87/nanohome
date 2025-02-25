/*
===============================================================
	Standby Manager
===============================================================
*/

// Json datastore
var deviceDataAttribute = "deviceData"; // Attribute name

// HTML element prefixes
var devicePrefix = "standbyDevice_";
var thresholdPrefix = "standbyThreshold_";
var delayPrefix = "standbyDelay_";
var statusPrefix = "standbyStatus_";
var saveBtnPrefix = "standbySaveBtn_";
var clearBtnPrefix = "clearStandbyBtn_";

/*
===============================================================
	MQTT Subscribe
===============================================================
*/

// Get standby and device infos
function getStandby(description) {
	let nanohomeTopics = getNanohomeTopics(description);

	mqttSubscribe(nanohomeTopics.deviceConfig, fastsubscribe);
	mqttSubscribe(nanohomeTopics.standbyConfig, fastsubscribe);
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

	// Device config: Add functions to html element and save
	if ( topicSplit[1] == "devices" ) { 
		addHtmlElementFunctions(description);
		saveToStore(JSON.parse(payload));

		console.log('Device config received:');
		console.log(JSON.parse(payload));
	
	// Standby Config: Populate incoming values 
	} else if ( topicSplit[1] == "standby" ) {	
		populatePanels(JSON.parse(payload));

		console.log('Standby config received:');
		console.log(JSON.parse(payload));
	}
}

/*
===============================================================
	Populate Data
===============================================================
*/

// Save device config to datastore - [json payload]
function saveToStore(deviceConfig) {
	let htmlElements = getHtmlElements(deviceConfig.description);
	let dataStore = htmlElements.standbyStatus;

	// Stop processing if datastore is hidden
    if ( elementHiddenOrMissing(dataStore) ) { return false; }

	// Fill descripton 
	htmlElements.standbyDevice.innerText = deviceConfig.description;
	htmlElements.standbyDevice.classList.remove('statusfalse');
	htmlElements.standbyDevice.classList.add('statustrue');	

	// Save config to datastore
	dataStore.setAttribute(deviceDataAttribute, JSON.stringify(deviceConfig));
}

// Populate standby settings - [json payload]
function populatePanels(timerConfig) {
	let htmlElements = getHtmlElements(timerConfig.description);

	// Stop processing if status element is hidden
    if ( elementHiddenOrMissing(htmlElements.standbyStatus) ) { return false; }	

	// If threshold and delay values are digits, populate them
	if ( checkDigit(timerConfig.threshold) ) { 
		htmlElements.standbyThreshold.value = timerConfig.threshold; 

		// If threshold is bigger than 0 activate standby
		if ( timerConfig.threshold > 0 ) {
			setStandbyStatus(htmlElements, "active");
			htmlElements.clearButton.disabled = false;
		} else {
			setStandbyStatus(htmlElements, "inactive");
			htmlElements.clearButton.disabled = true;
		}

		// Populate delay
		if ( checkDigit(timerConfig.delay) && timerConfig.delay > 0  ) { 
			htmlElements.standbyDelay.value = timerConfig.delay;
		}
	}
}

/*
===============================================================
	MQTT Publish
===============================================================
*/

// Save standby manager values
function saveStandby(description) {
	let nanohomeTopics = getNanohomeTopics(description);

	// Create a standby config
	let newStandbyConfig = generateStandbyConfig(description);

	// Publish config to "nanohome/standby/*"
	mqttSubscribe(nanohomeTopics.standby, longsubscribe);
	mqttPublish(nanohomeTopics.standby, JSON.stringify(newStandbyConfig), true);

	// Run "create_standby" through nanohome shell to enable the timer
	//mqttPublish(cmdInputTopic, "create_standby", false);

	console.log("Config saved");
}

// Clear standby manager values
function clearStandby(description) {
	let htmlElements = getHtmlElements(description);
	let nanohomeTopics = getNanohomeTopics(description);

	// Publish nothing to nanohome/standby/#
	mqttPublish(nanohomeTopics.standby, "", true);

	// Clear html elements
	setStandbyStatus(htmlElements, "inactive");
	htmlElements.standbyThreshold.value = "";
	htmlElements.standbyDelay.value = "";

	// Disable remove button
	htmlElements.clearButton.disabled = true;

	// Run "create_standby" through nanohome shell to enable the timer
	//mqttPublish(cmdInputTopic, "create_standby", false);

	console.log("Config cleared");
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
	HTML Element Functions
===============================================================
*/

// Get current devices html elements
function getHtmlElements(description) {
	return {
		standbyDevice:		document.getElementById(devicePrefix + description),
		standbyStatus:		document.getElementById(statusPrefix + description),
		standbyThreshold:	document.getElementById(thresholdPrefix + description),
		standbyDelay:		document.getElementById(delayPrefix + description),
		saveButton:			document.getElementById(saveBtnPrefix + description),
		clearButton:		document.getElementById(clearBtnPrefix + description)
	};
}

// Add functions to html elements
function addHtmlElementFunctions(description) {
	let htmlElements = getHtmlElements(description);

	// Stop processing if status elements is hidden
	if ( elementHiddenOrMissing(htmlElements.standbyStatus) ) { return false; }

	// Focus: Save current value and clear input field
	//---------------------------------------------------------
	htmlElements.standbyThreshold.addEventListener("focus", function() { 
		this.setAttribute("previous-value", this.value);
		this.value = "";
	});

	htmlElements.standbyDelay.addEventListener("focus", function() { 
		this.setAttribute("previous-value", this.value);
		this.value = "";
	});

	// Focusout: Save new values or revert
	//---------------------------------------------------------
	htmlElements.standbyThreshold.addEventListener("focusout", function() { 
		if ( checkDigit(this.value) ) {
			saveStandby(description);
		} else {
			this.value = this.getAttribute("previous-value") || "";
		}
	});

	htmlElements.standbyDelay.addEventListener("focusout", function() { 
		if ( checkDigit(this.value) && htmlElements.standbyThreshold.value !== "" ) {
			saveStandby(description);
		} else {
			this.value = this.getAttribute("previous-value") || "";
		}
	});

	// Click: Disable and clear standby
	htmlElements.clearButton.addEventListener("click", function() { 
		clearStandby(description);
	});

	// KeyPress: Suppress non-digit
	//---------------------------------------------------------
	htmlElements.standbyThreshold.addEventListener("keypress", function(event) {
		if ( event.key >= "0" && event.key <= "9" ) {
		  return true;
		} else {
		  event.preventDefault();
		}
	});

	htmlElements.standbyDelay.addEventListener("keypress", function(event) {
		if ( event.key >= "0" && event.key <= "9" ) {
		  return true;
		} else {
		  event.preventDefault();
		}
	});
}

// Set standby status 
function setStandbyStatus(htmlElements, value) {
	if ( value === "active" ) {
		htmlElements.standbyStatus.innerText = "Active";
		htmlElements.standbyStatus.classList.remove('statusfalse');
		htmlElements.standbyStatus.classList.add('statusgreen');
	} else {
		htmlElements.standbyStatus.innerText = "Inactive";
		htmlElements.standbyStatus.classList.remove('statusgreen');
		htmlElements.standbyStatus.classList.add('statusfalse');
	}
}