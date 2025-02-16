

// TODO:
// - Überarbeiten

/*
---------------------------------------------------------------
	MQTT Subscribe
---------------------------------------------------------------
*/

// Get Device Info - Subscribe to the MQTT topics
function getStandbyInfo() {
	mqttSubscribe(descriptionTopicAll, 2000);
	mqttSubscribe(standbyTopicAll, 2000);
}

/*
---------------------------------------------------------------
	MQTT Publish
---------------------------------------------------------------
*/

// Save standby values
function saveStandby(description) {
	let standbyPower = document.getElementById(standby_powerPrefix + description).value;
	let publishTopic = nanohomeRootTopic + "/" + description + "/standby";

	if (/^\d+$/.test(standbyPower)) {
		let newJsonElement = generateStandbyJson(description);
		mqttSubscribe(standbyTopicAll, 1000);
		mqttPublish(publishTopic, JSON.stringify(newJsonElement), true);
	} else {
		alert("Ungültiger Wert");
	}
}

// Clear standby values
function removeStandby(description) {
	let publishTopic = nanohomeRootTopic + "/" + description + "/standby";

	mqttPublish(publishTopic, "", true);
	clearStandby(description);
}

/*
---------------------------------------------------------------
	onMessageArrived
---------------------------------------------------------------
*/

// Decide what to do with new mqtt mesages
function onMessageArrived(message) {

	// Topic Extraction
	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	// Status topic
	if (topicSplit[1] == "status") {
		let deviceData = {
			"deviceID": topicSplit[0],
			"component": topicSplit[2]
		};
		populateStandbyElementsJson(payload, deviceAttribute, deviceData);
	}

	// Standby Topic
	if (topicSplit[2] == "standby") {
		populateStandbyElements(topicSplit[1], payload);
	}
}

/*
---------------------------------------------------------------
	Manage Dashboard Panels
---------------------------------------------------------------
*/

// Populate standby settings with content from mqtt message
function populateStandbyElements(description, payload) {
	let standbyData = JSON.parse(payload);
	let standbyPower = document.getElementById(standby_powerPrefix + description);
	let standbyWait = document.getElementById(standby_waitPrefix + description);

	if (/^\d+$/.test(standbyData.standby)) {
		standbyPower.value = standbyData.standby;
	}
	if (/^\d+$/.test(standbyData.wait)) {
		standbyWait.value = standbyData.wait;
	}
	getActiveStandby(description);
}

// Active state on
function getActiveStandby(description) {
	let standbyActive = document.getElementById(standby_activePrefix + description);
	let standbyPower = document.getElementById(standby_powerPrefix + description).value;
	
	if (checkElement(standbyPower) && standbyPower != "" ) {
		standbyActive.innerText = "Active";
		standbyActive.classList.remove('statusfalse');
		standbyActive.classList.add('statusgreen');
	} else {
		standbyActive.innerText = "Inactive";
		standbyActive.classList.remove('statusgreen');
		standbyActive.classList.add('statusfalse');
	}
}

// Clear standby button
function clearStandby(description) {
	var standbyPower = document.getElementById(standby_powerPrefix + description);
	var standbyWait = document.getElementById(standby_waitPrefix + description);
	
	standbyPower.value = "";
	standbyWait.value = "";
	getActiveStandby(description);
}

/*
---------------------------------------------------------------
	Helper Functions
---------------------------------------------------------------
*/

// Populate json data from mqtt to element holding the data
function populateStandbyElementsJson(description, dataElement, payload) {
	let jsonDataElement = document.getElementById(standby_activePrefix + description);
	
	if (checkElement(jsonDataElement)) {
		jsonDataElement.setAttribute(dataElement, JSON.stringify(payload));
	}
}

// Validate format of input
function validateStandbyInput(description, inputField) {
	let saveButton = document.getElementById(standby_saveBtnPrefix + description);
	let isValid = /^\d+$/.test(inputField.value)
	
	if (! isValid) { inputField.value = "";	} 		
	if ( inputField.value !== "") { saveButton.disabled = false; } 
	else { saveButton.disabled = true; }
}

