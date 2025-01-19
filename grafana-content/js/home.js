// Dashboard variables
var outputElement = "statusOutput";
var outComponent = "";
var command;

/*
---------------------------------------------------------------
	MQTT Subscribe
---------------------------------------------------------------
*/

// Subscribe to output topic indefinitely
function subscribeToOutput() {
	mqtt.subscribe(outputTopicAll, { qos: 2 });
	mqtt.subscribe(outputTopicAllLegacy, { qos: 2 });
}

/*
---------------------------------------------------------------
	MQTT Publish
---------------------------------------------------------------
*/

// Send command Shelly Plus
function sendCommand(device, component, description, command) {
	let divElement = document.getElementById(outputElement);
	let inputTopic = device + "/command/" + component;
	let statusTopic = device + "/status/" + component;
	outComponent = component;

	mqttSubscribe(statusTopic, 1000);
	mqttPublish(inputTopic, command, false);

	divElement.textContent = description + " - ";
}

// Send command Shelly Legacy
function sendCommandLegacy(device, component, description, command) {
	let divElement = document.getElementById(outputElement);
	let inputTopic = "shellies/" + device + "/relay/" + component + "/command";
	let statusTopic = "shellies/" + device + "/relay/" + component;
	outComponent = component;

	mqttSubscribe(statusTopic, 1000);
	mqttPublish(inputTopic, command, false);

	divElement.textContent = description + " - ";
}

/*
---------------------------------------------------------------
	onMessageArrived MQTT
---------------------------------------------------------------
*/

function onMessageArrived(message) {
	let payload = message.payloadString;
	let topic = message.destinationName;
	let topicSplit = topic.split("/");

	// Output topic (plus)
	if (topicSplit[3] == "output") {
		setElementStatus(topicSplit[0], topicSplit[2], payload);
	} 
	
	// Output topic (legacy)
	if (topicSplit[0] == "shellies" && topicSplit[2] == "relay" && topicSplit[3] == "0") {
		setElementStatus(topicSplit[1], topicSplit[3], payload);
	} 	
	
	// Status topic (plus)
	if (topicSplit[1] == "status" && topicSplit[3] != "output" && outComponent != "") {
		statusData = JSON.parse(payload);
		let output;

		if (outComponent.includes("switch")) {
			output = statusData?.output;
		} else if (outComponent.includes("cover")) {
			output = statusData?.target_pos;
		}
		
		if (checkElement(output)) {
			setMessageValue(output);
			setElementStatus(topicSplit[0], topicSplit[2], output);
		}
	}
	
	// Status topic (legacy)
	if (topicSplit[0] == "shellies" && topicSplit[4] != "output" && outComponent != "") {
		setMessageValue(payload);
		setElementStatus(topicSplit[1], topicSplit[3], payload);
	}
	
}

/*
---------------------------------------------------------------
	Parse status from "Shelly.GetStatus"
---------------------------------------------------------------
*/

// Set element status from output mnessage
function setElementStatus(device, component, payload) {
	let devElement = document.getElementById(device + "_" + component);

	if (checkElement(devElement)) {
		switch(payload) {
			case "0":
			case 100:
			case "100":
			case "off":
			case false:
				devElement.classList.remove('statusgreen');
				break;
			default:
				devElement.classList.add('statusgreen');
		} 
	}
}

// Add value to output message
function setMessageValue(value) {
	let statusElement = document.getElementById(outputElement);
	
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

	if (outComponent != "") {
		statusElement.textContent += outputText;
		outComponent = "";
	}
}
