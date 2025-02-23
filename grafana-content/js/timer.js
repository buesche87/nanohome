/*
===============================================================
	Timer Manager
===============================================================
*/

// TODO
// - OnMessageArrive > funktionen auf buttons setzen statt im panel hinterlegen
// - ListBox onfocusout > disable remove
// - Nach remove > enable save
// - 

// Json datastore
var deviceDataAttribute = "deviceData";
var timerDataAttribute = "timerData";

// HTML element prefixes
var timerListPrefix = "timerList_"
var timerEntryPrefix = "details_"
var timerPeriodPrefix = "timerPeriod_"
var timerOnPrefix = "timerOn_"
var timerOffPrefix = "timerOff_"
var timerStatusPrefix = "timerStatus_"
var saveBtnPrefix = "timerSaveBtn_"
var removeBtnPrefix = "timerRemoveBtn_"

/*
===============================================================
	MQTT Subscribe
===============================================================
*/

// Get timer and device infos
function getTimer(description) {
	let nanohomeTopics = getNanohomeTopics(description);

	mqttSubscribe(nanohomeTopics.device, fastsubscribe);
	mqttSubscribe(nanohomeTopics.timer, fastsubscribe);
}

/*
===============================================================
	MQTT Publish
===============================================================
*/

// Save timer
function saveTimer(description) {
	let htmlElements = getHtmlElements(description);
	let nanohomeTopics = getNanohomeTopics(description);

	// Load timer config from datastore
	let dataStore = htmlElements.timerStatus;
	let existingTimerConfig = JSON.parse(dataStore.getAttribute(timerDataAttribute));

	// Calculate an index for a new entry in the json array or create a new array if no config was found
	let jsonIndex = !elementHiddenOrMissing(existingTimerConfig) ? getJsonIndex(existingTimerConfig) : (existingTimerConfig = [], 1);

	// Create the entry and add it to the config
	let newTimerConfig = generateTimerJson(description, jsonIndex);
	existingTimerConfig.push(newTimerConfig);

	// Save the modified config to datastore and publish it to "nanohome/timer/#"
	saveToStore(existingTimerConfig, description, "timer")
	mqttPublish(nanohomeTopics.timer, JSON.stringify(existingTimerConfig), true);

	// Repopulate the timer list and set current status
	populateTimerList(existingTimerConfig, description);
	setTimerStatus(existingTimerConfig, description);

	// Run "create_timer" through nanohome shell to enable the timer
	mqttPublish(cmdInputTopic, "create_timer", false);

	// Disable save button
	htmlElements.saveButton.disabled = true;
}

// Remove selected timer
function removeTimer(description) {
	let htmlElements = getHtmlElements(description);
	let nanohomeTopics = getNanohomeTopics(description);

	// Load timer json from datastore
	let dataStore = htmlElements.timerStatus;
	let existingTimerConfig = JSON.parse(dataStore.getAttribute(timerDataAttribute));

	// Get timer details from selected entry
	let selectedIndex = htmlElements.timerList.selectedIndex;
	var selectedData = htmlElements.timerList.options[selectedIndex].value;

	// Remove selected timer from json
	existingTimerConfig = existingTimerConfig.filter(function(obj) {
		let objString = JSON.stringify(obj);
		return objString !== selectedData;
	});

	// Save modified json to datastore
	saveToStore(existingTimerConfig, description, "timer")

	// Repopulate the timer list
	populateTimerList(existingTimerConfig, description);

	// Set timer status element
	setTimerStatus(existingTimerConfig, description);

	// Publish timer json to "nanohome/timer"
	mqttPublish(nanohomeTopics.timer, JSON.stringify(existingTimerConfig), true);

	// Run "create_timer" through nanohome shell
	 mqttPublish(cmdInputTopic, "create_timer", false);

	// Disable remove button and enable save
	htmlElements.removeButton.disabled = true;
	htmlElements.saveButton.disabled = false;
}

/*
===============================================================
	onMessageArrived
===============================================================
*/

// Decide what to do with mqtt messages
function onMessageArrived(message) {
	let payload = message.payloadString;
	let topicSplit = message.destinationName.split("/");
	let description = topicSplit[2];

	if ( topicSplit[1] == "devices" ) {
		console.log('Device config received:');
		console.log(JSON.parse(payload));
		saveToStore(JSON.parse(payload), description, "devices");
		addHtmlElementFunctions(description);
	} else if ( topicSplit[1] == "timer" ) {
		console.log('Timer config received:');
		console.log(JSON.parse(payload));
		saveToStore(JSON.parse(payload), description, "timer");
		populateTimerList(JSON.parse(payload), description);
		setTimerStatus(JSON.parse(payload), description);
	} 
}

/*
===============================================================
	Populate Data
===============================================================
*/

// Save config to datastore
function saveToStore(configJson, description, store) {
	let htmlElements = getHtmlElements(description);
	let dataStore = htmlElements.timerStatus;

	// Stop processing is datastore is hidden
	if ( elementHiddenOrMissing(dataStore) ) { return false; }

	// Save config to devices datastore
	switch(store) {
		case "devices":
			dataStore.setAttribute(deviceDataAttribute, JSON.stringify(configJson));
			break;
		case "timer":
			dataStore.setAttribute(timerDataAttribute, JSON.stringify(configJson));
			break;
	}
}

