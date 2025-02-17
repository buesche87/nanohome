/*
---------------------------------------------------------------
	MQTT Subscribe
---------------------------------------------------------------
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
---------------------------------------------------------------
	MQTT Publish
---------------------------------------------------------------
*/

// Connect or disconnect component
function connectComponent(device) {
	let componentDetails = getComponentDetails(device);
	let deviceTopics = getDeviceTopics(device, componentDetails);

	let payload = componentDetails.connected === "Disconnected" ? "true" : "false";

	console.log('Connect: ' + payload + ' to ' + deviceTopics.connected);

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
	console.log('Publish: ' + nanohomeTopics.device + ' - ' + payload);

	// Publish description to deviceid/status/component/description
	mqttPublish(deviceTopics.description, componentDetails.description, true);
	console.log('Publish: ' + deviceTopics.description + ' - ' + componentDetails.description);

	getDeviceStatus(device);
	getDeviceInfo();
}

// Create new dashboard element through nanohome_shell
function createDashboardElement(device) {
	let componentDetails = getComponentDetails(device);
	let deviceCommands = getDeviceCommands(device, componentDetails);

	// confirm creation of element
	let confirmDialog = confirm('Save device and create dashboard element?');

	if (confirmDialog) {
		saveComponent(device);
		shellCommand(deviceCommands.createPanel);
		getDeviceInfo();
		console.log ('Shell command: ' + deviceCommands.createPanel);
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
---------------------------------------------------------------
	onMessageArrived
---------------------------------------------------------------
*/

// Decide what to do with new mqtt mesages
function onMessageArrived(message) {

	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	// Nanohome specific topics
	if ( topicSplit[0] == "nanohome" ) {
		console.log('nanohome message arrived: ' + payload);

		// Todo: Feature possibilities like current power, etc.
		// Populate network status from shelly.getstatus response. 
		if ( topicSplit[1] == "devicestatus" ) {
			console.log('Network config retrived');
			let deviceid = topicSplit[2];

			populateNetworkElement(deviceid, payload);
		}

		// TODO: Set example icon
		// TODO: Set example element description (statt unten)
		if ( topicSplit[1] == "devices" ) {
			console.log('Device config retrived');

			setExampleElementIcon(payload);
		}
	} 
	
	// Shelly Plus devices
	else if ( topicSplit[0].startsWith("shelly") ) {

		let deviceid = topicSplit[0];
		let component = topicSplit[2];

		// Show components and example button
		if (topicSplit[1] == "status") {

			console.log('Shelly Status Payload');
			console.log(payload);

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
			setExampleElementDescription(deviceid, component, payload);
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
---------------------------------------------------------------
	Manage Dashboard Panels
---------------------------------------------------------------
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
	let htmlElements = getDevicesHtmlElements(device);
	let optionExists = false;

	if (checkElement(htmlElements)) {
		for (var i = 0; i < htmlElements.component.options.length; i++) {
			if (htmlElements.component.options[i].value === component) {
				optionExists = true;
				return;
			}
		}
		if (optionExists == false) {
			htmlElements.component.options[htmlElements.component.options.length] = new Option(component, component);
		}
	}
}

// Populate network - [json payload]
function populateNetworkElement(device, payload) {
	let htmlElements = getDevicesHtmlElements(device);
	let statusData = JSON.parse(payload);

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
	let statusText = "Legacy";

	if (checkElement(htmlElements.status)) {
		htmlElements.status.innerText = statusText;
		htmlElements.status.classList.remove('statusfalse');
		htmlElements.status.classList.add('statusgreen')
	}
}

// Set icon on "example" panel - [json payload]
function setExampleElementIcon(payload) {
	let dashboardData = JSON.parse(payload);

	if (checkElement(dashboardData)) {
		let device = dashboardData.deviceId;
		let icon = dashboardData.icon;
		let iconForm = document.getElementById(devmgr_exBtnIconFormPrefix + device);

		if (checkElement(iconForm)) {
			let radioButtons = iconForm.elements[devmgr_exBtnIconSelect];
			
			for (let i = 0; i < radioButtons.length; i++) {
				if (radioButtons[i].value === icon) {
					radioButtons[i].checked = true;
					break;
				}
			}
		}
	}
}

// Set "description of "example" panel - [string payload]
function setExampleElementDescription(device, component, payload) {
	let htmlElements = getDevicesHtmlElements(device);
	let exBtnDescription = document.getElementById(devmgr_exBtnDescriptionPrefix + device);
	let exSliderDescription = document.getElementById(devmgr_exBtnDescriptionPrefix + device);

	// exit if htmlElement is hidden or missing
    if (!checkElement(htmlElements.component)) {
		console.log("setExampleElementDescription: exit function because of hidden or missing component element");
        return;
    }

	// set description to be displayed on example element
	let description = checkElement(payload) ? payload : "";

	// set textContent of example element
	if ( component == htmlElements.component.value ) {
		if ( checkElement(exBtnDescription) ) {
			exBtnDescription.textContent = description;
		} else if ( checkElement(exSliderDescription) ) {
			exSliderDescription.textContent = description;
		}
	}
}

/*
---------------------------------------------------------------
	Helper Functions
---------------------------------------------------------------
*/

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
