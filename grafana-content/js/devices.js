// TODO: 
// - Übernahme ID Prefixes auf Dashbaord
// - Dashbaord: getdetailsInfo > getDeviceStatus
// - Dashbaord: getDeviceDetails > getComponentDetails
// - Dashbaord: connectDevice > connectComponent


/*
  ---------------------------------------------------------------
	Attributes and html element prefixes on dashboard
  ---------------------------------------------------------------
*/

var devmgr_componentPrefix = "component_";
var devmgr_connectedPrefix = "connected_";
var devmgr_descriptionPrefix = "description_";
var devmgr_detailsPrefix = "details_";
var devmgr_exBtnDescriptionPrefix = "exBtnDescription_";
var devmgr_exBtnIconFormPrefix = "exButtonForm_";
var devmgr_exBtnIconSelect = "exButtonImage-select";
var devmgr_exSliderDescriptionPrefix = "exSliderDescription_";
var devmgr_managePrefix = "manage_";
var devmgr_saveBtnPrfix = "savebtn_";
var devmgr_statusPrefix = "status_";
var devmgr_summaryPrefix = "summary_";

/*
  ---------------------------------------------------------------
	MQTT Subscribe
  ---------------------------------------------------------------
*/

// TODO: TEST
function getDashboardInfo() {
	mqttSubscribe(dashboardTopic, fastsubscribe);
}

// TODO: Test
// subscribe to all devices connected and description topic
function getDeviceInfo() {
	mqttSubscribe(connectedTopicAll, fastsubscribe);
	mqttSubscribe(connectedTopicAllLegacy, fastsubscribe);
	mqttSubscribe(descriptionTopicAll, fastsubscribe);
	mqttSubscribe(descriptionTopicAllLegacy, fastsubscribe);
}

// TODO: Test
// get device infos (onLoad - per device)
function getDeviceStatus(device) {
	let componentDetails = getComponentDetails(device);

	if (checkElement(componentDetails)) {
		let mqttTopics = getMqttTopics(device, componentDetails);

		if (componentDetails.legacy) {
			setStatusLegacy(device);
		} else {
			let payload = '{"id":999, "src":"' + mqttTopics.device + '", "method":"Shelly.GetStatus"}';

			mqttSubscribe(mqttTopics.rpcStatus, normalsubscribe);
			mqttPublish(mqttTopics.rpc, payload, false);
		}
	}
	getDashboardInfo();
}

/*
---------------------------------------------------------------
	MQTT Publish
---------------------------------------------------------------
*/

// TODO: Test
// Connect or disconnect component
function connectComponent(device) {
	let componentDetails = getComponentDetails(device);
	let mqttTopics = getMqttTopics(device, componentDetails);

	// Get current connected value
	let payload = componentDetails.connected === "Disconnected" ? "true" : "false";

	// Publish and refresh
	mqttPublish(mqttTopics.connected, payload, true);
	getDeviceInfo(device);
}

// Save device details
// TODO - Replace description in json (html element attribute, mqtt topics)
// TODO - Delete old mqtt topics in nanohome/
function saveDevice(device) {
	let componentDetails = getComponentDetails(device);
	let mqttTopics = getMqttTopics(device, componentDetails);

	let jsonElement = generateDeviceJson(device, componentDetails);
	let payload = JSON.stringify(jsonElement);

	// Publish and refresh
	mqttPublish(mqttTopics.device, payload, true);
	mqttPublish(mqttTopics.description, componentDetails.description, true);
	getDeviceInfo(device);
	getDashboardInfo();
}

// Create dashboard element
function createDashboardElement(device) {
	let componentDetails = getComponentDetails(device);
	let mqttTopics = getMqttTopics(device, componentDetails);
	let deviceCommands = getDeviceCommands(device, componentDetails);

	// Confirm creation of element
	let confirmDialog = confirm('Create Dashbaord element "' + componentDetails.description + '" for device: "' + device + '/' + componentDetails.component + '"?');

	if (confirmDialog) {
		let jsonStore = document.getElementById("deviceData");
		let existingJson = JSON.parse(jsonStore.getAttribute("componentDetails"));

		// TODO - Search and replace existing element

		// Define new index
		let jsonIndex = checkElement(existingJson) ? checkJsonIndex(existingJson) : (existingJson = [], 1);

		// Add entry to json
		let newJsonElement = generateDashboardJson(device, componentDetails, jsonIndex);
		existingJson.push(newJsonElement);

		// Save modified attribute
		jsonStore.setAttribute("componentDetails", JSON.stringify(existingJson));
		mqttPublish(mqttTopics.home, JSON.stringify(newJsonElement), true);
		createPayload = deviceCommands.createPanel + ' "' + jsonIndex + '"'
		shellCommand(createPayload);
		console.log ('Shell command: ' + createPayload)
	}
}

