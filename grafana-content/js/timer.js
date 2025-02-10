// TODO:
// - Überarbeiten
// - "details_" > "timerEntry_"

/*
---------------------------------------------------------------
	Attributes and html element prefixes on dashboard
---------------------------------------------------------------
*/

var timer_jsonDataStore = "timerData"; // HTML element
var timer_deviceDataAttribute = "deviceDetails"; // Attribute name of jsonStore element
var timer_timerDataAttribute = "timerDetails"; // Attribute name of jsonStore element

var timer_timerListPrefix = "timerList_"
var timer_timerEntryPrefix = "details_"
var timer_timerPeriodPrefix = "timerPeriod_"
var timer_timerOnPrefix = "timerOn_"
var timer_timerOffPrefix = "timerOff_"
var timer_timerStatusPrefix = "timerStatus_"
var timer_saveButtonPrefix = "timerSaveBtn_"
var timer_removeButtonPrefix = "timerRemoveBtn_"

/*
 ---------------------------------------------------------------
	MQTT Subscribe
 ---------------------------------------------------------------
*/

// Get Device Info - Subscribe to the MQTT topics
function getTimerInfo() {
	mqttSubscribe(deviceTopicAll, longsubscribe);
	mqttSubscribe(timerTopicAll, longsubscribe);
}

/*
---------------------------------------------------------------
	MQTT Publish
---------------------------------------------------------------
*/

// TODO: Test
// get current timers for component and append a new one
// save json to the components status element
function saveTimer(description) {
	let nanohomeTopics = getNanohomeTopics(description);
	let jsonDataStore = document.getElementById(timer_timerStatusPrefix + description);

	let existingJson = JSON.parse(jsonDataStore.getAttribute(timer_timerDataAttribute));

	// define new index
	let jsonIndex = checkElement(existingJson) ? checkJsonIndex(existingJson) : (existingJson = [], 1);

	// Add entry to json
	let newJsonElement = generateTimerJson(description, jsonIndex);
	existingJson.push(newJsonElement);

	// save modified json into timerData attribute
	// populate timer list
	populateTimerAttribute(existingJson);
	populateTimerList(existingJson);

	// publish timer json to "nanohome/timer/description"
	// run "create_timer" through nanohome shell
	mqttPublish(nanohomeTopics.timer, JSON.stringify(existingJson), true);
	mqttPublish(cmdInputTopic, "create_timer", false);
}

// TODO: Test
// Remove selected timer
function removeTimer(description) {
	let timerDetails = getTimerHtmlElements(description);
	let nanohomeTopics = getNanohomeTopics(description);

	// get index of selected timer
	let selectedIndex = timerDetails.timerList.selectedIndex;
	var selectedData = timerDetails.timerList.options[selectedIndex].value;

	// get active timer json from jsonStore and remove entry from json
	let activeTimerJson = JSON.parse(timerDetails.timerStatus.getAttribute(timer_timerDataAttribute));

	activeTimerJson = activeTimerJson.filter(function(obj) {
		let objString = JSON.stringify(obj);
		return objString !== selectedData;
	});

	// save modified json into timerData attribute
	// populate timer list
	populateTimerAttribute(activeTimerJson, description);
	populateTimerList(activeTimerJson, description);

	// publish timer json to "nanohome/timer/description"
	// run "create_timer" through nanohome shell
	mqttPublish(nanohomeTopics.timer, JSON.stringify(activeTimerJson), true);
	mqttPublish(cmdInputTopic, "create_timer", false);
}

/*
---------------------------------------------------------------
	onMessageArrived MQTT
---------------------------------------------------------------
*/

// Device what t odo with mqtt messages
function onMessageArrived(message) {
	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	jsonPayload = JSON.parse(payload);

	if ( topicSplit[1]== "devices" ) {
		populateDeviceAttribute(jsonPayload);
	}

	if ( topicSplit[1] == "timer" ) {
		populateTimerAttribute(jsonPayload);
		populateTimerList(jsonPayload);
		setTimerActive(jsonPayload);
	} 
}

/*
---------------------------------------------------------------
	Fill Elements
---------------------------------------------------------------
*/

