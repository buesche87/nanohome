// ID prefixes of elements on dashboard
var devmgrDescriptionPrefix = "description_";
var devmgrComponentPrefix = "component_";
var devmgrConnectedPrefix = "connected_";
var devmgrManagePrefix = "manage_";
var devmgrIconPrefix = "icon_";
var devmgrBtnDescriptionPrefix = "exBtnDescription_";
var devmgrSliderDescriptionPrefix = "exSliderDescription_";
var devmgrSaveBtnPrfix = "savebtn_";
var devmgrDetailsPrefix = "details_";
var devmgrSummaryPrefix = "summary_";
var devmgrStatusPrefix = "status_";

/*
  ---------------------------------------------------------------
	MQTT Subscribe
  ---------------------------------------------------------------
*/

// TODO
function getDashboardInfo() {
	mqttSubscribe(dashboardTopic, fastsubscribe);
}

function getDeviceInfo() {
	mqttSubscribe(connectedTopicAll, fastsubscribe);
	mqttSubscribe(connectedTopicAllLegacy, fastsubscribe);
	mqttSubscribe(descriptionTopicAll, fastsubscribe);
	mqttSubscribe(descriptionTopicAllLegacy, fastsubscribe);
}

// Get device infos (onLoad - per device)
function getdetailsInfo(device) {
	let deviceDetails = getDeviceDetails(device);

	if (checkElement(deviceDetails)) {
		let mqttTopics = getMqttTopics(device, deviceDetails);

		if (deviceDetails.legacy) {
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

// Connect or disconnect device
function connectDevice(device) {
	let deviceDetails = getDeviceDetails(device);
	let mqttTopics = getMqttTopics(device, deviceDetails);

	// Get current connected value
	let payload = deviceDetails.connected === "Disconnected" ? "true" : "false";

	// Publish and refresh
	mqttPublish(mqttTopics.connected, payload, true);
	getDeviceInfo(device);
}


// Save device details
// TODO - Replace description in json (html element attribute, mqtt topics)
// TODO - Delete old mqtt topics in nanohome/
function saveDevice(device) {
	let deviceDetails = getDeviceDetails(device);
	let mqttTopics = getMqttTopics(device, deviceDetails);

	let jsonElement = generateDeviceJson(device, deviceDetails);
	let payload = JSON.stringify(jsonElement);

	// Publish and refresh
	mqttPublish(mqttTopics.device, payload, true);
	mqttPublish(mqttTopics.description, deviceDetails.description, true);
	getDeviceInfo(device);
	getDashboardInfo();
}

// Create dashboard element
function createDashboardElement(device) {
	let deviceDetails = getDeviceDetails(device);
	let mqttTopics = getMqttTopics(device, deviceDetails);
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
		mqttPublish(mqttTopics.home, JSON.stringify(newJsonElement), true);
		createPayload = deviceCommands.createPanel + ' "' + jsonIndex + '"'
		shellCommand(createPayload);
		console.log (createPayload)
	}
}

// Delete measurement
function clearMeasurement(device) {
	let deviceDetails = getDeviceDetails(device);
	let deviceCommands = getDeviceCommands(device, deviceDetails);

	shellCommand(deviceCommands.clearMeasurement);
}

// Delete device
function removeDevice(device) {
	let deviceDetails = getDeviceDetails(device);
	let deviceCommands = getDeviceCommands(device, deviceDetails);

	shellCommand(deviceCommands.clearMeasurement);
	shellCommand(deviceCommands.removeDevice);
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

	if ( topicSplit[0] == "nanohome" ) {

		let description = topicSplit[2]

		if ( topicSplit[1] == "devices" ) {
			// tbd
		} else if ( topicSplit[1] == "home" ) {

			// nanohome/home/dashboard
			if (topicSplit[2] == "dashboard") {
				saveDeviceAttribute(payload);
				setExampleElementIcon(payload);
				console.log("Dashboard config loaded");
				//console.log(payload);
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
			// console.log("status retreived");

			// Show example button
			if (component.includes("switch")) {
				showExampleElement(deviceid, "btnContainer");
				//console.log('Example Element loaded: ' + topicSplit[0]);
			}

			// Show example slider
			else if (component.includes("cover")) {
				showExampleElement(deviceid, "sliderContainer");
				//console.log('Example Element loaded: ' + topicSplit[0]);
			}
		}

		// shelly-deviceid/status/component/connected
		else if (topicSplit[3] == "connected") {
			fillComponents(deviceid, component);
			fillStatusElements(deviceid, component, topicSplit[3], payload);
			fillExampleElements(deviceid, component, topicSplit[3], payload);
			//console.log('Connection Status loaded: ' + deviceid);
		}

		// shelly-deviceid/status/component/description
		else if (topicSplit[3] == "description") {
			fillStatusElements(deviceid, component, topicSplit[3], payload);
			fillExampleElements(deviceid, component, topicSplit[3], payload);
			//console.log('Description loaded: "' + payload + '" (' +  deviceid + ')');
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
		}

		// shellies/shelly-deviceid/componentdev/componentindex/description
		else if (topicSplit[4] == "description") {
			fillStatusElements(deviceid, componentMerged, topicSplit[4], payload);
			fillExampleElements(deviceid, componentMerged, topicSplit[4], payload);
			setStatusLegacy(deviceid);
		}

		// Show example button legacy
		if (componentdev.includes("relay")) {
			showExampleElement(deviceid, "btnContainer");
			setStatusLegacy(deviceid);
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
	let htmlElement = document.getElementById(devmgrStatusPrefix + device);
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
	let btnDescription = document.getElementById(devmgrBtnDescriptionPrefix + device);
	let sliderDescription = document.getElementById(devmgrBtnDescriptionPrefix + device);

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
		description:         document.getElementById(devmgrDescriptionPrefix + device),
		component:           document.getElementById(devmgrComponentPrefix + device),
		connected:           document.getElementById(devmgrConnectedPrefix + device),
		status:              document.getElementById(devmgrStatusPrefix + device),
		manage:              document.getElementById(devmgrManagePrefix + device),
		manageSum:           document.getElementById(devmgrSummaryPrefix + device),
		saveButton:          document.getElementById(devmgrSaveBtnPrfix + device)
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
			description:         document.getElementById(devmgrDescriptionPrefix + device).value,
			component:           document.getElementById(devmgrComponentPrefix + device).value,
			connected:           document.getElementById(devmgrConnectedPrefix + device).textContent,
			status:              document.getElementById(devmgrStatusPrefix + device).textContent,
			exBtnDescription:    document.getElementById(devmgrBtnDescriptionPrefix + device).textContent,
			exSliderDescription: document.getElementById(devmgrSliderDescriptionPrefix + device).textContent,
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

