// TODO:
// - Allgemeine Funktionen umsetzen (getDeviceCommands und so)
// - onMessageArrived optimieren
// - Output-Topic von Legacy-Devices > auf deviceid/componentdev/componentidx/output ?

/*
---------------------------------------------------------------
	Attributes and html elements on dashboard
---------------------------------------------------------------
*/

// TODO:
// - command > home_command

var home_outputElement = "statusOutput";
var home_outputComponent = "";
var command;

/*
---------------------------------------------------------------
	MQTT Subscribe
---------------------------------------------------------------
*/

// TODO: Test
// infinite subscribe to all devices output topic
function subscribeToOutput() {
	mqtt.subscribe(outputTopicAll, { qos: 2 });
	mqtt.subscribe(outputTopicAllLegacy, { qos: 2 });
}

/*
---------------------------------------------------------------
	MQTT Publish
---------------------------------------------------------------
*/

// TODO: Test
// send command Shelly Plus
function sendCommand(device, component, description, command) {
	let commandTopic = device + "/command/" + component;
	let statusTopic = device + "/status/" + component;

	// set global variable to identify mqtt message
	home_outputComponent = component;

	mqttSubscribe(statusTopic, 1000);
	mqttPublish(commandTopic, command, false);

	// not needed anymore
	// document.getElementById(home_outputElement).textContent = description + " - ";
}

// TODO: Test
// send command Shelly Legacy
function sendCommandLegacy(device, component, description, command) {
	let commandTopic = "shellies/" + device + "/relay/" + component + "/command";
	let statusTopic = "shellies/" + device + "/relay/" + component;

	// set global variable to identify mqtt message
	home_outputComponent = component;

	mqttSubscribe(statusTopic, 1000);
	mqttPublish(commandTopic, command, false);

	// not needed anymore
	// document.getElementById(home_outputElement).textContent = description + " - ";
}

/*
---------------------------------------------------------------
	onMessageArrived MQTT
---------------------------------------------------------------
*/

// TODO: Test
function onMessageArrived(message) {

	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	if ( topicSplit[0].startsWith("shelly") ) {

		let deviceid = topicSplit[0]
		let component = topicSplit[2]

		// set panel color active/passive
		if ( topicSplit[3] == "output" ) {
			setElementStatus(deviceid, component, payload);
		} 

		// TODO: optimieren
		// Status topic (plus)
		if (topicSplit[3] != "output" && home_outputComponent != "") {
			statusData = JSON.parse(payload);
			let output;

			if (home_outputComponent.includes("switch")) {
				output = statusData?.output;
			} else if (home_outputComponent.includes("cover")) {
				output = statusData?.target_pos;
			}
			
			if (checkElement(output)) {
				// setMessageValue(output);
				setElementStatus(deviceid, component, output);
			}
		}
	} else if ( topicSplit[0] == "shellies" ) {

		let deviceid = topicSplit[1]
		let componentdev = topicSplit[2]
		let componentidx = topicSplit[3]
		let componentMerged = componentdev + ":" + componentidx;

		// set panel color active/passive
		if ( topicSplit[4] == "output" ) {
			setElementStatus(deviceid, componentidx, payload);
		} 	

		// Status topic (legacy)
		if (topicSplit[4] != "output" && home_outputComponent != "") {
			// setMessageValue(payload);
			setElementStatus(deviceid, componentidx, payload);
		}
	}
}

/*
---------------------------------------------------------------
	Parse status from "Shelly.GetStatus"
---------------------------------------------------------------
*/

// Set element status from output mnessage
function setElementStatus(device, component, payload) {
	let panelElement = document.getElementById(device + "_" + component);

	if (checkElement(panelElement)) {
		switch(payload) {
			case "0":
			case 100:
			case "100":
			case "off":
			case false:
				panelElement.classList.remove('statusgreen');
				break;
			default:
				panelElement.classList.add('statusgreen');
		} 
	}
}

// TODO: REMOVE
// Add value to output message
function setMessageValue(value) {
	let statusElement = document.getElementById(home_outputElement);
	
	switch(value) {
		case false:
		case "off":
			outputText = "Off";
			break;
		case true:
		case "on":
			outputText = "On";
			break;
		default:
			outputText = value;
	} 

	if (home_outputComponent != "") {
		statusElement.textContent += outputText;
		home_outputComponent = "";
	}
}
