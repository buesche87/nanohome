// TODO: 
// - Dashbaord: Übernahme ID Prefixes
// - Dashbaord: getdetailsInfo > getDeviceStatus
// - Dashbaord: getDeviceDetails > getComponentDetails
// - Dashbaord: connectDevice > connectComponent

/*
  ---------------------------------------------------------------
	Attributes and html element prefixes on dashboard
  ---------------------------------------------------------------
*/

var devmgr_deviceDataJsonStore = "deviceData"; // HTML element
var devmgr_deviceDataAttribute = "deviceDetails"; // Attribute name of jsonStore element

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

		if (componentDetails.legacy == "true") {
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

// clear measurement
function clearMeasurement(device) {
	let componentDetails = getComponentDetails(device);
	let deviceCommands = getDeviceCommands(device, componentDetails);

	shellCommand(deviceCommands.clearMeasurement);
}

// TODO: Test
// Connect or disconnect component
function connectComponent(device) {
	let componentDetails = getComponentDetails(device);
	let mqttTopics = getMqttTopics(device, componentDetails);

	let payload = componentDetails.connected === "Disconnected" ? "true" : "false";

	mqttPublish(mqttTopics.connected, payload, true);
	getDeviceStatus(device);
}

// TODO: 
// - Search and replace existing element

// create json for new dashboard element
// merge new json into existing one from jsonStore
// publish merged json to "nanohome/devices/description"
function createDashboardElement(device) {
	let componentDetails = getComponentDetails(device);
	let mqttTopics = getMqttTopics(device, componentDetails);
	let deviceCommands = getDeviceCommands(device, componentDetails);

	// confirm creation of element
	let confirmDialog = confirm('Create Dashbaord element "' + componentDetails.description + '" for device: "' + device + '/' + componentDetails.component + '"?');

	if (confirmDialog) {
		let deviceDatajsonStore = document.getElementById(devmgr_deviceDataJsonStore);
		let existingJson = JSON.parse(deviceDatajsonStore.getAttribute(devmgr_deviceDataAttribute));

		// define new index
		let jsonIndex = checkElement(existingJson) ? checkJsonIndex(existingJson) : (existingJson = [], 1);

		// add entry to json
		let newJsonElement = createDashboardJson(device, componentDetails, jsonIndex);
		existingJson.push(newJsonElement);

		// publish new json element to "nanohome/home/description" 
		mqttPublish(mqttTopics.home, JSON.stringify(newJsonElement), true);

		// save modified json into deviceData attribute
		// run "create_panel" through nanohome shell
		deviceDatajsonStore.setAttribute(devmgr_deviceDataAttribute, JSON.stringify(existingJson));
		createPanel = deviceCommands.createPanel + ' "' + jsonIndex + '" "false"'
		shellCommand(createPanel);
		console.log ('Shell command: ' + createPanel)
	}
}

// TODO: Test
// clear measurements and remove device with nanohome shell command "remove_device"
function removeDevice(device) {
	let componentDetails = getComponentDetails(device);
	let deviceCommands = getDeviceCommands(device, componentDetails);

	shellCommand(deviceCommands.clearMeasurement);
	shellCommand(deviceCommands.removeDevice);
}

// TODO:
// - Replace description in json (html element attribute, mqtt topics)
// - Delete old mqtt topics in nanohome/

// save device details
function saveDevice(device) {
	let componentDetails = getComponentDetails(device);
	let mqttTopics = getMqttTopics(device, componentDetails);

	let jsonElement = createComponentJson(device, componentDetails);
	let payload = JSON.stringify(jsonElement);

	// Publish and refresh
	mqttPublish(mqttTopics.device, payload, true);
	mqttPublish(mqttTopics.description, componentDetails.description, true);
	getDeviceStatus(device);
	getDashboardInfo();
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
			fillComponentElement(deviceid, component);
			fillStatusElement(deviceid, component, topicSplit[3], payload);
			// setExampleElementDescription(deviceid, component, topicSplit[3], payload);
			console.log('Connected status: "' + payload + '" (' +  deviceid + ')');
		}

		// shelly-deviceid/status/component/description
		else if (topicSplit[3] == "description") {
			fillStatusElement(deviceid, component, topicSplit[3], payload);
			setExampleElementDescription(deviceid, component, payload);
			console.log('Description loaded: "' + payload + '" (' +  deviceid + ')');
		}

	} else if ( topicSplit[0] == "shellies" ) {

		let deviceid = topicSplit[1]
		let componentdev = topicSplit[2]
		let componentidx = topicSplit[3]
		let componentMerged = componentdev + ":" + componentidx;

		// shellies/shelly-deviceid/componentdev/componentindex/connected
		if (topicSplit[4] == "connected") {
			fillComponentElement(deviceid, componentMerged);
			fillStatusElement(deviceid, componentMerged, topicSplit[4], payload);
			// setExampleElementDescription(deviceid, componentMerged, topicSplit[4], payload);
			setStatusLegacy(deviceid);
			console.log('Connected status: "' + payload + '" (' +  deviceid + ')');
		}

		// shellies/shelly-deviceid/componentdev/componentindex/description
		else if (topicSplit[4] == "description") {
			fillStatusElement(deviceid, componentMerged, topicSplit[4], payload);
			setExampleElementDescription(deviceid, componentMerged, payload);
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

// TODO: Test
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
	Fill Elements
---------------------------------------------------------------
*/

// TODO: Test
// fill component element with content from mqtt message if it does not already exist
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

// TODO: Test
// fill example element with content from mqtt message
function setExampleElementDescription(device, component, element, payload) {
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

// TODO: Test
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

// TODO: Test
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

// TODO: Funktion aufteilen in fillConnectedElement und fillStatusElement ?
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

/*
---------------------------------------------------------------
	Helper Functions
---------------------------------------------------------------
*/

// get current devices html elements
function getDevicesHtmlElements(device) {
	return {
		description: document.getElementById(devmgr_descriptionPrefix + device),
		component:   document.getElementById(devmgr_componentPrefix + device),
		connected:   document.getElementById(devmgr_connectedPrefix + device),
		status:      document.getElementById(devmgr_statusPrefix + device),
		manage:      document.getElementById(devmgr_managePrefix + device),
		manageSum:   document.getElementById(devmgr_summaryPrefix + device),
		saveButton:  document.getElementById(devmgr_saveBtnPrfix + device)
	}
}

// get current components values
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

// Save json data retreived from mqtt to json store element
function saveDeviceAttribute(payload) {
	let jsonStore = document.getElementById(devmgr_deviceDataJsonStore);
	jsonStore.setAttribute(devmgr_deviceDataAttribute, payload);
}

// Description changed
function descriptionChanged(device) {
	let htmlElements = getDevicesHtmlElements(device);
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
	let htmlElements = getDevicesHtmlElements(device);
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

