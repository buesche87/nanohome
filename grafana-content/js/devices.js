/*
===============================================================
	Device Manager
===============================================================
*/

// HTML element prefixes
var devmgr_componentPrefix = "component_";
var devmgr_connectedPrefix = "connected_";
var devmgr_descriptionPrefix = "description_";
var devmgr_exBtnDescriptionPrefix = "exBtnDescription_";
var devmgr_exBtnIconFormPrefix = "exButtonForm_";
var devmgr_exBtnIconSelect = "exButtonImage-select";
var devmgr_exSliderDescriptionPrefix = "exSliderDescription_";
var devmgr_saveBtnPrfix = "savebtn_";
var devmgr_statusPrefix = "status_";
var devmgr_summaryPrefix = "summary_";

// Site variables
var devmgr_tempComponent = "";

/*
===============================================================
	MQTT Subscribe
===============================================================
*/

/*
// Subscribe to all devices connected and description topic
function getDeviceInfo() {
	mqttSubscribe(connectedTopicAll, fastsubscribe);
	mqttSubscribe(connectedTopicAllLegacy, fastsubscribe);
	mqttSubscribe(descriptionTopicAll, fastsubscribe);
	mqttSubscribe(descriptionTopicAllLegacy, fastsubscribe);
	mqttSubscribe(deviceTopicAll, fastsubscribe);
}
*/

// Get device infos (onLoad - per device)
function getDeviceStatus(device) {
	let componentDetails = readHtmlPanels(device);

	// Subscribe to all devices to get basic information
	mqttSubscribe(deviceTopicAll, normalsubscribe);
	mqttSubscribe(connectedTopicAll, fastsubscribe);
	mqttSubscribe(connectedTopicAllLegacy, fastsubscribe);
	mqttSubscribe(descriptionTopicAll, fastsubscribe);
	mqttSubscribe(descriptionTopicAllLegacy, fastsubscribe);

	if (checkElement(componentDetails)) {
		let componentTopics = getDeviceTopics(componentDetails);

		if ( componentDetails.legacy ) {
			setStatusLegacy(device);
		} else {

			let payload = '{"id":999, "src":"' + componentTopics.rpcSource + '", "method":"Shelly.GetStatus"}';
			mqttSubscribe(componentTopics.rpcDest, longsubscribe);
			mqttPublish(componentTopics.rpc, payload, false);
			console.log('Subscribe to: ' + componentTopics.rpcDest);
		}
	}
}

/*
===============================================================
	MQTT Publish
===============================================================
*/

// Connect or disconnect component
function connectComponent(device) {
	let componentDetails = readHtmlPanels(device);
	let componentTopics = getDeviceTopics(componentDetails);
	let payload = componentDetails.connected === "Disconnected" ? "true" : "false";

	// Publish new connected state to devices component topic
	mqttPublish(componentTopics.connected, payload, true);

	// Refresh dashboard
	getDeviceInfo();
}

// Save component details
function saveComponent(device) {
	let componentDetails = readHtmlPanels(device);
	let componentTopics = getDeviceTopics(componentDetails);
	let nanohomeTopics = getNanohomeTopics(componentDetails.description);
	let jsonElement = generateComponentConfig(componentDetails);
	let payload = JSON.stringify(jsonElement);

	// Publish device json to nanohome/devices
	mqttPublish(nanohomeTopics.device, payload, true);
	
	// Publish description devices component topic
	mqttPublish(componentTopics.description, componentDetails.description, true);
	
	// Refresh dashboard
	getDeviceStatus(device);
	getDeviceInfo();
}

// Create new dashboard element through nanohome_shell
function createPanel(device) {
	let componentDetails = readHtmlPanels(device);
	let componentCommands = getShellCommands(componentDetails);

	// Confirm creation of element
	let confirmDialog = confirm('Save "' + componentDetails.description + '" and create home dashboard panel?');

	// Publish new device json and create dashboard panel
	if (confirmDialog) {
		saveComponent(device);
		shellCommand(componentCommands.createPanel);
		getDeviceInfo();
	}
}

// Clear measurement through nanohome_shell
function clearMeasurement(device) {
	let componentDetails = readHtmlPanels(device);
	let componentCommands = getShellCommands(componentDetails);

	shellCommand(componentCommands.clearMeasurement);
}

