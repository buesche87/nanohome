// Variables
var cmdInputTopic = "input_command";
var cmdOutputTopic = "output_command";
var deviceAttribute = "deviceData";
var timerAttribute = "timerData";

/*
 ---------------------------------------------------------------
	MQTT Subscribe
 ---------------------------------------------------------------
*/

// Get Device Info - Subscribe to the MQTT topics
function getTimerInfo(description) {
	let topics = getTimerTopics(description);

	mqttSubscribe(topics.deviceTopic, 2000);
	mqttSubscribe(topics.timerTopic, 2000);
}

/*
---------------------------------------------------------------
	MQTT Publish
---------------------------------------------------------------
*/

// Get current timers for component and append a new one
function saveTimer(description) {
	let timerDetails = getTimerElements(description);
	let topics = getTimerTopics(description);
	let activeTimerJson = JSON.parse(timerDetails.timerStatus.getAttribute("Timer"));

	// Define new index
	let jsonIndex = checkElement(activeTimerJson) ? checkJsonIndex(activeTimerJson) : (activeTimerJson = [], 1);

	// Add entry to json
	let newJsonElement = generateTimerJson(description, jsonIndex);
	activeTimerJson.push(newJsonElement);

	// Populate data
	populateTimerAttribute(activeTimerJson);
	populateTimerList(activeTimerJson);
	mqttPublish(topics.timerTopic, JSON.stringify(activeTimerJson), true);
	mqttPublish(cmdInputTopic, "create_timer", false);
}

// Remove selected timer
function removeTimer(description) {
	let timerDetails = getTimerElements(description);
	let topics = getTimerTopics(description);

	// get index of selected timer
	let selectedIndex = timerDetails.timerList.selectedIndex;
	var selectedData = timerDetails.timerList.options[selectedIndex].value;

	// Remove entry from json
	let activeTimerJson = JSON.parse(timerDetails.timerStatus.getAttribute("Timer"));

	activeTimerJson = activeTimerJson.filter(function(obj) {
		let objString = JSON.stringify(obj);
		return objString !== selectedData;
	});

	// Populate data
	populateTimerAttribute(activeTimerJson);
	populateTimerList(activeTimerJson);
	mqttPublish(topics.timerTopic, JSON.stringify(activeTimerJson), true);
	mqttPublish(cmdInputTopic, "create_timer", false);
}

/*
---------------------------------------------------------------
	onMessageArrived MQTT
---------------------------------------------------------------
*/

function onMessageArrived(message) {
	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	jsonPayload = JSON.parse(payload);

	if (Array.isArray(jsonPayload)) {
		if (jsonPayload[0].usage == "timer") {
			populateTimerAttribute(jsonPayload);
			populateTimerList(jsonPayload);
			setTimerActive(jsonPayload);
		}
	} else {
		if (jsonPayload.usage == "device") {
			populateDeviceAttribute(jsonPayload);
		}
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
	let timerDetails = getTimerElements(description);

	timerDetails.timerStatus.setAttribute("Device", JSON.stringify(deviceJson));
	console.log("Device JSON Populated: ");
	console.log(deviceJson);
}

// Populate json data from mqtt to element holding the data
function populateTimerAttribute(timerJson) {
	let description = timerJson[0].description;
	let timerDetails = getTimerElements(description);

	timerDetails.timerStatus.setAttribute("Timer", JSON.stringify(timerJson));
	console.log("Timer JSON Populated: ");
	console.log(timerJson);
}

// Populate json data from mqtt to element holding the data
function populateTimerList(timerJson) {
	let description = timerJson[0].description;
	let timerDetails = getTimerElements(description);

	for (a in timerDetails.timerList.options) { timerDetails.timerList.options.remove(0); }

	timerJson.forEach(function(entry) {
		var option = document.createElement("option");
		option.textContent = entry.timerPeriodText;
		if (entry.timerOn != "") {
			option.textContent += " - On: " + entry.timerOn;
		}
		if (entry.timerOff != "") {
			option.textContent += " - Off: " + entry.timerOff;
		}
		option.value = JSON.stringify(entry);
		timerDetails.timerList.appendChild(option);
		console.log("Timer List Populated: ");
		console.log(entry);
	});
}

// Set active state if json data available
function setTimerActive(timerJson) {
	let description = timerJson[0].description;
	let timerDetails = getTimerElements(description);

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

function getTimerElements(description) {
	return {
		timerList:    document.getElementById("timerList_" + description),
		timerEntry:   document.getElementById("details_" + description),
		timerPeriod:  document.getElementById("timerPeriod_" + description),
		timerOn:      document.getElementById("timerOn_" + description),
		timerOff:     document.getElementById("timerOff_" + description),
		timerStatus:  document.getElementById("timerStatus_" + description),
		saveButton:   document.getElementById("timerSaveBtn_" + description),
		removeButton: document.getElementById("timerRemoveBtn_" + description)
	}
}

function getTimerTopics(description) {
	return {
		deviceTopic: "nanohome/" + description + "/device",
		timerTopic:  "nanohome/" + description + "/timer"
	}
}

// Generate Json for TimerData
function generateTimerJson(description, index) {
	let timerDetails = getTimerElements(description);
	let deviceJson = JSON.parse(timerDetails.timerStatus.getAttribute("Device"));

	let selectedIndex = timerDetails.timerPeriod.selectedIndex;
	let selectedText = timerDetails.timerPeriod.options[selectedIndex].textContent;

	let newElement = {
		"index": index,
		"usage": "timer",
		"deviceId": deviceJson.deviceId,
		"component": deviceJson.component,
		"description": timerDetails.description,
		"timerPeriodText": selectedText,
		"timerPeriodValue": timerDetails.timerPeriod.value,
		"timerOn": timerDetails.timerOn.value,
		"timerOff": timerDetails.timerOff.value
	};
	return newElement;
}

// timer selected
function timerSelected(description) {
	let timerDetails = getTimerElements(description);

	timerDetails.removeButton.disabled = false;
	timerDetails.timerEntry.open = true;

	let selectedTimerJson = timerDetails.timerList.value;
	let selectedTimer = JSON.parse(selectedTimerJson);

	console.log("Seelcted Timer: ");
	console.log(selectedTimer);

	timerDetails.timerPeriod.value = selectedTimer.timerPeriodValue
	timerDetails.timerOn.value = selectedTimer.timerOn
	timerDetails.timerOff.value = selectedTimer.timerOff
}

// timer input
function timerInput(description) {
	let timerDetails = getTimerElements(description);

	if ( timerDetails.timerOn.value !== "" || timerDetails.timerOff.value !== "" ) {
		timerDetails.saveButton.disabled = false;
	} else {
		timerDetails.saveButton.disabled = true;
	}
}
