/*
===============================================================
	Home Dashboard
===============================================================
*/

// Identify source of mqtt message
var home_outputComponent = "";
var command;

/*
===============================================================
	MQTT Subscribe
===============================================================
*/

// Infinitely subscribe to all devices output topic
function subscribeToOutput() {

	// Initial subscribe to output topic
	mqttSubscribe("+/status/+/output", fastsubscribe);
	mqttSubscribe("shellies/+/+/+/output", fastsubscribe);

	// Infinitely subscribe to status topic
	mqtt.subscribe("+/status/+", { qos: 2 });
	mqtt.subscribe("shellies/+/relay/+", { qos: 2 });
}

/*
===============================================================
	MQTT Publish
===============================================================
*/

// Send a command
function sendCommand(device, component, description, command) {
	let commandTopic = device + "/command/" + component;
	let statusTopic = device + "/status/" + component;

	// set global variable to identify mqtt message
	home_outputComponent = component;

	mqttSubscribe(statusTopic, normalsubscribe);
	mqttPublish(commandTopic, command, false);

	console.log('Command "' + command + '" sent for: ' + description);
}

// Send a command Legacy
function sendCommandLegacy(device, component, description, command) {
	let commandTopic = "shellies/" + device + "/relay/" + component + "/command";
	let statusTopic = "shellies/" + device + "/relay/" + component;

	// set global variable to identify mqtt message
	home_outputComponent = component;

	mqttSubscribe(statusTopic, normalsubscribe);
	mqttPublish(commandTopic, command, false);

	console.log('Command "' + command + '" sent for: ' + description);
}

/*
===============================================================
	onMessageArrived
===============================================================
*/

// TODO: status einfacher gestalten (trotzdem schneller wechsel)
// Decide what to do with new mqtt mesages
function onMessageArrived(message) {
	let payload = message.payloadString;
	let topicSplit = message.destinationName.split("/");

	// Shelly Plus devices
	if ( topicSplit[0].startsWith("shelly") ) {
		let device = topicSplit[0];
		let component = topicSplit[2];

		if ( topicSplit[3] === "output" ) {
			setElementStatus(device, component, payload);
		} else {
			let statusData = JSON.parse(payload);
			let switchOutput = statusData?.output;
			let coverPosition = statusData?.target_pos;
	
			if ( !elementHiddenOrMissing(coverPosition) ) {
				setElementStatus(device, component, coverPosition);
			} else if ( !elementHiddenOrMissing(switchOutput) ) {
				setElementStatus(device, component, switchOutput);
			}
		}
	} 

	// Shelly legacy devices
	else if ( topicSplit[0] == "shellies" ) {
		let device = topicSplit[1];
		let componentidx = topicSplit[3];

		setElementStatus(device, componentidx, payload);
	}
}

/*
===============================================================
	Manage Dashboard Panels
===============================================================
*/

// Parse response from "Shelly.GetStatus"
function setElementStatus(device, component, payload) {
	let panelElement = document.getElementById(device + "_" + component);

	// Stop processing if panel is hidden or missing
    if (elementHiddenOrMissing(panelElement)) { return; }	

	// Set panel status
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

// Show slider position on output element for 5 seconds
function updateHomeOutput(value) {
	let statusOutput = document.getElementById("statusOutput");

	statusOutput.textContent = value + '% offen';

    setTimeout(() => {
        statusOutput.textContent = "";
    }, 5000);
}