// Remove device through nanohome_shell
function removeComponent(device) {
	let componentDetails = readHtmlPanels(device);
	let componentCommands = getShellCommands(componentDetails);

	shellCommand(componentCommands.removeComponent);
}

/*
===============================================================
	onMessageArrived
===============================================================
*/

// Decide what to do with new mqtt mesages
function onMessageArrived(message) {

	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	//================================
	// Topic: nanohome/+/+
	//================================
	if ( topicSplit[0] == "nanohome" ) {
		let deviceid = topicSplit[2];
		
		// Parse status message
		if ( topicSplit[1] == "devicestatus" ) {
			populateNetworkElement(payload);
		}

		// Set example panel description and icon
		if ( topicSplit[1] == "devices" ) {
			setExampleElementDescription(payload);
			setExampleElementIcon(payload);
		}
	} 
	
	//================================
	// Topic: shelly/+/+/+
	//================================
	else if ( topicSplit[0].startsWith("shelly") ) {
		let deviceid = topicSplit[0];
		let component = topicSplit[2];

		populateComponentElement(deviceid, component);

		// Show example button or slider
		if (component.includes("switch")) {
			showExampleElement(deviceid, "btnContainer");
		} else if (component.includes("cover")) {
			showExampleElement(deviceid, "sliderContainer");
		}

		// Populate connected state
		if (topicSplit[3] == "connected") {
			populateStatusElement(deviceid, component, topicSplit[3], payload);
		}

		// Populate description
		if (topicSplit[3] == "description") {
			populateStatusElement(deviceid, component, topicSplit[3], payload);
		}
	} 
	
	//================================
	// Topic: shellies/+/+/+/+
	//================================
	else if ( topicSplit[0] == "shellies" ) {
		let deviceid = topicSplit[1]
		let componentdev = topicSplit[2]
		let componentidx = topicSplit[3]
		let componentMerged = componentdev + ":" + componentidx;

		populateComponentElement(deviceid, componentMerged);
		setStatusLegacy(deviceid);

		// Show example button
		if (componentdev.includes("relay")) {
			showExampleElement(deviceid, "btnContainer");
		}

		// Populate connected state
		if (topicSplit[4] == "connected") {
			populateStatusElement(deviceid, componentMerged, topicSplit[4], payload);
		}

		// Populate description
		if (topicSplit[4] == "description") {
			populateStatusElement(deviceid, componentMerged, topicSplit[4], payload);
		}
	}
}

/*
===============================================================
	Populate Data
===============================================================
*/

// Populate description and connected - [string payload]
function populateStatusElement(device, component, element, payload) {
	let htmlElements = getDevicesHtmlElements(device);
	let divElement = document.getElementById(element + "_" + device);

	if (checkElement(divElement) && checkElement(htmlElements.component) && component == htmlElements.component.value) {

		if (element == "description" && checkElement(payload)) {
			divElement.value = payload;
		} else if (element == "description") {
			divElement.value = "";
		}

		if (element == "connected" && payload == "true") {
			divElement.textContent = "Connected";
			divElement.classList.add('statusgreen');
			divElement.classList.remove('statusfalse');
		} else if (element == "connected" && payload == "false") {
			divElement.textContent = "Disconnected";
			divElement.classList.add('statusfalse');
			divElement.classList.remove('statusgreen');
		}
	}
}

// Populate component (if nonexistent) - [string payload]
function populateComponentElement(device, component) {
	let componentSelect = document.getElementById(devmgr_componentPrefix + device);
	let optionExists = false;

	if (checkElement(componentSelect)) {
		for (var i = 0; i < componentSelect.options.length; i++) {
			if (componentSelect.options[i].value === component) {
				optionExists = true;
				return;
			}
		}
		if (optionExists == false) {
			componentSelect.options[componentSelect.options.length] = new Option(component, component);
		}
	}
}

