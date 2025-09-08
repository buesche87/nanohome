/*
===============================================================
	Device Manager
===============================================================
*/

// HTML element prefixes
var statusPrefix = "status_";
var componentPrefix = "component_";
var connectedPrefix = "connected_";
var descriptionPrefix = "description_";
var exBtnDescriptionPrefix = "exBtnDescription_";
var exBtnIconFormPrefix = "exButtonForm_";
var exBtnIconOption = "exButtonImage-select";
var exSliderPrefix = "exSlider_";
var exSliderDescriptionPrefix = "exSliderDescription_";
var saveBtnPrefix = "saveBtn_";
var clearMeasurementBtnPrefix = "clearMeasurementBtn_";
var removeComponentBtnPrefix = "removeComponentBtn_";
var removeDeviceBtnPrefix = "removeDeviceBtn_";

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

	// Stop processing if no device was provided (initial page load)
	if ( checkEmpty(device) ) { return false; }

	// Wait for the messages to arrive before further processing
	setTimeout(() => {
		getDeviceDetails(device)
	}, longsubscribe);
}

// Get device details (onLoad - per device)
function getDeviceDetails(device) {
	let htmlElements = getHtmlElements(device);
	let componentDetails = getElementValues(device);
	let componentTopics = getDeviceTopics(componentDetails);
	let nanohomeTopics = getNanohomeTopics(componentDetails.description);

	// Stop processing if component panel is hidden
    if ( elementHiddenOrMissing(htmlElements.component) ) { return false; }

	// Retreive published device config
	mqttSubscribe(nanohomeTopics.deviceConfig, fastsubscribe);

	// Stop processing if shelly is a gen1 device
	if ( legacyKeywords.some(legacyKeywords => componentTopics.connected.includes(legacyKeywords)) ) {
		return false;
	}

	// Request status from shelly
	let payload = '{"id":999, "src":"' + componentTopics.rpcSource + '", "method":"Shelly.GetStatus"}';
	mqttSubscribe(componentTopics.rpcDest, longsubscribe);
	mqttPublish(componentTopics.rpc, payload, false);
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

// Save a deviceconfig as json to nanohome/devices/#
function saveComponent(device) {
	let componentDetails = getElementValues(device);
	let componentTopics = getDeviceTopics(componentDetails);
	let nanohomeTopics = getNanohomeTopics(componentDetails.description);

	// Stop processing if description is empty (will delete all device configs)
	if ( checkEmpty(componentDetails.description) ) { return false; }

	// Generate a device config and publish it as retained message
	let jsonConfig = generateComponentConfig(componentDetails);
	mqttPublish(nanohomeTopics.deviceConfig, JSON.stringify(jsonConfig), true);
	
	// Publish description as retained message to component topic
	mqttPublish(componentTopics.description, componentDetails.description, true);
	
	// Refresh device on dashboard
	getDeviceStatus(device);
}

// Clear measurement through nanohome_shell
function clearMeasurement(device) {
	let componentDetails = getElementValues(device);

	if (confirm("Clear Measurement?")) {
		alert("Clearing Measurements...");
		shellCommand('clear_measurement "' + componentDetails.description + '"' );
	}
}

// Remove component through nanohome_shell
function removeComponent(device) {
	let componentDetails = getElementValues(device);

	if (confirm("Remove " + componentDetails.description + " from nanohome and clear measurements?")) {
		shellCommand('remove_component "' + componentDetails.description + '"');
	}
}

// Remove device through nanohome_shell
function removeComponent(device) {
	if (confirm("Remove " + device + " from nanohome?" )) {
		shellCommand('remove_device "' + device + '"');
	}
}

// Create a new dashboard panel through nanohome_shell
function createPanel(device) {
	let componentDetails = getElementValues(device);

	// Stop processing if description is empty (will delete all device configs)
	if ( checkEmpty(componentDetails.description) ) { return false; }

	// Confirm creation of a new panel
	let confirmDialog = confirm('Save "' + componentDetails.description + '" and create home dashboard panel?');

	// Publish any changes and create a panel
	if (confirmDialog) {
		saveComponent(device);
		shellCommand('create_panel "' + componentDetails.description + '"');
		getDeviceStatus(device);
	}
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

		// Parse a shelly status message
		if ( topicSplit[1] == "devicestatus" ) {
			// console.log('Device status received:');
			// console.log(JSON.parse(payload));
			populateNetworkElement(payload);
		}

		// Parse a device config
		if ( topicSplit[1] == "devices" ) {
			// console.log('Device info received:');
			// console.log(JSON.parse(payload));
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
		if ( component.includes("switch") ) {
			showExampleElement(device, "btnContainer");
		} else if ( component.includes("cover") ) {
			showExampleElement(device, "sliderContainer");
		}

		// Populate connected state
		if ( topicSplit[3] == "connected" ) {
			populateConnectionState(device, component, payload);
		}

		// Populate description
		if ( topicSplit[3] == "description" ) {
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
		if ( componentdev.includes("relay") ) {
			showExampleElement(device, "btnContainer");
		}

		// Populate connected state
		if ( topicSplit[4] == "connected" ) {
			populateConnectionState(device, componentMerged, payload);
		}

		// Populate description
		if ( topicSplit[4] == "description" ) {
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
	let componentSelect = document.getElementById(componentPrefix + device);
	let optionExists = false;

	// Stop processing if component element is hidden
    if ( elementHiddenOrMissing(componentSelect) ) { return false; }

	// Check if component was already populated
	for ( var i = 0; i < componentSelect.options.length; i++ ) {
		if ( componentSelect.options[i].value === component ) {
			optionExists = true;
			return;
		}
	}

	// Add component to list if it does not already exist
	if ( optionExists == false ) {
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
    if ( component != componentDetails.component ) { return false; }

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
    if ( component != componentDetails.component ) { return false; }

	// Set description if payload is not empty
	if ( !checkEmpty(payload) ) {
		htmlElements.description.value = payload;
	} else {
		htmlElements.description.value = "";
	}
}

// Populate status with ip address and update notification - [json input]
function populateNetworkElement(payload) {
	let statusData = JSON.parse(payload);
	let htmlElements = getHtmlElements(statusData.src);

	// Stop processing if status element is hidden
    if ( elementHiddenOrMissing(htmlElements.status) ) { return false; }

	// Parse json data and populate network panel
	let ipaddress = statusData?.result?.wifi?.sta_ip;
	let update = statusData?.result?.sys?.available_updates?.stable?.version;
	let statusText = "Offline";

	// Stop processing if ip adress is missing from json
    if ( elementHiddenOrMissing(ipaddress) ) { return false; }

	htmlElements.status.classList.remove('statusfalse');

	// Populate ip address and update notification
	if ( elementHiddenOrMissing(update) ) {
		htmlElements.status.innerText = ipaddress;
		htmlElements.status.classList.add('statusgreen');
	} else {
		// console.log(statusData.device + ' Update: v' + update);
		statusText = ipaddress + "\n" +	"(Update: v" + update + ")";
		htmlElements.status.innerText = statusText;
		htmlElements.status.classList.add('statusorange');
	}
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
	let radioButtons = htmlElements.exBtnIconForm.elements[exBtnIconOption];
	
	// Set icon if available was found
	for (let i = 0; i < radioButtons.length; i++) {
		if (radioButtons[i].value === jsonData.icon) {
			radioButtons[i].checked = true;
			break;
		}
	}
}

// Set status to legacy - [string input]
function setStatusLegacy(device) {
	let htmlElements = getHtmlElements(device);

	// Stop processing if status element is hidden
    if ( elementHiddenOrMissing(htmlElements.status) ) { return false; }

	htmlElements.status.innerText = "Legacy";
	htmlElements.status.classList.remove('statusfalse');
	htmlElements.status.classList.add('statusgreen')
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
		description:			document.getElementById(descriptionPrefix + device),
		component:				document.getElementById(componentPrefix + device),
		connected:				document.getElementById(connectedPrefix + device),
		status:					document.getElementById(statusPrefix + device),
		exBtnIconForm:			document.getElementById(exBtnIconFormPrefix + device),
		exBtnDescription:		document.getElementById(exBtnDescriptionPrefix + device),
		exSlider:				document.getElementById(exSliderPrefix + device),
		exSliderDescription:	document.getElementById(exSliderDescriptionPrefix + device),
		saveButton:				document.getElementById(saveBtnPrefix + device),
		clearMeasurementBtn:	document.getElementById(clearMeasurementBtnPrefix + device),
		removeComponentBtn:		document.getElementById(removeComponentBtnPrefix + device),
		removeDeviceBtn:		document.getElementById(removeDeviceBtnPrefix + device)
	}
}

// Get current devices element values - [object input]
function getElementValues(device) {
	let htmlElements = getHtmlElements(device);
	let icon = "";
	let legacy = false;

	// Stop processing if component element is hidden
    if ( elementHiddenOrMissing(htmlElements.component) ) { return false; }

	// Define icon value
	if ( !elementHiddenOrMissing(htmlElements.exBtnIconForm) ) {
		icon = htmlElements.exBtnIconForm.elements[exBtnIconOption].value;
	} 

	// Define legacy status
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
		exButtonImage:       icon,
		legacy:              legacy
	}
}

// Add functions to html elements if not yet added
function addHtmlElementFunctions(device) {
	let htmlElements = getHtmlElements(device);

	// Stop processing if status elements is hidden
	if ( elementHiddenOrMissing(htmlElements.component) ) { return false; }

	// Component element
	if (!htmlElements.component.dataset.listenerAdded) {
		htmlElements.component.addEventListener("change", function() {
			getDeviceStatus(device);
		});
		htmlElements.component.dataset.listenerAdded = "true";
	}

	// Connected element
	if (!htmlElements.connected.dataset.listenerAdded) {
		htmlElements.connected.addEventListener("click", function() { 
			connectComponent(device);
		});
		htmlElements.connected.dataset.listenerAdded = "true";
	}

	// Status element
	if (!htmlElements.status.dataset.listenerAdded) {
		htmlElements.status.addEventListener("click", function() { 
			window.open("http://" + device, "Device", "width=800,height=600");
		});
		htmlElements.status.dataset.listenerAdded = "true";
	}

	// Save element
	if (!htmlElements.saveButton.dataset.listenerAdded) {
		htmlElements.saveButton.addEventListener("click", function() { 
			saveComponent(device);
		});
		htmlElements.saveButton.dataset.listenerAdded = "true";
	}

	// Clear measurement element
	if (!htmlElements.clearMeasurementBtn.dataset.listenerAdded) {
		htmlElements.clearMeasurementBtn.addEventListener("click", function() { 
			clearMeasurement(device);
		});
		htmlElements.clearMeasurementBtn.dataset.listenerAdded = "true";
	}

	// Remove component element
	if (!htmlElements.removeComponentBtn.dataset.listenerAdded) {
		htmlElements.removeComponentBtn.addEventListener("click", function() { 
			removeComponent(device);
		});
		htmlElements.removeComponentBtn.dataset.listenerAdded = "true";
	}

	// Remove device element
	if (!htmlElements.removeDeviceBtn.dataset.listenerAdded) {
		htmlElements.removeDeviceBtn.addEventListener("click", function() { 
			removeDevice(device);
		});
		htmlElements.removeDeviceBtn.dataset.listenerAdded = "true";
	}

	// Example button
	if ( !elementHiddenOrMissing(htmlElements.exBtnDescription) ) { 
		if (!htmlElements.exBtnDescription.dataset.listenerAdded) {
			htmlElements.exBtnDescription.addEventListener("click", function() { 
				createPanel(device);
			});
			htmlElements.exBtnDescription.dataset.listenerAdded = "true";
		}
	}

	// Example slider
	if ( !elementHiddenOrMissing(htmlElements.exSliderDescription) ) {
		if (!htmlElements.exSliderDescription.dataset.listenerAdded) {
			htmlElements.exSliderDescription.addEventListener("click", function() { 
				createPanel(device);
			});
			htmlElements.exBtnDescription.dataset.listenerAdded = "true";
		}
	}
}

// Show example element - [string input]
function showExampleElement(device, element) {
	let htmlElement = document.getElementById(element + "_" + device);

	// Stop processing if html elements are missing
	if ( elementHiddenOrMissing(htmlElement) ) { return false; }

	htmlElement.classList.remove('elementHidden');
	htmlElement.classList.add('elementFlex');
}
