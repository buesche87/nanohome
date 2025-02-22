/*
===============================================================
	Timer Manager
===============================================================
*/

// mqtt message cache
var deviceDataAttribute = "deviceDetails"; // HTML element
var timerDataAttribute = "timerDetails"; // Attribute name

// HTML element prefixes
var timerListPrefix = "timerList_"
var timerEntryPrefix = "details_"
var timerPeriodPrefix = "timerPeriod_"
var timerOnPrefix = "timerOn_"
var timerOffPrefix = "timerOff_"
var timerStatusPrefix = "timerStatus_"
var saveButtonPrefix = "timerSaveBtn_"
var removeButtonPrefix = "timerRemoveBtn_"

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

	// Load timer config from cache
	let dataStore = htmlElements.timerStatus;
	let existingConfig = JSON.parse(dataStore.getAttribute(timerDataAttribute));

	// Calculate an index for a new entry in the json array or create a new array if no config was found
	let jsonIndex = !elementHiddenOrMissing(existingConfig) ? getJsonIndex(existingConfig) : (existingConfig = [], 1);

	// Create the entry and add it to the config
	let newJsonElement = generateTimerJson(description, jsonIndex);
	existingConfig.push(newJsonElement);

	// Save the modified config to cache and publish it to "nanohome/timer/#"
	saveToStore(existingConfig, description, "timer")
	mqttPublish(nanohomeTopics.timer, JSON.stringify(existingConfig), true);

	// Repopulate the timer list and set current status
	populateTimerList(existingConfig, description);
	setTimerStatus(existingConfig, description);

	// Run "create_timer" through nanohome shell to enable the timer
	mqttPublish(cmdInputTopic, "create_timer", false);
}

// Remove selected timer
function removeTimer(description) {
	let htmlElements = getHtmlElements(description);
	let nanohomeTopics = getNanohomeTopics(description);

	// Load timer json from datastore
	let dataStore = htmlElements.timerStatus;
	let existingConfig = JSON.parse(dataStore.getAttribute(timerDataAttribute));

	// Get timer details from selected entry
	let selectedIndex = htmlElements.timerList.selectedIndex;
	var selectedData = htmlElements.timerList.options[selectedIndex].value;

	// Remove selected timer from json
	existingConfig = existingConfig.filter(function(obj) {
		let objString = JSON.stringify(obj);
		return objString !== selectedData;
	});

	// Save modified json to datastore
	saveToStore(existingConfig, description, "timer")

	// Repopulate the timer list
	populateTimerList(existingConfig, description);

	// Set timer status element
	setTimerStatus(existingConfig, description);

	// Publish timer json to "nanohome/timer"
	mqttPublish(nanohomeTopics.timer, JSON.stringify(existingConfig), true);

	// Run "create_timer" through nanohome shell
	 mqttPublish(cmdInputTopic, "create_timer", false);
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
	} else if ( topicSplit[1] == "timer" ) {
		console.log('Timer config received:');
		console.log(JSON.parse(payload));
		saveToStore(payload, description, "timer");
		populateTimerList(JSON.parse(payload), description);
		setTimerStatus(JSON.parse(payload), description);
	} 
}

/*
===============================================================
	Populate Data
===============================================================
*/

// Save config to cache
function saveToStore(jsonPayload, description, cache) {
	let htmlElements = getHtmlElements(description);
	let dataStore = htmlElements.timerStatus;;

	// Stop processing datastore is hidden
    if ( elementHiddenOrMissing(dataStore) ) { return false; }

	// Save config to devices datastore
	switch(cache) {
		case "devices":
			dataStore.setAttribute(deviceDataAttribute, JSON.stringify(jsonPayload));
			break;
		case "timer":
			dataStore.setAttribute(timerDataAttribute, JSON.stringify(jsonPayload));
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

	// Load config from cache
	let dataStore = document.getElementById(timerStatusPrefix + description);
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
	Helper Functions
===============================================================
*/

// Get current devices html elements
function getHtmlElements(description) {
	return {
		timerList:    document.getElementById(timerListPrefix + description),
		timerEntry:   document.getElementById(timerEntryPrefix + description),
		timerPeriod:  document.getElementById(timerPeriodPrefix + description),
		timerOn:      document.getElementById(timerOnPrefix + description),
		timerOff:     document.getElementById(timerOffPrefix + description),
		timerStatus:  document.getElementById(timerStatusPrefix + description),
		saveButton:   document.getElementById(saveButtonPrefix + description),
		removeButton: document.getElementById(removeButtonPrefix + description)
	}
}

// Manage timer input
function timerInput(description) {
	let htmlElements = getHtmlElements(description);

	if ( htmlElements.timerOn.value !== "" || htmlElements.timerOff.value !== "" ) {
		htmlElements.saveButton.disabled = false;
	} else {
		htmlElements.saveButton.disabled = true;
	}
}
