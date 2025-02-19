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

// Get Device Info - subscribe to all timer
function getTimerInfo(description) {
	let deviceTopic = "nanohome/devices/" + description;
	let timerTopic = "nanohome/timer/" + description;

	mqttSubscribe(deviceTopic, fastsubscribe);
	mqttSubscribe(timerTopic, fastsubscribe);
}

/*
===============================================================
	MQTT Publish
===============================================================
*/

// Save timer
function saveTimer(description) {
	let nanohomeTopics = getNanohomeTopics(description);

	// Load timer config from cache
	let dataStore = document.getElementById(timerStatusPrefix + description);
	let existingConfig = JSON.parse(dataStore.getAttribute(timerDataAttribute));

	// Calculate an index for a new entry in the json array or create a new array if no config was found
	let jsonIndex = checkElement(existingConfig) ? getJsonIndex(existingConfig) : (existingConfig = [], 1);

	// Create the entry and add it to the config
	let newJsonElement = generateTimerJson(description, jsonIndex);
	existingConfig.push(newJsonElement);

	// Save the modified config to cache and publish it to "nanohome/timer/#"
	copyToCache(existingConfig, description, "timer")
	mqttPublish(nanohomeTopics.timer, JSON.stringify(existingConfig), true);

	// Repopulate the timer list and set current status
	populateTimerList(existingConfig, description);
	setTimerStatus(existingConfig, description);

	// TODO - Test: Run a service
	// Run "create_timer" through nanohome shell to enable the timer
	// mqttPublish(cmdInputTopic, "create_timer", false);
}

// Remove selected timer
function removeTimer(description) {
	let timerDetails = getTimerHtmlElements(description);
	let nanohomeTopics = getNanohomeTopics(description);

	// Load timer json from datastore
	let dataStore = document.getElementById(timerStatusPrefix + description);
	let existingConfig = JSON.parse(dataStore.getAttribute(timerDataAttribute));

	// Get timer details from selected entry
	let selectedIndex = timerDetails.timerList.selectedIndex;
	var selectedData = timerDetails.timerList.options[selectedIndex].value;

	// Remove selected timer from json
	existingConfig = existingConfig.filter(function(obj) {
		let objString = JSON.stringify(obj);
		return objString !== selectedData;
	});

	// Save modified json to datastore
	copyToCache(existingConfig, description, "timer")

	// Repopulate the timer list
	populateTimerList(existingConfig, description);

	// Set timer status element
	setTimerStatus(existingConfig, description);

	// Publish timer json to "nanohome/timer"
	mqttPublish(nanohomeTopics.timer, JSON.stringify(existingConfig), true);

	// TODO - Test: Run a service
	// Run "create_timer" through nanohome shell
	// mqttPublish(cmdInputTopic, "create_timer", false);
}

/*
===============================================================
	onMessageArrived
===============================================================
*/

// Decide what to do with mqtt messages
function onMessageArrived(message) {
	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	jsonPayload = JSON.parse(payload);

	if ( topicSplit[1] == "devices" ) {
		let description = topicSplit[2];
		copyToCache(jsonPayload, description, "devices");
	}

	else if ( topicSplit[1] == "timer" ) {
		let description = topicSplit[2];

		copyToCache(jsonPayload, description, "timer");
		populateTimerList(jsonPayload, topicSplit[2]);
		setTimerStatus(jsonPayload, topicSplit[2]);
	} 
}

/*
===============================================================
	Populate Data
===============================================================
*/

// Save config to cache
function copyToCache(jsonPayload, description, cache) {
	let dataStore = document.getElementById(timerStatusPrefix + description);

	if (checkElement(dataStore)) {
		switch(cache) {
			case "devices":
				dataStore.setAttribute(deviceDataAttribute, JSON.stringify(jsonPayload));
				break;
			case "timer":
				dataStore.setAttribute(timerDataAttribute, JSON.stringify(jsonPayload));
				break;
		} 

		console.log('"' + description + '" config saved to "' + cache + '" cache');
		console.log(jsonPayload);
	}
}

// Populate the timer list
function populateTimerList(timerJson, description) {
	let timerDetails = getTimerHtmlElements(description);

	if (checkElement(timerDetails.timerList)) {

		console.log('Populating timer list "' + description + '"');

		// Clear timer list
		for (a in timerDetails.timerList.options) { timerDetails.timerList.options.remove(0); }

		// Populate timer list
		timerJson.forEach(function(entry) {
			var option = document.createElement("option");

			// Set display text of entry
			option.textContent = entry.timerPeriodText;
			option.textContent += entry.timerOn ? " - On: " + entry.timerOn : "";
			option.textContent += entry.timerOff ? " - Off: " + entry.timerOff : "";

			// Set json config as value
			option.value = JSON.stringify(entry);
			timerDetails.timerList.appendChild(option);

			console.log(entry);
		});
	}
}

// Set timer status active/inactive
function setTimerStatus(timerJson, description) {
	let timerDetails = getTimerHtmlElements(description);

	if (checkElement(timerDetails.timerStatus)) {	
		if (checkElement(timerJson) && JSON.stringify(timerJson) != "[]") {
			timerDetails.timerStatus.innerText = "Active";
			timerDetails.timerStatus.classList.remove('statusfalse');
			timerDetails.timerStatus.classList.add('statusgreen');
		} else {
			timerDetails.timerStatus.innerText = "Inactive";
			timerDetails.timerStatus.classList.remove('statusgreen');
			timerDetails.timerStatus.classList.add('statusfalse');
		}
	}
}

/*
===============================================================
	Generate Data
===============================================================
*/

// Generate a new timer json
function generateTimerJson(description, index) {
	let timerDetails = getTimerHtmlElements(description);

	// Load config from cache
	let dataStore = document.getElementById(timerStatusPrefix + description);
	let deviceConfig = JSON.parse(dataStore.getAttribute(deviceDataAttribute));

	// Generate config with provided values
	let selectedIndex = timerDetails.timerPeriod.selectedIndex;
	let selectedText = timerDetails.timerPeriod.options[selectedIndex].textContent;

	let newElement = {
		"index": index,
		"deviceId": deviceConfig.deviceId,
		"component": deviceConfig.component,
		"description": deviceConfig.description,
		"legacy": deviceConfig.legacy,
		"timerPeriodText": selectedText,
		"timerPeriodValue": timerDetails.timerPeriod.value,
		"timerOn": timerDetails.timerOn.value,
		"timerOff": timerDetails.timerOff.value
	};
	return newElement;
}

// Copy selected timer in listbox to timer details
function timerSelected(description) {
	let timerDetails = getTimerHtmlElements(description);
	let selectedTimerConfig = timerDetails.timerList.value;
	let selectedTimer = JSON.parse(selectedTimerConfig);

	timerDetails.timerPeriod.value = selectedTimer.timerPeriodValue
	timerDetails.timerOn.value = selectedTimer.timerOn
	timerDetails.timerOff.value = selectedTimer.timerOff
	timerDetails.removeButton.disabled = false;
}

/*
===============================================================
	Helper Functions
===============================================================
*/

// Get current devices html elements
function getTimerHtmlElements(description) {
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
	let timerDetails = getTimerHtmlElements(description);

	if ( timerDetails.timerOn.value !== "" || timerDetails.timerOff.value !== "" ) {
		timerDetails.saveButton.disabled = false;
	} else {
		timerDetails.saveButton.disabled = true;
	}
}
