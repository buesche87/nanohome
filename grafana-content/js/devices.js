/*
  ---------------------------------------------------------------
	HTML element prefixes on dashboard
  ---------------------------------------------------------------
*/

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

var devmgr_tempComponent = "";

/*
  ---------------------------------------------------------------
	MQTT Subscribe
  ---------------------------------------------------------------
*/

// subscribe to all devices connected and description topic
function getDeviceInfo() {
	mqttSubscribe(connectedTopicAll, fastsubscribe);
	mqttSubscribe(connectedTopicAllLegacy, fastsubscribe);
	mqttSubscribe(descriptionTopicAll, fastsubscribe);
	mqttSubscribe(descriptionTopicAllLegacy, fastsubscribe);
	mqttSubscribe(deviceTopicAll, fastsubscribe);
}

// get device infos (onLoad - per device)
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

// Create new dashboard element through nanohome_sand create it withhell
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


// Save component details
function saveComponent(device) {
	let componentDetails = getComponentDetails(device);
	let deviceTopics = getDeviceTopics(device, componentDetails);
	let nanohomeTopics = getNanohomeTopics(componentDetails.description);

	let jsonElement = createComponentJson(device, componentDetails);
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

// TODO: Test
// Clear measurement
function clearMeasurement(device) {
	let componentDetails = getComponentDetails(device);
	let deviceCommands = getDeviceCommands(device, componentDetails);

	shellCommand(deviceCommands.clearMeasurement);
}

// TODO: Test
// clear measurements and remove device with nanohome shell command "remove_component"
function removeComponent(device) {
	let componentDetails = getComponentDetails(device);
	let deviceCommands = getDeviceCommands(device, componentDetails);

	shellCommand(deviceCommands.removeComponent);
}

/*
---------------------------------------------------------------
	onMessageArrived MQTT
---------------------------------------------------------------
*/

// decide what to do with new mqtt mesages
function onMessageArrived(message) {

	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	// Nanohome specific topics
	if ( topicSplit[0] == "nanohome" ) {
		console.log('nanohome message arrived: ' + payload);

		// Fill network status from shelly.getstatus response. Feature possibilities: current power, etc.
		if ( topicSplit[1] == "devicestatus" ) {
			console.log('Network config retrived');
			let deviceid = topicSplit[2];

			fillNetworkElement(deviceid, payload);
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
			
			fillComponentElement(deviceid, component);
			fillStatusElement(deviceid, component, topicSplit[3], payload);
			
			// Show example button or slider
			if (component.includes("switch")) {
				showExampleElement(deviceid, "btnContainer");
			} else if (component.includes("cover")) {
				showExampleElement(deviceid, "sliderContainer");
			}
		}

		// Show connected state (shelly-deviceid/status/component/connected)
		if (topicSplit[3] == "connected") {
			fillStatusElement(deviceid, component, topicSplit[3], payload);
			// console.log('Connected status: "' + payload + '" (' +  deviceid + ')');
		}

		// Show description (shelly-deviceid/status/component/description)
		if (topicSplit[3] == "description") {
			fillStatusElement(deviceid, component, topicSplit[3], payload);
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

		fillComponentElement(deviceid, componentMerged);
		setStatusLegacy(deviceid);

		// Show example button legacy
		if (componentdev.includes("relay")) {
			showExampleElement(deviceid, "btnContainer");
			// console.log('Example button: ' + deviceid);
		}

		// Show connected state (shellies/shelly-deviceid/componentdev/componentindex/connected)
		if (topicSplit[4] == "connected") {
			fillStatusElement(deviceid, componentMerged, topicSplit[4], payload);
			// console.log('Connected status: "' + payload + '" (' +  deviceid + ')');
		}

		// Show description (shellies/shelly-deviceid/componentdev/componentindex/description)
		if (topicSplit[4] == "description") {
			fillStatusElement(deviceid, componentMerged, topicSplit[4], payload);
			setExampleElementDescription(deviceid, componentMerged, payload);
			// console.log('Description loaded: "' + payload + '" (' +  deviceid + ')');
		}
	}
}

/*
---------------------------------------------------------------
	Fill Elements
---------------------------------------------------------------
*/

// Fill component element with content from mqtt message if it does not already exist
function fillComponentElement(device, component) {
	let htmlElements = getDevicesHtmlElements(device);
	let optionExists = false;

	if (checkElement(htmlElements.component)) {
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

// Fill example element with content from mqtt message
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

// Set icon on example element with data from dashboard json
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

// Fill network with returned from JSON
function fillNetworkElement(device, payload) {
	let htmlElements = getDevicesHtmlElements(device);
	let statusData = JSON.parse(payload);

	let networkElement = htmlElements.status;

	// exit if networkElement is hidden or missing
    if (!checkElement(networkElement)) {
		console.log("setExampleElementDescription: exit function because of hidden or missing network element");
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

// Fill status elements with content from mqtt message
function fillStatusElement(device, component, element, payload) {
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

// Legacy - Set Status-Element to Legacy
function setStatusLegacy(device) {
	let htmlElements = getDevicesHtmlElements(device);
	let statusText = "Legacy";

	if (checkElement(htmlElements.status)) {
		htmlElements.status.innerText = statusText;
		htmlElements.status.classList.remove('statusfalse');
		htmlElements.status.classList.add('statusgreen')
	}
}

/*
---------------------------------------------------------------
	Helper Functions
---------------------------------------------------------------
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

// Show example element
function showExampleElement(device, element) {
	let divElement = document.getElementById(element + "_" + device);

	if (checkElement(divElement)) {
		divElement.classList.remove('elementHidden');
		divElement.classList.add('elementFlex');
	}
}

// OnFocus description
function descriptionFocus(device) {
	devmgr_tempComponent = document.getElementById(devmgr_descriptionPrefix + device);
}