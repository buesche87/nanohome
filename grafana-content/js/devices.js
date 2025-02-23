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
var devmgr_exBtnIconOption = "exButtonImage-select";
var devmgr_exSliderPrefix = "exSlider_";
var devmgr_exSliderDescriptionPrefix = "exSliderDescription_";
var devmgr_saveBtnPrefix = "saveBtn_";
var devmgr_clearMeasurementBtnPrefix = "clearMeasurementBtn_";
var devmgr_removeComponentBtnPrefix = "removeComponentBtn_";
var devmgr_statusPrefix = "status_";
var devmgr_summaryPrefix = "summary_";

// Site variables
var devmgr_tempComponent = "";

/*
===============================================================
	MQTT Subscribe
===============================================================
*/

// Get device status (onLoad - all devices)
function getDeviceStatus(device) {
	mqttSubscribe(connectedTopicAll, fastsubscribe);
	mqttSubscribe(connectedTopicAllLegacy, fastsubscribe);
	mqttSubscribe(descriptionTopicAll, fastsubscribe);
	mqttSubscribe(descriptionTopicAllLegacy, fastsubscribe);

	// Wait for the messages to arrive
	setTimeout(() => {
		getDeviceDetails(device)
	}, fastsubscribe);
}

// Get device details (onLoad - per device)
function getDeviceDetails(device) {
	let htmlElements = getHtmlElements(device);
	let componentDetails = getElementValues(device);
	let componentTopics = getDeviceTopics(componentDetails);
	let nanohomeTopics = getNanohomeTopics(componentDetails.description);

	// Stop processing if component panel is hidden
    if ( elementHiddenOrMissing(htmlElements.component) ) { return false; }

	mqttSubscribe(nanohomeTopics.device, fastsubscribe);

	// Set legacy or request status from shelly
	if ( componentDetails.legacy ) {
		setStatusLegacy(device);
	} else {
		let payload = '{"id":999, "src":"' + componentTopics.rpcSource + '", "method":"Shelly.GetStatus"}';
		mqttSubscribe(componentTopics.rpcDest, longsubscribe);
		mqttPublish(componentTopics.rpc, payload, false);
	}
}

/*
===============================================================
	MQTT Publish
===============================================================
*/

// Connect or disconnect a component to nanohome
function connectComponent(device) {
	let componentDetails = getElementValues(device);
	let componentTopics = getDeviceTopics(componentDetails);

	// Publish new connected state to devices component topic
	let payload = componentDetails.connected === "Disconnected" ? "true" : "false";
	mqttPublish(componentTopics.connected, payload, true);

	// Refresh device on dashboard
	getDeviceStatus(device);
}

// Save component details as json to mqtt topic nanohome/devices/#
function saveComponent(device) {
	let componentDetails = getElementValues(device);
	let componentTopics = getDeviceTopics(componentDetails);
	let nanohomeTopics = getNanohomeTopics(componentDetails.description);

	// Generate device config and publish it to nanohome/devices
	let jsonConfig = generateComponentConfig(componentDetails);
	mqttPublish(nanohomeTopics.device, JSON.stringify(jsonConfig), true);
	
	// Publish description to component topic
	mqttPublish(componentTopics.description, componentDetails.description, true);
	
	// Refresh device on dashboard
	getDeviceStatus(device);
}

// Create a new dashboard panel through nanohome_shell
function createPanel(device) {
	let componentDetails = getElementValues(device);

	// Confirm creation of element
	let confirmDialog = confirm('Save "' + componentDetails.description + '" and create home dashboard panel?');

	// Publish any changes and create a panel
	if (confirmDialog) {
		saveComponent(device);
		shellCommand('create_panel "' + componentDetails.description + '"');
		getDeviceStatus(device);
	}
}

// Clear measurement through nanohome_shell
function clearMeasurement(device) {
	let componentDetails = getElementValues(device);

	shellCommand('clear_measurement "' + componentDetails.description + '"' );
}

// Remove device through nanohome_shell
function removeComponent(device) {
	let componentDetails = getElementValues(device);

	shellCommand('remove_component "' + componentDetails.description + '"');
}

/*
===============================================================
	onMessageArrived
===============================================================
*/