// Populate status with ip address and update notification - [json payload]
function populateNetworkElement(payload) {
	let statusData = JSON.parse(payload);
	let htmlElements = getDevicesHtmlElements(statusData.src);
	let networkElement = htmlElements.status;

	// exit if networkElement is hidden or missing
    if (!checkElement(networkElement)) {
		console.log("setExampleElementDescription: exit - network element for \"" + statusData.src + "\" hidden or missing");
        return;
    }

	let ipaddress = statusData?.result?.wifi?.sta_ip;
	let update = statusData?.result?.sys?.available_updates?.stable?.version;
	let statusText = "Offline";

	if (checkElement(update) && checkElement(ipaddress)) {
		statusText = ipaddress;
		statusText += "\n";
		statusText += "(Update: v" + update + ")";
		networkElement.innerText = statusText;
		networkElement.classList.remove('statusfalse');
		networkElement.classList.add('statusorange');
	} else if (checkElement(ipaddress)) {
		networkElement.innerText = ipaddress;
		networkElement.classList.remove('statusfalse');
		networkElement.classList.add('statusgreen');
	}
}

// Set status to legacy - [string payload]
function setStatusLegacy(device) {
	let htmlElements = getDevicesHtmlElements(device);

	if (checkElement(htmlElements.status)) {
		htmlElements.status.innerText = "Legacy";
		htmlElements.status.classList.remove('statusfalse');
		htmlElements.status.classList.add('statusgreen')
	}
}

// Set example panel description - [json payload]
function setExampleElementDescription(payload) {
	let jsonData = JSON.parse(payload);
	let exBtnDescription = document.getElementById(devmgr_exBtnDescriptionPrefix + jsonData.deviceId);
	let exSliderDescription = document.getElementById(devmgr_exBtnDescriptionPrefix + jsonData.deviceId);

	if ( checkElement(exBtnDescription) ) {
		exBtnDescription.textContent = jsonData.description;
	} else if ( checkElement(exSliderDescription) ) {
		exSliderDescription.textContent = jsonData.description;
	}
}

// Set example panel icon - [json payload]
function setExampleElementIcon(payload) {
	let jsonData = JSON.parse(payload);
	let iconForm = document.getElementById(devmgr_exBtnIconFormPrefix + jsonData.deviceId);

	if (checkElement(iconForm)) {
		let radioButtons = iconForm.elements[devmgr_exBtnIconSelect];
		
		for (let i = 0; i < radioButtons.length; i++) {
			if (radioButtons[i].value === jsonData.icon) {
				radioButtons[i].checked = true;
				break;
			}
		}
	}
}

/*
===============================================================
	Generate Data
===============================================================
*/

// Generate component json, gets published to "nanohome/devices" - [object payload]
function generateComponentConfig(componentDetails) {
	let newComponentJson = {
		"deviceId": componentDetails.deviceId,
		"component": componentDetails.component,
		"description": componentDetails.description,
		"icon": componentDetails.exButtonImage,
		"legacy": componentDetails.legacy
	};
	return newComponentJson;
}

/*
===============================================================
	Helper Functions
===============================================================
*/

// Get current devices html elements - [string payload]
function getDevicesHtmlElements(device) {
	return {
		description: document.getElementById(devmgr_descriptionPrefix + device),
		component:   document.getElementById(devmgr_componentPrefix + device),
		connected:   document.getElementById(devmgr_connectedPrefix + device),
		status:      document.getElementById(devmgr_statusPrefix + device),
		saveButton:  document.getElementById(devmgr_saveBtnPrfix + device),
	}
}

// Get current components values - [string payload]
function readHtmlPanels(device) {
	let htmlElements = getDevicesHtmlElements(device);

	if (checkElement(htmlElements.component)) {
		let iconForm = document.getElementById(devmgr_exBtnIconFormPrefix + device);
		let icon = "";
		let legacy = false;
		
		// Get icon if example button is visible
		if (checkElement(iconForm)) {
			icon = iconForm.elements[devmgr_exBtnIconSelect].value;
		}

		// Set legacy flag if component name is one of the legacyKeywords
		if (legacyKeywords.some(legacyKeywords => htmlElements.component.value.includes(legacyKeywords))) {
			legacy = true;
		}

		return {
			deviceId:            device,
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

// Show example element - [string payload]
function showExampleElement(device, element) {
	let divElement = document.getElementById(element + "_" + device);

	if (checkElement(divElement)) {
		divElement.classList.remove('elementHidden');
		divElement.classList.add('elementFlex');
	}
}
