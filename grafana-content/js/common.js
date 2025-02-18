/*
===============================================================
	Nanohome - Device Functions
===============================================================
*/

// Return device commands for current device
function getDeviceCommands(device, deviceDetails) {
	if (deviceDetails.legacy) {
		return {
			createPanel:      'create_panel "' + deviceDetails.description + '"',
			removeComponent:  'remove_component "' + deviceDetails.description + '"',
			clearMeasurement: 'clear_measurement "' + deviceDetails.description + '"'
		}
	} else {
		return {
			createPanel:      'create_panel "' + deviceDetails.description + '"',
			removeComponent:  'remove_component "' + deviceDetails.description + '"',
			clearMeasurement: 'clear_measurement "' + deviceDetails.description + '"'
		}
	}
}

// Return devices mqtt topics
function getDeviceTopics(device, componentDetails) {
	if (componentDetails.legacy) {
		let componentSplit = componentDetails.component.split(":");
		return {
			connected:   "shellies/" + device + "/" + componentSplit[0] + "/" + componentSplit[1] + "/connected",
			description: "shellies/" + device + "/" + componentSplit[0] + "/" + componentSplit[1] + "/description",
		}
	} else {
		return {
			connected:   device + "/status/" + componentDetails.component + "/connected",
			description: device + "/status/" + componentDetails.component + "/description",
			rpc:         device + "/rpc",
			rpcSource:   "nanohome/devicestatus/" + device,
			rpcDest:     "nanohome/devicestatus/" + device + "/rpc"
		}
	}
}

// Return nanohome mqtt topics
function getNanohomeTopics(description) {
	return {
		device:      "nanohome/devices/" + description,
		standby:     "nanohome/standby/" + description,
		timer:       "nanohome/timer/" + description
	}
}

/*
===============================================================
	Devices - Helper Functions
===============================================================
*/

// Get current devices html elements
function getDevicesHtmlElements(device) {
	return {
		description: document.getElementById(devmgr_descriptionPrefix + device),
		component:   document.getElementById(devmgr_componentPrefix + device),
		connected:   document.getElementById(devmgr_connectedPrefix + device),
		status:      document.getElementById(devmgr_statusPrefix + device),
		saveButton:  document.getElementById(devmgr_saveBtnPrfix + device)
	}
}

// Get current components values
function getComponentDetails(device) {
	let htmlElements = getDevicesHtmlElements(device);

	if (checkElement(htmlElements.component)) {
		let iconForm = document.getElementById(devmgr_exBtnIconFormPrefix + device);
		let icon = "";
		let legacy = false;

		if (checkElement(iconForm)) {
			icon = iconForm.elements[devmgr_exBtnIconSelect].value;
		}

		if (legacyKeywords.some(legacyKeywords => htmlElements.component.value.includes(legacyKeywords))) {
			legacy = true;
		}

		return {
			description:         document.getElementById(devmgr_descriptionPrefix + device).value,
			component:           document.getElementById(devmgr_componentPrefix + device).value,
			connected:           document.getElementById(devmgr_connectedPrefix + device).textContent,
			status:              document.getElementById(devmgr_statusPrefix + device).textContent,
			exBtnDescription:    document.getElementById(devmgr_exBtnDescriptionPrefix + device).textContent,
			exSliderDescription: document.getElementById(devmgr_exSliderDescriptionPrefix + device).textContent,
			exButtonImage:       icon,
			legacy:              legacy
		}
	} else {
		return false;
	}
}

// Generate component, gets published to "nanohome/devices"
function generateComponentJson(device, componentDetails) {
	let newComponentJson = {
		"deviceId": device,
		"component": componentDetails.component,
		"description": componentDetails.description,
		"icon": componentDetails.exButtonImage,
		"legacy": componentDetails.legacy
	};
	return newComponentJson;
}

/*
===============================================================
	Standby - Helper Functions
===============================================================
*/

// TODO: erarbeiten
// Get current timers html elements
function getStandbyHtmlElements(description) {
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

// Generate Json for StandbyData
function generateStandbyJson(description) {
	let jsonAttribute = document.getElementById(standby_activePrefix + description);
	let standbyPower = document.getElementById(standby_powerPrefix + description).value;
	let standbyWait = document.getElementById(standby_waitPrefix + description).value;
	let deviceJson = JSON.parse(jsonAttribute.getAttribute(deviceAttribute));

	if (! checkElement(standbyWait)) { standbyWait = 0; }

	let newElement = {
		"deviceId": deviceJson.deviceID,
		"component": deviceJson.component,
		"description": description,
		"threshold": standbyPower,
		"wait": standbyWait,
		"state": "off"
	};
	return newElement;
}

/*
===============================================================
	Timer - Helper Functions
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

/*
===============================================================
	Global - Helper Functions
===============================================================
*/

// Check latest index in json
function checkJsonIndex(payload) {
	let jsonIndex = 1;

	if (checkElement(payload)) {
		for (var j = 0; j < payload.length; j++) {
			if (payload[j].index > jsonIndex) {
				jsonIndex = payload[j].index;
			}
		}
		jsonIndex++;
	}
	return jsonIndex;
}

// Check if html element is defined eg. not hidden or missing
function checkElement(element) {
	return typeof element !== "undefined" && element !== null;
}

// Execute command with nanohome shell
function shellCommand(payload) {
	mqttPublish(cmdInputTopic, payload, false);
	console.log('Execute: ' + payload);
}