// Decide what to do with new mqtt mesages
function onMessageArrived(message) {
	let payload = message.payloadString;
	let topicSplit = message.destinationName.split("/");

	//================================
	// Topic: nanohome/+/+
	//================================
	if ( topicSplit[0] == "nanohome" ) {

		// Parse status message
		if ( topicSplit[1] == "devicestatus" ) {
			console.log('Device status received:');
			console.log(JSON.parse(payload));
			populateNetworkElement(payload);
		}

		// Set example panel description and icon
		if ( topicSplit[1] == "devices" ) {
			console.log('Device info received:');
			console.log(JSON.parse(payload));
			setExampleElementDescription(payload);
			setExampleElementIcon(payload);
		}
	} 
	
	//================================
	// Topic: shelly/+/+/+
	//================================
	else if ( topicSplit[0].startsWith("shelly") ) {
		let device = topicSplit[0];
		let component = topicSplit[2];

		populateComponentElement(device, component);
		addHtmlElementFunctions(device);

		// Show example button or slider
		if (component.includes("switch")) {
			showExampleElement(device, "btnContainer");
		} else if (component.includes("cover")) {
			showExampleElement(device, "sliderContainer");
		}

		// Populate connected state
		if (topicSplit[3] == "connected") {
			populateConnectionState(device, component, payload);
		}

		// Populate description
		if (topicSplit[3] == "description") {
			populateDescription(device, component, payload);
		}
	} 
	
	//================================
	// Topic: shellies/+/+/+/+
	//================================
	else if ( topicSplit[0] == "shellies" ) {
		let device = topicSplit[1]
		let componentdev = topicSplit[2]
		let componentidx = topicSplit[3]
		let componentMerged = componentdev + ":" + componentidx;

		populateComponentElement(device, componentMerged);
		addHtmlElementFunctions(device);
		setStatusLegacy(device);

		// Show example button
		if (componentdev.includes("relay")) {
			showExampleElement(device, "btnContainer");
		}

		// Populate connected state
		if (topicSplit[4] == "connected") {
			populateConnectionState(device, componentMerged, payload);
		}

		// Populate description
		if (topicSplit[4] == "description") {
			populateDescription(device, componentMerged, payload);
		}
	}
}

/*
===============================================================
	Populate Dashboard Data
===============================================================
*/

// Populate component dropdown - [string input]
function populateComponentElement(device, component) {
	let componentSelect = document.getElementById(devmgr_componentPrefix + device);
	let optionExists = false;

	// Stop processing if component element is hidden
    if ( elementHiddenOrMissing(componentSelect) ) { return false; }

	// Check if component was already populated
	for (var i = 0; i < componentSelect.options.length; i++) {
		if (componentSelect.options[i].value === component) {
			optionExists = true;
			return;
		}
	}

	// Add component to list if it does not already exist
	if (optionExists == false) {
		componentSelect.options[componentSelect.options.length] = new Option(component, component);
	}
}

// Populate connection state - [string input]
function populateConnectionState(device, component, payload) {
	let htmlElements = getHtmlElements(device);
	let componentDetails = getElementValues(device);

	// Stop processing if html elements are hidden or missing
    if ( elementHiddenOrMissing(htmlElements.component, htmlElements.connected) ) { return false; }

	// Stop processing if component in message is not the one requested
    if ( component != componentDetails.component  ) { 
		console.log('populateConnectionState: wrong component ' + component);
		return false; 
	}

	// Set connected state
	if ( payload == "true" ) {
		htmlElements.connected.textContent = "Connected";
		htmlElements.connected.classList.add('statusgreen');
		htmlElements.connected.classList.remove('statusfalse');
	} else {
		htmlElements.connected.textContent = "Disconnected";
		htmlElements.connected.classList.add('statusfalse');
		htmlElements.connected.classList.remove('statusgreen');
	}
}

// Populate description - [string input]
function populateDescription(device, component, payload) {
	let htmlElements = getHtmlElements(device);
	let componentDetails = getElementValues(device);

	// Stop processing if html elements are hidden or missing
    if ( elementHiddenOrMissing(htmlElements.component, htmlElements.status) ) { return false; }

	// Stop processing if component in message is not the one requested
    if ( component != componentDetails.component ) { 
		console.log('populateDescription: wrong component ' + component);
		return false; 
	}

	// Set description
	if ( !checkEmpty(payload)) {
		htmlElements.description.value = payload;
	} else {
		htmlElements.description.value = "";
	}
}

// Populate status with ip address and update notification - [json input]
function populateNetworkElement(payload) {
	let statusData = JSON.parse(payload);
	let htmlElements = getHtmlElements(statusData.src);

	// Stop processing if network element is hidden
    if ( elementHiddenOrMissing(htmlElements.status) ) { return false; }

	// Parse json data and populate network panel
	let ipaddress = statusData?.result?.wifi?.sta_ip;
	let update = statusData?.result?.sys?.available_updates?.stable?.version;
	let statusText = "Offline";

	// Stop processing if ip adress is missing from json
    if ( elementHiddenOrMissing(ipaddress) ) { return false; }

	htmlElements.status.classList.remove('statusfalse');

	// Populate ip address or update notification
	if ( elementHiddenOrMissing(update) ) {
		htmlElements.status.innerText = ipaddress;
		htmlElements.status.classList.add('statusgreen');
	} else {
		console.log(statusData.device + ' Update: v' + update);
		statusText = ipaddress + "\n" +	"(Update: v" + update + ")";
		htmlElements.status.innerText = statusText;
		htmlElements.status.classList.add('statusorange');
	}
}

// Set status to legacy - [string input]
function setStatusLegacy(device) {
	let htmlElements = getHtmlElements(device);

	// Stop processing if status panel is hidden
    if ( elementHiddenOrMissing(htmlElements.status) ) { return false; }

	htmlElements.status.innerText = "Legacy";
	htmlElements.status.classList.remove('statusfalse');
	htmlElements.status.classList.add('statusgreen')
}

