/*
===============================================================
	MQTT Subscribe
===============================================================
*/

// Subscribe to all devices connected and description topic
function getDeviceInfo() {
	mqttSubscribe(connectedTopicAll, fastsubscribe);
	mqttSubscribe(connectedTopicAllLegacy, fastsubscribe);
	mqttSubscribe(descriptionTopicAll, fastsubscribe);
	mqttSubscribe(descriptionTopicAllLegacy, fastsubscribe);
	mqttSubscribe(deviceTopicAll, fastsubscribe);
}

// Get device infos (onLoad - per device)
function getDeviceStatus(device) {
	let componentDetails = getComponentDetails(device);

	if (checkElement(componentDetails)) {
		let deviceTopics = getDeviceTopics(device, componentDetails);

		if ( componentDetails.legacy ) {
			setStatusLegacy(device);
		} else {
			let payload = '{"id":999, "src":"' + deviceTopics.rpcSource + '", "method":"Shelly.GetStatus"}';

			mqttSubscribe(deviceTopics.rpcDest, longsubscribe);
			mqttPublish(deviceTopics.rpc, payload, false);
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
	let componentDetails = getComponentDetails(device);
	let deviceTopics = getDeviceTopics(device, componentDetails);

	let payload = componentDetails.connected === "Disconnected" ? "true" : "false";

	// console.log('Connect: Publish "' + payload + '" to ' + deviceTopics.connected);

	mqttPublish(deviceTopics.connected, payload, true);
	getDeviceInfo();
}

// Save component details
function saveComponent(device) {
	let componentDetails = getComponentDetails(device);
	let deviceTopics = getDeviceTopics(device, componentDetails);
	let nanohomeTopics = getNanohomeTopics(componentDetails.description);

	let jsonElement = generateComponentJson(device, componentDetails);
	let payload = JSON.stringify(jsonElement);

	// Publish device json to nanohome/devices
	mqttPublish(nanohomeTopics.device, payload, true);
	// console.log('Save: Publish "' + payload + '" to ' + nanohomeTopics.device);

	// Publish description to deviceid/status/component/description
	mqttPublish(deviceTopics.description, componentDetails.description, true);
	// console.log('Save: Publish "' + componentDetails.description + '" to ' + deviceTopics.description);

	getDeviceStatus(device);
	getDeviceInfo();
}

// Create new dashboard element through nanohome_shell
function createDashboardElement(device) {
	let componentDetails = getComponentDetails(device);
	let deviceCommands = getDeviceCommands(device, componentDetails);

	// confirm creation of element
	let confirmDialog = confirm('Save "' + componentDetails.description + '" and create home dashboard panel?');

	if (confirmDialog) {
		saveComponent(device);
		shellCommand(deviceCommands.createPanel);
		getDeviceInfo();
		// console.log ('Shell command: ' + deviceCommands.createPanel);
	}
}

// TODO: Test
// Clear measurement through nanohome_shell
function clearMeasurement(device) {
	let componentDetails = getComponentDetails(device);
	let deviceCommands = getDeviceCommands(device, componentDetails);

	shellCommand(deviceCommands.clearMeasurement);
}

// TODO: Test
// Remove device through nanohome_shell
function removeComponent(device) {
	let componentDetails = getComponentDetails(device);
	let deviceCommands = getDeviceCommands(device, componentDetails);

	shellCommand(deviceCommands.removeComponent);
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

	// Nanohome specific topics
	if ( topicSplit[0] == "nanohome" ) {
		let deviceid = topicSplit[2];
		
		// console.log('nanohome message arrived: ' + payload);

		// Parse status message
		if ( topicSplit[1] == "devicestatus" ) {
			populateNetworkElement(deviceid, payload);
		}

		// Set example panel description and icon
		if ( topicSplit[1] == "devices" ) {
			setExampleElementDescription(payload);
			setExampleElementIcon(payload);
		}
	} 
	
	// Shelly Plus device messages
	else if ( topicSplit[0].startsWith("shelly") ) {

		let deviceid = topicSplit[0];
		let component = topicSplit[2];

		// Show components and example button
		if (topicSplit[1] == "status") {

			// console.log('Shelly Status Payload');
			// console.log(payload);

			populateComponentElement(deviceid, component);
			populateStatusElement(deviceid, component, topicSplit[3], payload);
			
			// Show example button or slider
			if (component.includes("switch")) {
				showExampleElement(deviceid, "btnContainer");
			} else if (component.includes("cover")) {
				showExampleElement(deviceid, "sliderContainer");
			}
		}

		// Show connected state (shelly-deviceid/status/component/connected)
		if (topicSplit[3] == "connected") {
			populateStatusElement(deviceid, component, topicSplit[3], payload);
			// console.log('Connected status: "' + payload + '" (' +  deviceid + ')');
		}

		// Show description (shelly-deviceid/status/component/description)
		if (topicSplit[3] == "description") {
			populateStatusElement(deviceid, component, topicSplit[3], payload);
			// console.log('Description loaded: "' + payload + '" (' +  deviceid + ')');
		}
	} 
	
	// Shelly Legacy devices
	else if ( topicSplit[0] == "shellies" ) {

		let deviceid = topicSplit[1]
		let componentdev = topicSplit[2]
		let componentidx = topicSplit[3]
		let componentMerged = componentdev + ":" + componentidx;

		populateComponentElement(deviceid, componentMerged);
		setStatusLegacy(deviceid);

		// Show example button legacy
		if (componentdev.includes("relay")) {
			showExampleElement(deviceid, "btnContainer");
			// console.log('Example button: ' + deviceid);
		}

		// Show connected state (shellies/shelly-deviceid/componentdev/componentindex/connected)
		if (topicSplit[4] == "connected") {
			populateStatusElement(deviceid, componentMerged, topicSplit[4], payload);
			// console.log('Connected status: "' + payload + '" (' +  deviceid + ')');
		}

		// Show description (shellies/shelly-deviceid/componentdev/componentindex/description)
		if (topicSplit[4] == "description") {
			populateStatusElement(deviceid, componentMerged, topicSplit[4], payload);
			setExampleElementDescription(deviceid, componentMerged, payload);
			// console.log('Description loaded: "' + payload + '" (' +  deviceid + ')');
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

// Populate network - [json payload]
function populateNetworkElement(device, payload) {
	let statusData = JSON.parse(payload);
	let htmlElements = getDevicesHtmlElements(device);


	let networkElement = htmlElements.status;

	// exit if networkElement is hidden or missing
    if (!checkElement(networkElement)) {
		console.log("setExampleElementDescription: exit - network element for \"" + device + "\" hidden or missing");
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

// Set network to legacy - [string payload]
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
	} 
	else if ( checkElement(exSliderDescription) ) {
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

// Generate component json, gets published to "nanohome/devices"
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
	Helper Functions
===============================================================
*/

// Get current devices html elements
function getDevicesHtmlElements(device) {
	return {
		description: document.getElementById(devmgr_descriptionPrefix + device),
		component:   document.getElementById(devmgr_componentPrefix + device),
		connected:   document.getElementById(devmgr_connectedPrefix + device),
		status:      document.getElementById(devmgr_statusPrefix + device),
		saveButton:  document.getElementById(devmgr_saveBtnPrfix + device),
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

// Show example element
function showExampleElement(device, element) {
	let divElement = document.getElementById(element + "_" + device);

	if (checkElement(divElement)) {
		divElement.classList.remove('elementHidden');
		divElement.classList.add('elementFlex');
	}
}

// OnFocus description [not in use?]
function descriptionFocus(device) {
	devmgr_tempComponent = document.getElementById(devmgr_descriptionPrefix + device);
}
