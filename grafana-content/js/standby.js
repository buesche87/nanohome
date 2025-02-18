

// TODO:
// - Überarbeiten

/*
===============================================================
	MQTT Subscribe
===============================================================
*/

// Get Device Info - Subscribe to the MQTT topics
function getStandbyInfo() {
	mqttSubscribe(deviceTopicAll, longsubscribe);
	mqttSubscribe(standbyTopicAll, longsubscribe);
}

/*
===============================================================
	MQTT Publish
===============================================================
*/

// Save standby values
function saveStandby(description) {
	let standbyPower = document.getElementById(standby_powerPrefix + description).value;
	let standbyTopic = "nanohome/standby/" + description;

	if (/^\d+$/.test(standbyPower)) {
		let newJsonElement = generateStandbyJson(description);
		mqttSubscribe(standbyTopic, longsubscribe);
		mqttPublish(standbyTopic, JSON.stringify(newJsonElement), true);
	} else {
		alert("Ungültiger Wert");
	}
}

// Clear standby values
function removeStandby(description) {
	let standbytopic = "nanohome/standby/" + description;

	mqttPublish(standbytopic, "", true);
	clearStandby(description);
}

/*
===============================================================
	onMessageArrived
===============================================================
*/

// Decide what to do with new mqtt mesages
function onMessageArrived(message) {

	// Topic Extraction
	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	if ( topicSplit[1]== "devices" ) {
		populateDeviceAttribute(jsonPayload);
	}

	if ( topicSplit[1] == "standby" ) {
		populateStandbyPanels(payload);
	}
}

/*
===============================================================
	Populate Data
===============================================================
*/

// Populate standby settings with content from mqtt message
function populateStandbyPanels(payload) {
	let standbyData = JSON.parse(payload);
	let standbyPower = document.getElementById(standby_powerPrefix + standbyData.description);
	let standbyWait = document.getElementById(standby_waitPrefix + standbyData.description);

	if (checkElement(standbyPower)) {
		if (/^\d+$/.test(standbyData.standby)) {
			standbyPower.value = standbyData.standby;
		}
		if (/^\d+$/.test(standbyData.wait)) {
			standbyWait.value = standbyData.wait;
		}
		setStandbyStatus(description);
	}
}

// Active state on
function setStandbyStatus(description) {
	let standbyStatus = document.getElementById(standby_statusPrefix + description);
	let standbyPower = document.getElementById(standby_powerPrefix + description).value;
	
	if (checkElement(standbyPower) && standbyPower != "" ) {
		standbyStatus.innerText = "Active";
		standbyStatus.classList.remove('statusfalse');
		standbyStatus.classList.add('statusgreen');
	} else {
		standbyStatus.innerText = "Inactive";
		standbyStatus.classList.remove('statusgreen');
		standbyStatus.classList.add('statusfalse');
	}
}

// Populate jsonstore "device"
function populateDeviceAttribute(deviceJson) {
	let description = deviceJson.description;
	let jsonDataStore = document.getElementById(standby_statusPrefix + description);

	if (checkElement(jsonDataStore)) {
		jsonDataStore.setAttribute(standby_deviceDataAttribute, JSON.stringify(deviceJson));

		console.log("Device JSON Populated: ");
		console.log(deviceJson);
	}
}

/*
===============================================================
	Generate Data
===============================================================
*/

// Generate Json for StandbyData
function generateStandbyJson(description) {
	let jsonAttribute = document.getElementById(standby_statusPrefix + description);
	let standbyPower = document.getElementById(standby_powerPrefix + description).value;
	let standbyWait = document.getElementById(standby_waitPrefix + description).value;
	let deviceJson = JSON.parse(jsonAttribute.getAttribute(standby_deviceDataAttribute));

	if (! checkElement(standbyWait)) { standbyWait = 0; }

	let newElement = {
		"deviceId": deviceJson.deviceID,
		"component": deviceJson.component,
		"description": description,
		"threshold": standbyPower,
		"wait": standbyWait,
		"state": "off",
		"legacy": deviceJson.legacy
	};
	return newElement;
}

/*
===============================================================
	Helper Functions
===============================================================
*/

// Clear standby button
function clearStandby(description) {
	var standbyPower = document.getElementById(standby_powerPrefix + description);
	var standbyWait = document.getElementById(standby_waitPrefix + description);
	
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