// Set example panel description - [json input]
function setExampleElementDescription(payload) {
	let jsonData = JSON.parse(payload);
	let htmlElements = getHtmlElements(jsonData.deviceId);

	// Populate button or slider, the one thats visible
	if ( !elementHiddenOrMissing(htmlElements.exBtnDescription) ) {
		htmlElements.exBtnDescription.textContent = jsonData.description;
	} else if ( !elementHiddenOrMissing(htmlElements.exSliderDescription) ) {
		htmlElements.exSliderDescription.textContent = jsonData.description;
	}
}

// Set example panel icon - [json input]
function setExampleElementIcon(payload) {
	let jsonData = JSON.parse(payload);
	let htmlElements = getHtmlElements(jsonData.deviceId);

	// Stop processing if icon element is hidden or does not exist
    if ( elementHiddenOrMissing(htmlElements.exBtnIconForm) )  { return false; }

	// Get available icons
	let radioButtons = htmlElements.exBtnIconForm.elements[devmgr_exBtnIconOption];
	
	// Set icon if available was found
	for (let i = 0; i < radioButtons.length; i++) {
		if (radioButtons[i].value === jsonData.icon) {
			radioButtons[i].checked = true;
			break;
		}
	}
}

/*
===============================================================
	Generate Data
===============================================================
*/

// Generate component config, gets published to "nanohome/devices" - [object input / json output]
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
	HTML Element Functions
===============================================================
*/

// Get current devices html elements - [string input]
function getHtmlElements(device) {
	return {
		description:			document.getElementById(devmgr_descriptionPrefix + device),
		component:				document.getElementById(devmgr_componentPrefix + device),
		connected:				document.getElementById(devmgr_connectedPrefix + device),
		status:					document.getElementById(devmgr_statusPrefix + device),
		exBtnIconForm:			document.getElementById(devmgr_exBtnIconFormPrefix + device),
		exBtnDescription:		document.getElementById(devmgr_exBtnDescriptionPrefix + device),
		exSlider:				document.getElementById(devmgr_exSliderDescriptionPrefix + device),
		exSliderDescription:	document.getElementById(devmgr_exSliderPrefix + device),
		saveButton:				document.getElementById(devmgr_saveBtnPrefix + device),
		clearMeasurementBtn:	document.getElementById(devmgr_clearMeasurementBtnPrefix + device),
		removeComponentBtn:		document.getElementById(devmgr_removeComponentBtnPrefix + device)
	}
}

// Get current devices element values - [object input]
function getElementValues(device) {
	let htmlElements = getHtmlElements(device);

	// Stop processing if component element is hidden
    if ( elementHiddenOrMissing(htmlElements.component) ) { return false; }

	// Define icon value
	let icon = "";
	if ( !elementHiddenOrMissing(htmlElements.exBtnIconForm) ) {
		icon = htmlElements.exBtnIconForm.elements[devmgr_exBtnIconOption].value;
	} 

	// Define legacy status
	let legacy = false;
	if ( legacyKeywords.some(legacyKeywords => htmlElements.component.value.includes(legacyKeywords)) ) {
		legacy = true;
	}

	return {
		deviceId:            device,
		description:         htmlElements.description.value,
		component:           htmlElements.component.value,
		connected:           htmlElements.connected.textContent,
		status:              htmlElements.status.textContent,
		exBtnDescription:    htmlElements.exBtnDescription.textContent,
		exSliderDescription: htmlElements.exSliderDescription.textContent,
		icon:                icon,
		legacy:              legacy
	}
}

// Add functions to html elements
function addHtmlElementFunctions(device) {
	let htmlElements = getHtmlElements(device);

	// Stop processing if status elements is hidden
	if ( elementHiddenOrMissing(htmlElements.component) ) { return false; }

	htmlElements.connected.onclick = function() { connectComponent(device); };
	htmlElements.status.onclick = function() { window.open("http://" + device, "Device", "width=800,height=600"); };

	if ( !elementHiddenOrMissing(htmlElements.exBtnDescription) ) { 
		htmlElements.exBtnDescription.addEventListener("onclick", function() {
			createPanel(device);
		});
	}

	if ( !elementHiddenOrMissing(htmlElements.exSliderDescription) ) {
		htmlElements.exSlider.addEventListener("onclick", function() {
			createPanel(device);
		});
	}

	htmlElements.saveButton.addEventListener("onclick", function() {
		saveComponent(device);
	});

	htmlElements.clearMeasurementBtn.addEventListener("onclick", function() {
		clearMeasurement(device);
	});

	htmlElements.removeComponentBtn.addEventListener("onclick", function() {
		removeComponent(device);
	});
}

/*
===============================================================
	Helper Functions
===============================================================
*/

// Show example element - [string input]
function showExampleElement(device, element) {
	let divElement = document.getElementById(element + "_" + device);

	// Stop processing if html elements are missing
	if ( elementHiddenOrMissing(divElement) ) { return false; }

	divElement.classList.remove('elementHidden');
	divElement.classList.add('elementFlex');
}
