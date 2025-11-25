/*
===============================================================
	MQTT Options
===============================================================
*/

// Connection parameters for the JavaScript Websocket Client
var host = location.hostname;
var user = "mqtt_grafana"; // will be set from env
var pwd = "Grafana@MQTT"; // will be set from env
var port = 1884;
var useTLS = (location.protocol === "https:"); // true bei https, false bei http
var mqtt;
var reconnectTimeout = 2000;
var cleansession = true;
var path = "";
var mqttClient = "nanohome_dasboard";
var qos = 2;
var fastsubscribe = 50;
var normalsubscribe = 100;
var longsubscribe = 200;
var mqttConnected = false;

// Timeout in ms to display an output
var statusOutputTimeout = 5000;

/*
===============================================================
	Nanohome Options
===============================================================
*/

// Nanohome shell topics
var cmdInputTopic = "nanohome/shell/input";
var cmdOutputTopic = "nanohome/shell/output";

// Weather widget preferences (will be set from env)
var weatherWidgetLink = "https://forecast7.com/en/47d058d31/lucerne/";
var weatherWidgetCity = "Lucerne";

/*
===============================================================
	Global Variables
===============================================================
*/

var legacyKeywords = ["relay"];
var deviceTopicAll = "nanohome/devices/+";
var connectedTopicAll = "+/status/+/connected";
var connectedTopicAllLegacy = "shellies/+/+/+/connected";
var descriptionTopicAll = "+/status/+/description";
var descriptionTopicAllLegacy = "shellies/+/+/+/description";

// Return nanohome mqtt topics - [string payload]
function getNanohomeTopics(description) {
	return {
		deviceConfig:  "nanohome/devices/" + description,
		standbyConfig: "nanohome/standby/" + description,
		timerConfig:   "nanohome/timer/" + description
	}
}

// Return devices mqtt topics - [object payload]
function getDeviceTopics(componentDetails) {
	if ( componentDetails.legacy ) {
		let componentSplit = componentDetails.component.split(":");
		return {
			connected:   "shellies/" + componentDetails.deviceId + "/" + componentSplit[0] + "/" + componentSplit[1] + "/connected",
			description: "shellies/" + componentDetails.deviceId + "/" + componentSplit[0] + "/" + componentSplit[1] + "/description",
		}
	} else {
		return {
			connected:   componentDetails.deviceId + "/status/" + componentDetails.component + "/connected",
			description: componentDetails.deviceId + "/status/" + componentDetails.component + "/description",
			rpc:         componentDetails.deviceId + "/rpc",
			rpcSource:   "nanohome/devicestatus/" + componentDetails.deviceId,
			rpcDest:     "nanohome/devicestatus/" + componentDetails.deviceId + "/rpc"
		}
	}
}

/*
===============================================================
	3rd Party .js
===============================================================
*/

// Simple Paho JS Client
var mqttws31minLocation = "../public/nanohome/js/mqttws31.min.js";

/*
===============================================================
	Global Helper Functions
===============================================================
*/

// Return latest index in json array, return 1 if none is set
function getJsonIndex(payload) {
	let jsonIndex = 1;

	// Stop processing if payload is empty
    if ( elementHiddenOrMissing(payload) ) { return false; }

	for (var j = 0; j < payload.length; j++) {
		if (payload[j].index > jsonIndex) {
			jsonIndex = payload[j].index;
		}
	}

	// Increment index
	jsonIndex++;
	return jsonIndex;
}

// Check if html elements are hidden or missing
function elementHiddenOrMissing(...elements) {
	return elements.some(element => element === undefined || element === null);
}

// Check if variable is empty
function checkEmpty(variable) {
    return variable?.toString().trim() === "";
}

// Check if variable contains numbers only
function checkDigit(value) {
	return /^\d+$/.test(value);
}

// Execute command with nanohome shell
function shellCommand(payload) {
	mqttPublish(cmdInputTopic, payload, false);
	console.log('Execute: ' + payload);
}

