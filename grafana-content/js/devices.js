// ID prefixes of elements on dashboard
var devmgrDescriptionPrefix = "description_";
var devmgrComponentPrefix = "component_";
var devmgrConnectedPrefix = "connected_";
var devmgrNetworkPrefix = "manage_";
var devmgrIconPrefix = "icon_";
var devmgrBtnDescriptionPrefix = "btnDescription_";
var devmgrSliderDescriptionPrefix = "sliderDescription_";
var devmgrSaveBtnPrfix = "savebtn_";
var devmgrDetailsPrefix = "details_";
var devmgrSummaryPrefix = "summary_";

/*
  ---------------------------------------------------------------
	MQTT Subscribe
  ---------------------------------------------------------------
*/

function getDashboardInfo() {
	mqttSubscribe(dashboardTopic, fastsubscribe);
}

function getDeviceInfo() {
	mqttSubscribe(connectedTopic, fastsubscribe);
	mqttSubscribe(connectedTopicLegacy, fastsubscribe);
	mqttSubscribe(descriptionTopic, fastsubscribe);
	mqttSubscribe(descriptionTopicLegacy, fastsubscribe);
}

// Get device infos (onLoad - per device)
function getdetailsInfo(device) {
	let deviceDetails = getDeviceDetails(device);

	if (checkElement(deviceDetails)) {
		let deviceTopics = getDeviceTopics(device, deviceDetails);

		if (deviceDetails.legacy) {
			setStatusLegacy(device);
		} else {
			let payload = '{"id":999, "src":"' + deviceTopics.status + '", "method":"Shelly.GetStatus"}';
			let subscribetopic = statusOutTopicRoot + device + "/status/rpc";
			mqttSubscribe(subscribetopic, normalsubscribe);
			mqttPublish(deviceTopics.rpc, payload, false);
		}
	}
	getDashboardInfo();
}

/*
---------------------------------------------------------------
	MQTT Publish
---------------------------------------------------------------
*/

// Connect or disconnect device
function connectDevice(device) {
	let deviceDetails = getDeviceDetails(device);
	let deviceTopics = getDeviceTopics(device, deviceDetails);

	// Get current connected value
	let payload = deviceDetails.connected === "Disconnected" ? "true" : "false";

	// Publish and refresh
	mqttPublish(deviceTopics.connected, payload, true);
	getDeviceInfo(device);
}


// Save device details
// TODO - Replace description in json (html element attribute, mqtt topics)
// TODO - Delete old mqtt topics in nanohome/
function saveDevice(device) {
	let deviceDetails = getDeviceDetails(device);
	let deviceTopics = getDeviceTopics(device, deviceDetails);

	let jsonElement = generateDeviceJson(device, deviceDetails);
	let payload = JSON.stringify(jsonElement);

	// Publish and refresh
	mqttPublish(deviceTopics.details, payload, true);
	mqttPublish(deviceTopics.description, deviceDetails.description, true);
	getDeviceInfo(device);
	getDashboardInfo();
}

// Create dashboard element
function createDashboardElement(device) {
	let deviceDetails = getDeviceDetails(device);
	let deviceTopics = getDeviceTopics(device, deviceDetails);
	let deviceCommands = getDeviceCommands(device, deviceDetails);

	// Confirm creation of element
	let confirmDialog = confirm('Create Dashbaord element "' + deviceDetails.description + '" for device: "' + device + '/' + deviceDetails.component + '"?');

	if (confirmDialog) {
		let jsonStore = document.getElementById("deviceData");
		let existingJson = JSON.parse(jsonStore.getAttribute("deviceDetails"));

		// TODO - Search and replace existing element

		// Define new index
		let jsonIndex = checkElement(existingJson) ? checkJsonIndex(existingJson) : (existingJson = [], 1);

		// Add entry to json
		let newJsonElement = generateDashboardJson(device, deviceDetails, jsonIndex);
		existingJson.push(newJsonElement);

		// Save modified attribute
		jsonStore.setAttribute("deviceDetails", JSON.stringify(existingJson));
		mqttPublish(deviceTopics.dashboard, JSON.stringify(newJsonElement), true);
		createPayload = deviceCommands.createElement + ' "' + jsonIndex + '"'
		shellCommand(createPayload);
		console.log (createPayload)
	}
}