// clear measurement
function clearMeasurement(device) {
	let componentDetails = getComponentDetails(device);
	let deviceCommands = getDeviceCommands(device, componentDetails);

	shellCommand(deviceCommands.clearMeasurement);
}

// remove device
function removeDevice(device) {
	let componentDetails = getComponentDetails(device);
	let deviceCommands = getDeviceCommands(device, componentDetails);

	shellCommand(deviceCommands.clearMeasurement);
	shellCommand(deviceCommands.removeDevice);
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

	if ( topicSplit[0] == "nanohome" ) {

		let description = topicSplit[2]

		if ( topicSplit[1] == "devices" ) {
			// tbd
		} else if ( topicSplit[1] == "home" ) {

			// nanohome/home/dashboard
			if (topicSplit[2] == "dashboard") {
				saveDeviceAttribute(payload);
				setExampleElementIcon(payload);
				console.log('Dashboard config: ' + payload);
			}

		} else if ( topicSplit[1] == "timer" ) {
			// tbd
		} else if ( topicSplit[1] == "standby" ) {
			// tbd
		} 

	} else if ( topicSplit[0].startsWith("shelly") ) {

		let deviceid = topicSplit[0]
		let component = topicSplit[2]

		// TODO: Wo gehöt das hin...?
		// nanohome/devices/description/status
		// deviceid/status
		if (topicSplit[1] == "status") {

			fillNetworkElement(deviceid, payload);
			console.log('Network status: "' + payload + '" (' +  deviceid + ')');

			// Show example button
			if (component.includes("switch")) {
				showExampleElement(deviceid, "btnContainer");
				console.log('Example button: ' + deviceid);
			}

			// Show example slider
			else if (component.includes("cover")) {
				showExampleElement(deviceid, "sliderContainer");
				console.log('Example slider: ' + deviceid);
			}
		}

		// shelly-deviceid/status/component/connected
		else if (topicSplit[3] == "connected") {
			fillComponents(deviceid, component);
			fillStatusElements(deviceid, component, topicSplit[3], payload);
			fillExampleElements(deviceid, component, topicSplit[3], payload);
			console.log('Connected status: "' + payload + '" (' +  deviceid + ')');
		}

		// shelly-deviceid/status/component/description
		else if (topicSplit[3] == "description") {
			fillStatusElements(deviceid, component, topicSplit[3], payload);
			fillExampleElements(deviceid, component, topicSplit[3], payload);
			console.log('Description loaded: "' + payload + '" (' +  deviceid + ')');
		}

	} else if ( topicSplit[0] == "shellies" ) {

		let deviceid = topicSplit[1]
		let componentdev = topicSplit[2]
		let componentidx = topicSplit[3]
		let componentMerged = componentdev + ":" + componentidx;

		// shellies/shelly-deviceid/componentdev/componentindex/connected
		if (topicSplit[4] == "connected") {
			fillComponents(deviceid, componentMerged);
			fillStatusElements(deviceid, componentMerged, topicSplit[4], payload);
			fillExampleElements(deviceid, componentMerged, topicSplit[4], payload);
			setStatusLegacy(deviceid);
			console.log('Connected status: "' + payload + '" (' +  deviceid + ')');
		}

		// shellies/shelly-deviceid/componentdev/componentindex/description
		else if (topicSplit[4] == "description") {
			fillStatusElements(deviceid, componentMerged, topicSplit[4], payload);
			fillExampleElements(deviceid, componentMerged, topicSplit[4], payload);
			setStatusLegacy(deviceid);
			console.log('Description loaded: "' + payload + '" (' +  deviceid + ')');
		}

		// Show example button legacy
		if (componentdev.includes("relay")) {
			showExampleElement(deviceid, "btnContainer");
			setStatusLegacy(deviceid);
			console.log('Example button: ' + deviceid);
		}
	}
}

/*
---------------------------------------------------------------
	Parse status from "Shelly.GetStatus"
---------------------------------------------------------------
*/

// Legacy - Set Status-Element to Legacy
function setStatusLegacy(device) {
	let htmlElements = getHtmlElements(device);
	let statusText = "Legacy";

	if (checkElement(htmlElements.status)) {
		htmlElements.status.innerText = statusText;
		htmlElements.status.classList.remove('statusfalse');
		htmlElements.status.classList.add('statusgreen')
	}
}

/*
---------------------------------------------------------------
	Fill Elements
---------------------------------------------------------------
*/