// Populate the timer list
function populateTimerList(timerJson, description) {
	let htmlElements = getHtmlElements(description);

	// Stop processing if timer list element is hidden
	if ( elementHiddenOrMissing(htmlElements.timerList) ) { return false; }

	// Clear timer list
	for ( a in htmlElements.timerList.options ) { htmlElements.timerList.options.remove(0); }

	// Populate timer list
	timerJson.forEach(function(entry) {
		var option = document.createElement("option");

		// Set display text of entry
		option.textContent = entry.timerPeriodText;
		option.textContent += entry.timerOn ? " - On: " + entry.timerOn : "";
		option.textContent += entry.timerOff ? " - Off: " + entry.timerOff : "";

		// Set json config as value
		option.value = JSON.stringify(entry);
		htmlElements.timerList.appendChild(option);
	});
}

// Set timer status active/inactive
function setTimerStatus(timerJson, description) {
	let htmlElements = getHtmlElements(description);

	// Stop processing if status elements is hidden
	if ( elementHiddenOrMissing(htmlElements.timerStatus) ) { return false; }

	// Set status element
	if (!elementHiddenOrMissing(timerJson) && JSON.stringify(timerJson) != "[]") {
		htmlElements.timerStatus.innerText = "Active";
		htmlElements.timerStatus.classList.remove('statusfalse');
		htmlElements.timerStatus.classList.add('statusgreen');
	} else {
		htmlElements.timerStatus.innerText = "Inactive";
		htmlElements.timerStatus.classList.remove('statusgreen');
		htmlElements.timerStatus.classList.add('statusfalse');
	}
}

/*
===============================================================
	Generate Data
===============================================================
*/

// Generate a new timer json
function generateTimerJson(description, index) {
	let htmlElements = getHtmlElements(description);

	// Load config from datastore
	let dataStore = htmlElements.timerStatus;
	let deviceConfig = JSON.parse(dataStore.getAttribute(deviceDataAttribute));

	// Generate config with provided values
	let selectedIndex = htmlElements.timerPeriod.selectedIndex;
	let selectedText = htmlElements.timerPeriod.options[selectedIndex].textContent;

	let newElement = {
		"index": index,
		"deviceId": deviceConfig.deviceId,
		"component": deviceConfig.component,
		"description": deviceConfig.description,
		"legacy": deviceConfig.legacy,
		"timerPeriodText": selectedText,
		"timerPeriodValue": htmlElements.timerPeriod.value,
		"timerOn": htmlElements.timerOn.value,
		"timerOff": htmlElements.timerOff.value
	};
	return newElement;
}

// Copy value from selected timer entry to timer details
function timerSelected(description) {
	let htmlElements = getHtmlElements(description);
	let selectedTimerConfig = htmlElements.timerList.value;
	let selectedTimer = JSON.parse(selectedTimerConfig);

	htmlElements.timerPeriod.value = selectedTimer.timerPeriodValue
	htmlElements.timerOn.value = selectedTimer.timerOn
	htmlElements.timerOff.value = selectedTimer.timerOff
	htmlElements.removeButton.disabled = false;
}

/*
===============================================================
	HTML Element Functions
===============================================================
*/

// Get current devices html elements
function getHtmlElements(description) {
	return {
		timerList:		document.getElementById(timerListPrefix + description),
		timerEntry:		document.getElementById(timerEntryPrefix + description),
		timerPeriod:	document.getElementById(timerPeriodPrefix + description),
		timerOn:		document.getElementById(timerOnPrefix + description),
		timerOff:		document.getElementById(timerOffPrefix + description),
		timerStatus:	document.getElementById(timerStatusPrefix + description),
		saveButton:		document.getElementById(saveBtnPrefix + description),
		removeButton:	document.getElementById(removeBtnPrefix + description)
	};
}

// Add functions to html elements
function addHtmlElementFunctions(description) {
	let htmlElements = getHtmlElements(description);

	// Stop processing if status elements is hidden
	if ( elementHiddenOrMissing(htmlElements.timerStatus) ) { return false; }

	htmlElements.timerList.onchange = function() { timerSelected(description); };
	htmlElements.timerOn.onchange = function() { timerInput(description); };
	htmlElements.timerOff.onchange = function() { timerInput(description); };
	htmlElements.saveButton.onclick = function() { saveTimer(description); };
	htmlElements.removeButton.onclick = function() { removeTimer(description); };
}

/*
===============================================================
	Helper Functions
===============================================================
*/

// Manage timer input
function timerInput(description) {
	let htmlElements = getHtmlElements(description);

	if ( htmlElements.timerOn.value !== "" || htmlElements.timerOff.value !== "" ) {
		htmlElements.saveButton.disabled = false;
	} else {
		htmlElements.saveButton.disabled = true;
	}
}