/*
===============================================================
	Tooltip
===============================================================
*/
/*
var autohidetimerms = 2000; // auto hide after 2 seconds

(function () {
	let tooltipEl = null;
	let showTimeout = null;
	let hideTimeout = null;
	let autoHideTimer = null;
	
	// create tooltip
	function createTooltip() {
		tooltipEl = document.createElement('div');
		tooltipEl.className = 'tooltip';
		document.body.appendChild(tooltipEl);
	}

	// show tooltip
	function showTooltip(target) {
		if (!tooltipEl) createTooltip();
		clearTimeout(hideTimeout);
		clearTimeout(autoHideTimer);
		const text = target.getAttribute('data-tooltip');
		if (!text) return;
		tooltipEl.textContent = text;

		// calculate position
		const rect = target.getBoundingClientRect();
		const ttRect = tooltipEl.getBoundingClientRect();

		// temporary make visible to calculate actual size
		tooltipEl.style.opacity = 0;
		tooltipEl.classList.add('show');
		tooltipEl.style.left = '0px';
		tooltipEl.style.top = '0px';

		// auto hide tooltip
		autoHideTimer = setTimeout(hideTooltip, autohidetimerms);

		// short timeout to get exact size
		const measured = tooltipEl.getBoundingClientRect();

		// tooltip above element
		const gap = 8;
		let top = rect.top - measured.height - gap;
		let left = rect.left + (rect.width - measured.width) / 2;
		tooltipEl.classList.remove('bottom');

		// tooltip below if there is no space
		if (top < 6) {
			top = rect.bottom + gap;
			tooltipEl.classList.add('bottom');
		}

		// keep in viewport
		const margin = 6;
		if (left < margin) left = margin;
		if (left + measured.width > window.innerWidth - margin) {
			left = Math.max(margin, window.innerWidth - measured.width - margin);
		}

		tooltipEl.style.left = `${Math.round(left)}px`;
		tooltipEl.style.top = `${Math.round(top)}px`;

		// show with short delay
		clearTimeout(showTimeout);
		showTimeout = setTimeout(() => {
			tooltipEl.classList.add('show');
			tooltipEl.style.opacity = '';
		}, 40);
	}

	// hide tooltip
	function hideTooltip() {
		clearTimeout(showTimeout);
		clearTimeout(hideTimeout);
		if (!tooltipEl) return;
		tooltipEl.classList.remove('show');

		// wait for transition
		hideTimeout = setTimeout(() => {
			if (tooltipEl) {
				tooltipEl.style.left = '-9999px';
				tooltipEl.style.top = '-9999px';
			}
		}, 160);
	}

	// mouseenter/mouseleave + focus/blur + touch
	document.addEventListener('mouseover', e => {
		const t = e.target.closest('[data-tooltip]');
		if (t) showTooltip(t);
	});

	document.addEventListener('mouseout', e => {
		const t = e.target.closest('[data-tooltip]');
		if (t) hideTooltip();
	});

	document.addEventListener('focusin', e => {
		const t = e.target.closest('[data-tooltip]');
		if (t) showTooltip(t);
	});

	document.addEventListener('focusout', e => {
		const t = e.target.closest('[data-tooltip]');
		if (t) hideTooltip();
	});

	// touch: tap once to show, twice to activate target
	let lastTouchTarget = null;
	document.addEventListener('touchstart', e => {
		const t = e.target.closest('[data-tooltip]');
		if (!t) return;
		if (lastTouchTarget === t) { // second tap: don't block
			lastTouchTarget = null;
			return;
		}
		lastTouchTarget = t;
		showTooltip(t);

		// tap on other element to hide tooltip
		document.addEventListener('touchend', function onEnd() {
			lastTouchTarget = null;
			document.removeEventListener('touchend', onEnd);
		});

		// block immediate action on element on first tap
		e.preventDefault();
	}, {passive: false});

	// reposition while scrolling
	['scroll', 'resize'].forEach(evt => {
		window.addEventListener(evt, () => {
			if (tooltipEl && tooltipEl.classList.contains('show')) {
				hideTooltip();
			}
		}, {passive: true});
	});
})();
*/