// Fill status elements with content from mqtt message
function fillStatusElements(device, component, element, payload) {
	let htmlElements = getHtmlElements(device);
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

// Fill network with returned from JSON
function fillNetworkElement(device, payload) {
	let htmlElement = document.getElementById(devmgr_statusPrefix + device);
	let statusData = JSON.parse(payload);

	console.log("setting networkElement");
	console.log(statusData);

	let ipaddress = statusData?.result?.wifi?.sta_ip;
	let update = statusData?.result?.sys?.available_updates?.stable?.version;
	let statusText = "Offline";

	if (checkElement(htmlElement)){
		if (checkElement(update) && checkElement(ipaddress)) {
			statusText = ipaddress;
			statusText += "\n";
			statusText += "(Update: v" + update + ")";
			htmlElement.innerText = statusText;
			htmlElement.classList.remove('statusfalse');
			htmlElement.classList.add('statusorange');
		} else if (checkElement(ipaddress)) {
			htmlElement.innerText = ipaddress;
			htmlElement.classList.remove('statusfalse');
			htmlElement.classList.add('statusgreen');
		}
	}
}

// Fill example elements with content from mqtt message
function fillExampleElements(device, component, element, payload) {
	let htmlElements = getHtmlElements(device);
	let btnDescription = document.getElementById(devmgr_exBtnDescriptionPrefix + device);
	let sliderDescription = document.getElementById(devmgr_exBtnDescriptionPrefix + device);

	if (checkElement(btnDescription) && checkElement(htmlElements.component) && component == htmlElements.component.value) {
		if (element == "description" && checkElement(payload)) {
			btnDescription.textContent = payload;
		} else if (element == "description") {
			btnDescription.textContent = "";
		}
	}

	if (checkElement(sliderDescription) && checkElement(htmlElements.component) && component == htmlElements.component.value) {
		if (element == "description" && checkElement(payload)) {
			sliderDescription.textContent = payload;
		} else if (element == "description") {
			sliderDescription.textContent = "";
		}
	}
}

// Fill components extracted from message if they don't already exist
function fillComponents(device, component) {
	let htmlElements = getHtmlElements(device);
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

// Set icon on example element with data from dashboard json
function setExampleElementIcon(payload) {
	let dashboardData = JSON.parse(payload);

	if (checkElement(dashboardData)) {
		for (var j = 0; j < dashboardData.length; j++) {
			let device = dashboardData[j].deviceId;
			let icon = dashboardData[j].icon;
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
}

/*
---------------------------------------------------------------
	Helper Functions
---------------------------------------------------------------
*/

// Check HTML Elements
function checkElementsStatus(device) {
	let htmlElements = getHtmlElements(device);


	if(htmlElements.status && htmlElements.description && htmlElements.component && htmlElements.connected) {
		getDeviceInfo(device);
	} else {
		window.setTimeout(checkElementsStatus, 50);
		console.log("MQTT not connected. Retrying");
	}
}

function getHtmlElements(device) {
	return {
		description:         document.getElementById(devmgr_descriptionPrefix + device),
		component:           document.getElementById(devmgr_componentPrefix + device),
		connected:           document.getElementById(devmgr_connectedPrefix + device),
		status:              document.getElementById(devmgr_statusPrefix + device),
		manage:              document.getElementById(devmgr_managePrefix + device),
		manageSum:           document.getElementById(devmgr_summaryPrefix + device),
		saveButton:          document.getElementById(devmgr_saveBtnPrfix + device)
	}
}

function getComponentDetails(device) {
	let htmlElements = getHtmlElements(device);

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

// Populate json data from mqtt to element holding the data
function saveDeviceAttribute(payload) {
	let jsonStore = document.getElementById("deviceData");
	jsonStore.setAttribute("componentDetails", payload);
}

// Generate Json for TimerData
function generateDashboardJson(device, componentDetails, index) {
	let newElement = {
		"index": index,
		"usage": "dashboard",
		"deviceId": device,
		"component": componentDetails.component,
		"description": componentDetails.description,
		"icon": componentDetails.exButtonImage
	};
	return newElement;
}

// Generate Json for DeviceData
function generateDeviceJson(device, componentDetails) {
	let newElement = {
		"usage": "device",
		"deviceId": device,
		"component": componentDetails.component,
		"description": componentDetails.description,
		"legacy": componentDetails.legacy
	};
	return newElement;
}

// Description changed
function descriptionChanged(device) {
	let htmlElements = getHtmlElements(device);
	let componentDetails = getComponentDetails(device);

	if (checkElement(htmlElements.manage)) {
		htmlElements.manage.open = true;

		if (componentDetails.description != null && componentDetails.description != "") {
			htmlElements.saveButton.disabled = false;
		} else {
			htmlElements.saveButton.disabled = true;
		}
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

// Make the whole details div clickable
function detailsClickable(device) {
	let htmlElements = getHtmlElements(device);
	let summaryElement = document.getElementById(devmgr_summaryPrefix + device);

	if (checkElement(htmlElements.manage)) {
		htmlElements.manage.addEventListener("click", function() {
			htmlElements.manage.open = !htmlElements.manage.open;
		});
	}
	if (checkElement(summaryElement)) {
		summaryElement.addEventListener("click", function() {
			htmlElements.manage.open = !htmlElements.manage.open;
		});
	}
}

/*
 ---------------------------------------------------------------
	Execute
 ---------------------------------------------------------------
*/
setTimeout(() => {
	if (checkMqttStatus()) {
		getDashboardInfo();
	}
}, 300);

