/*
===============================================================
	MQTT Subscribe
===============================================================
*/

// Get Device Info - subscribe to all timer
function getTimerInfo() {
	mqttSubscribe(deviceTopicAll, longsubscribe);
	mqttSubscribe(timerTopicAll, longsubscribe);
}

/*
===============================================================
	MQTT Publish
===============================================================
*/

// Save timer
function saveTimer(description) {
	let nanohomeTopics = getNanohomeTopics(description);
	let jsonDataStore = document.getElementById(timer_timerStatusPrefix + description);

	// Get timer json from datastore
	let existingJson = JSON.parse(jsonDataStore.getAttribute(timer_timerDataAttribute));

	// Define new index for new json element
	let jsonIndex = checkElement(existingJson) ? checkJsonIndex(existingJson) : (existingJson = [], 1);

	// Add entry to json
	let newJsonElement = generateTimerJson(description, jsonIndex);
	existingJson.push(newJsonElement);

	// Save modified json into datastore
	populateTimerAttribute(existingJson, description);

	// Populate the timer list
	populateTimerList(existingJson, description);

	// Set timer status element
	setTimerActive(existingJson, description);

	// Publish timer json to "nanohome/timer"
	mqttPublish(nanohomeTopics.timer, JSON.stringify(existingJson), true);

	// Run "create_timer" through nanohome shell
	mqttPublish(cmdInputTopic, "create_timer", false);
}

// Remove selected timer
function removeTimer(description) {
	let timerDetails = getTimerHtmlElements(description);
	let nanohomeTopics = getNanohomeTopics(description);
	let jsonDataStore = document.getElementById(timer_timerStatusPrefix + description);

	// Get index of selected timer in list
	let selectedIndex = timerDetails.timerList.selectedIndex;
	var selectedData = timerDetails.timerList.options[selectedIndex].value;

	// Get timer json from datastore
	let existingJson = JSON.parse(jsonDataStore.getAttribute(timer_timerDataAttribute));

	// Remove selected timer
	existingJson = existingJson.filter(function(obj) {
		let objString = JSON.stringify(obj);
		return objString !== selectedData;
	});

	// Save modified json into datastore
	populateTimerAttribute(existingJson, description);

	// Populate the timer list
	populateTimerList(existingJson, description);

	// Set timer status element
	setTimerActive(existingJson, description);

	// Publish timer json to "nanohome/timer"
	mqttPublish(nanohomeTopics.timer, JSON.stringify(existingJson), true);

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
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	jsonPayload = JSON.parse(payload);

	if ( topicSplit[1]== "devices" ) {
		populateDeviceAttribute(jsonPayload);
	}

	if ( topicSplit[1] == "timer" ) {
		populateTimerAttribute(jsonPayload, topicSplit[2]);
		populateTimerList(jsonPayload, topicSplit[2]);
		setTimerActive(jsonPayload, topicSplit[2]);
	} 
}

/*
===============================================================
	Populate Data
===============================================================
*/

// Populate jsonstore "device"
function populateDeviceAttribute(deviceJson) {
	let description = deviceJson.description;
	let jsonDataStore = document.getElementById(timer_timerStatusPrefix + description);

	if (checkElement(jsonDataStore)) {
		jsonDataStore.setAttribute(timer_deviceDataAttribute, JSON.stringify(deviceJson));

		console.log("Device JSON Populated: ");
		console.log(deviceJson);
	}
}

// Populate jsonstore "timer"
function populateTimerAttribute(timerJson, description) {
	let jsonDataStore = document.getElementById(timer_timerStatusPrefix + description);

	if (checkElement(jsonDataStore)) {
		jsonDataStore.setAttribute(timer_timerDataAttribute, JSON.stringify(timerJson));

		console.log("Timer JSON Populated: ");
		console.log(timerJson);
	}
}

// Populate the timer list
function populateTimerList(timerJson, description) {
	let timerDetails = getTimerHtmlElements(description);

	if (checkElement(timerDetails.timerList)) {
		// Clear timer list
		for (a in timerDetails.timerList.options) { timerDetails.timerList.options.remove(0); }

		// Populate timer list
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
}

// Set active state if json data available
function setTimerActive(timerJson, description) {
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

/*
===============================================================
	Helper Functions
===============================================================
*/

// Get current timers html elements
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

// Get selected timer entry in listbox
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

// Manage timer input
function timerInput(description) {
	let timerDetails = getTimerHtmlElements(description);

	if ( timerDetails.timerOn.value !== "" || timerDetails.timerOff.value !== "" ) {
		timerDetails.saveButton.disabled = false;
	} else {
		timerDetails.saveButton.disabled = true;
	}
}