// Delete measurement
function deleteMeasurement(device) {
	let deviceDetails = getDeviceDetails(device);
	let deviceCommands = getDeviceCommands(device, deviceDetails);

	shellCommand(deviceCommands.deleteMeasurement);
}

// Delete device
function deleteDevice(device) {
	let deviceDetails = getDeviceDetails(device);
	let deviceCommands = getDeviceCommands(device, deviceDetails);

	shellCommand(deviceCommands.deleteMeasurement);
	shellCommand(deviceCommands.deleteDevice);
}

/*
---------------------------------------------------------------
	onMessageArrived MQTT
---------------------------------------------------------------
*/

function onMessageArrived(message) {
	// Extract payload and topic from message
	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	// Populate jsonStore
	if (topic == "nanohome/config/dashboard") {
		saveDeviceAttribute(payload);
		setExampleElementIcon(payload);
		console.log("Dashboard config loaded");
		//console.log(payload);
	}

	// Set device status
	if (topicSplit[0] == statusOutTopicRoot) {
		fillNetworkElement(topicSplit[1], payload);
		console.log("status retreived");
	}

	// Fill elements from connected topic path
	if (topicSplit[1] == "status" && topicSplit[3] == "connected") {
		fillComponents(topicSplit[0], topicSplit[2]);
		fillStatusElements(topicSplit[0], topicSplit[2], topicSplit[3], payload);
		fillExampleElements(topicSplit[0], topicSplit[2], topicSplit[3], payload);
		//console.log('Connection Status loaded: ' + topicSplit[0]);
	}

	// Fill elements from connected topic path legacy
	if (topicSplit[0] == "shellies" && topicSplit[4] == "connected") {
		let componentMerged = topicSplit[2] + ":" + topicSplit[3];
		fillComponents(topicSplit[1], componentMerged);
		fillStatusElements(topicSplit[1], componentMerged, topicSplit[4], payload);
		fillExampleElements(topicSplit[1], componentMerged, topicSplit[4], payload);
		setStatusLegacy(topicSplit[1]);
	}

	// Fill elements from description topic path
	if (topicSplit[1] == "status" && topicSplit[3] == "description") {
		fillStatusElements(topicSplit[0], topicSplit[2], topicSplit[3], payload);
		fillExampleElements(topicSplit[0], topicSplit[2], topicSplit[3], payload);
		//console.log('Description loaded: "' + payload + '" (' +  topicSplit[0] + ')');
	}

	// Fill elements from description topic path legacy
	if (topicSplit[0] == "shellies" && topicSplit[4] == "description") {
		let componentMerged = topicSplit[2] + ":" + topicSplit[3];
		fillStatusElements(topicSplit[1], componentMerged, topicSplit[4], payload);
		fillExampleElements(topicSplit[1], componentMerged, topicSplit[4], payload);
		setStatusLegacy(topicSplit[1]);
	}

	// Show example button
	if (checkElement(topicSplit[2]) && topicSplit[2].includes("switch")) {
		showExampleElement(topicSplit[0], "btnContainer");
		//console.log('Example Element loaded: ' + topicSplit[0]);
	}

	// Show example button legacy
	if (checkElement(topicSplit[2]) && topicSplit[2].includes("relay")) {
		showExampleElement(topicSplit[1], "btnContainer");
		setStatusLegacy(topicSplit[1]);
	}

	// Show example slider
	if (checkElement(topicSplit[2]) && topicSplit[2].includes("cover")) {
		showExampleElement(topicSplit[0], "sliderContainer");
		//console.log('Example Element loaded: ' + topicSplit[0]);
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
	let htmlElement = document.getElementById("status_" + device);
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
	let btnDescription = document.getElementById("exBtnDescription_" + device);
	let sliderDescription = document.getElementById("exSliderDescription_" + device);

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
			let iconForm = document.getElementById("exButtonForm_" + device);

			if (checkElement(iconForm)) {
				let radioButtons = iconForm.elements["exButtonImage-select"];
				
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
		description:         document.getElementById("description_" + device),
		component:           document.getElementById("component_" + device),
		connected:           document.getElementById("connected_" + device),
		status:              document.getElementById("status_" + device),
		manage:              document.getElementById("manage_" + device),
		manageSum:           document.getElementById("summary_" + device),
		saveButton:          document.getElementById("savebtn_" + device)
	}
}

function getDeviceDetails(device) {
	let htmlElements = getHtmlElements(device);

	if (checkElement(htmlElements.component)) {
		let iconForm = document.getElementById("exButtonForm_" + device);
		let icon = "";
		let legacy = false;

		if (checkElement(iconForm)) {
			icon = iconForm.elements["exButtonImage-select"].value;
		}

		if (legacyKeywords.some(legacyKeywords => htmlElements.component.value.includes(legacyKeywords))) {
			legacy = true;
		}

		return {
			description:         document.getElementById("description_" + device).value,
			component:           document.getElementById("component_" + device).value,
			connected:           document.getElementById("connected_" + device).textContent,
			status:              document.getElementById("status_" + device).textContent,
			exBtnDescription:    document.getElementById("exBtnDescription_" + device).textContent,
			exSliderDescription: document.getElementById("exSliderDescription_" + device).textContent,
			exButtonImage:       icon,
			legacy:              legacy
		}
	} else {
		return false;
	}
}

function getDeviceTopics(device, deviceDetails) {
	if (deviceDetails.legacy) {
		let componentSplit = deviceDetails.component.split(":");
		return {
			connected:    "shellies/" + device + "/" + componentSplit[0] + "/" + componentSplit[1] + "/connected",
			description:  "shellies/" + device + "/" + componentSplit[0] + "/" + componentSplit[1] + "/description",
			details:      "nanohome/" + deviceDetails.description + "/device",
			dashboard:    "nanohome/config/dashboard"
		}
	} else {
		return {
			rpc:          device + "/rpc",
			status:       statusOutTopicRoot +  device + "/status",
			connected:    device + "/status/" + deviceDetails.component + "/connected",
			description:  device + "/status/" + deviceDetails.component + "/description",
			details:      "nanohome/" + deviceDetails.description + "/device",
			dashboard:    "nanohome/config/dashboard"
		}
	}
}

// TODO - Übergabe von true / false bzw. deviceDetails.legacy
function getDeviceCommands(device, deviceDetails) {
	if (deviceDetails.legacy) {
		return {
			jsonStoreElement:   "deviceData",
			jsonStoreAttribute: "deviceDetails",
			createElement:      'create_dashboardelement "' + deviceDetails.description + '" "true"',
			deleteDevice:       'delete_device "' + device + '" "' + deviceDetails.component + '" "' + deviceDetails.description + '" "true"',
			deleteMeasurement:  'delete_measurement "' + deviceDetails.description + '"'
		}
	} else {
		return {
			jsonStoreElement:   "deviceData",
			jsonStoreAttribute: "deviceDetails",
			createElement:      'create_dashboardelement "' + deviceDetails.description + '" "false"',
			deleteDevice:       'delete_device "' + device + '" "' + deviceDetails.component + '" "' + deviceDetails.description + '" "false"',
			deleteMeasurement:  'delete_measurement "' + deviceDetails.description + '"'
		}
	}
}

// Populate json data from mqtt to element holding the data
function saveDeviceAttribute(payload) {
	let jsonStore = document.getElementById("deviceData");
	jsonStore.setAttribute("deviceDetails", payload);
}

// Generate Json for TimerData
function generateDashboardJson(device, deviceDetails, index) {
	let newElement = {
		"index": index,
		"usage": "dashboard",
		"deviceId": device,
		"component": deviceDetails.component,
		"description": deviceDetails.description,
		"icon": deviceDetails.exButtonImage
	};
	return newElement;
}

// Generate Json for DeviceData
function generateDeviceJson(device, deviceDetails) {
	let newElement = {
		"usage": "device",
		"deviceId": device,
		"component": deviceDetails.component,
		"description": deviceDetails.description,
		"legacy": deviceDetails.legacy
	};
	return newElement;
}

// Description changed
function descriptionChanged(device) {
	let htmlElements = getHtmlElements(device);
	let deviceDetails = getDeviceDetails(device);

	if (checkElement(htmlElements.manage)) {
		htmlElements.manage.open = true;

		if (deviceDetails.description != null && deviceDetails.description != "") {
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
	let summaryElement = document.getElementById(devmgrSummaryPrefix + device);

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

