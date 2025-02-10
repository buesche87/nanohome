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

	console.log('Command sent for: ' + description);
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

	console.log('Command sent for: ' + description);
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
				setElementStatus(deviceid, component, output);
			}
		}

	} else if ( topicSplit[0] == "shellies" ) {

		let deviceid = topicSplit[1]
		let componentidx = topicSplit[3]

		// set panel color active/passive
		if ( topicSplit[4] == "output" ) {
			setElementStatus(deviceid, componentidx, payload);
		} 	

		// Status topic (legacy)
		if (topicSplit[4] != "output" && home_outputComponent != "") {
			setElementStatus(deviceid, componentidx, payload);
		}
	}
}

/*
---------------------------------------------------------------
	Parse status from "Shelly.GetStatus"
---------------------------------------------------------------
*/

// TODO: Test
// Set element status from output mnessage
function setElementStatus(device, component, payload) {
	let panelElement = document.getElementById(device + "_" + component);

	if (checkElement(panelElement)) {
		switch(payload) {
			case "0":
			case "0.0":
			case 100:
			case "100":
			case "off":
			case "false":
			case false:
				panelElement.classList.remove('statusgreen');
				break;
			default:
				panelElement.classList.add('statusgreen');
		} 
	}
}