// Populate json data from mqtt to element holding the data
function populateDeviceAttribute(deviceJson) {
	let description = deviceJson.description;
	let jsonDataStore = document.getElementById(timer_timerStatusPrefix + description);

	jsonDataStore.setAttribute(timer_deviceDataAttribute, JSON.stringify(deviceJson));

	// debug
	console.log("Device JSON Populated: ");
	console.log(deviceJson);
}

// TODO: Remove last timer...
// Populate json data from mqtt to element holding the data
function populateTimerAttribute(timerJson, description) {

	if (! checkElement(description)) {
		description = timerJson[0].description;
	}

	let jsonDataStore = document.getElementById(timer_timerStatusPrefix + description);

	jsonDataStore.setAttribute(timer_timerDataAttribute, JSON.stringify(timerJson));

	// debug
	console.log("Timer JSON Populated: ");
	console.log(timerJson);
}

// TODO: Test
// Populate json data from mqtt to element holding the data
function populateTimerList(timerJson, description) {

	if (! checkElement(description)) {
		description = timerJson[0].description;
	}

	let timerDetails = getTimerHtmlElements(description);

	// clear timer list
	for (a in timerDetails.timerList.options) { timerDetails.timerList.options.remove(0); }

	// populate timer list
	timerJson.forEach(function(entry) {
		var option = document.createElement("option");
		option.textContent = entry.timerPeriodText;

		option.textContent += entry.timerOn ? " - On: " + entry.timerOn : "";
		option.textContent += entry.timerOff ? " - Off: " + entry.timerOff : "";

		option.value = JSON.stringify(entry);
		timerDetails.timerList.appendChild(option);

		// debug
		console.log("Timer List Populated: ");
		console.log(entry);
	});
}

// TODO: Test
// Set active state if json data available
function setTimerActive(timerJson) {
	let description = timerJson[0].description;
	let timerDetails = getTimerHtmlElements(description);

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

/*
---------------------------------------------------------------
	Helper Functions
---------------------------------------------------------------
*/

// TODO: Test
// get current devices html elements
function getTimerHtmlElements(description) {
	return {
		timerList:    document.getElementById(timer_timerListPrefix + description),
		timerEntry:   document.getElementById(timer_timerEntryPrefix + description),
		timerPeriod:  document.getElementById(timer_timerPeriodPrefix + description),
		timerOn:      document.getElementById(timer_timerOnPrefix + description),
		timerOff:     document.getElementById(timer_timerOffPrefix + description),
		timerStatus:  document.getElementById(timer_timerStatusPrefix + description),
		saveButton:   document.getElementById(timer_saveButtonPrefix + description),
		removeButton: document.getElementById(timer_removeButtonPrefix + description)
	}
}

// TODO: Test
// Generate Json for TimerData
function generateTimerJson(description, index) {
	let timerDetails = getTimerHtmlElements(description);
	let deviceJson = JSON.parse(timerDetails.timerStatus.getAttribute(timer_deviceDataAttribute));

	let selectedIndex = timerDetails.timerPeriod.selectedIndex;
	let selectedText = timerDetails.timerPeriod.options[selectedIndex].textContent;

	let newElement = {
		"index": index,
		"deviceId": deviceJson.deviceId,
		"component": deviceJson.component,
		"description": deviceJson.description,
		"timerPeriodText": selectedText,
		"timerPeriodValue": timerDetails.timerPeriod.value,
		"timerOn": timerDetails.timerOn.value,
		"timerOff": timerDetails.timerOff.value
	};
	return newElement;
}

// TODO: Test
// timer selected
function timerSelected(description) {
	let timerDetails = getTimerHtmlElements(description);

	timerDetails.removeButton.disabled = false;

	let selectedTimerJson = timerDetails.timerList.value;
	let selectedTimer = JSON.parse(selectedTimerJson);

	console.log("Seelcted Timer: ");
	console.log(selectedTimer);

	timerDetails.timerPeriod.value = selectedTimer.timerPeriodValue
	timerDetails.timerOn.value = selectedTimer.timerOn
	timerDetails.timerOff.value = selectedTimer.timerOff
}

// TODO: Test
// timer input
function timerInput(description) {
	let timerDetails = getTimerHtmlElements(description);

	if ( timerDetails.timerOn.value !== "" || timerDetails.timerOff.value !== "" ) {
		timerDetails.saveButton.disabled = false;
	} else {
		timerDetails.saveButton.disabled = true;
	}
}
