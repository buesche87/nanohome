
/*
===============================================================
	MQTT Websocket Connection
===============================================================
*/

var host = location.hostname;
var user = "mqtt_grafana";
var pwd = "Grafana@MQTT";
var port = 1884;
var useTLS = false;
var mqtt;
var reconnectTimeout = 2000;
var cleansession = true;
var path = "";
var mqttClient = "nanohome_dasboard";
var mqttConnected = false;

/*
===============================================================
	Pub/Sub Options
===============================================================
*/

var fastsubscribe = 250;
var normalsubscribe = 500;
var longsubscribe = 1000;

/*
===============================================================
	Nanohome Shell
===============================================================
*/

var cmdInputTopic = "nanohome/shell/input";
var cmdOutputTopic = "nanohome/shell/output";

/*
===============================================================
	Global Variables
===============================================================
*/

var connectedTopicAll = "+/status/+/connected";
var descriptionTopicAll = "+/status/+/description";
var outputTopicAll = "+/status/+/output";
var deviceTopicAll = "nanohome/devices/+";
var standbyTopicAll = "nanohome/standby/+";
var timerTopicAll = "nanohome/timer/+";

var outputTopicAllLegacy = "shellies/+/relay/0";
var connectedTopicAllLegacy = "shellies/+/+/+/connected";
var descriptionTopicAllLegacy = "shellies/+/+/+/description";

/*
===============================================================
	Home Dashboard
===============================================================
*/

// Component names of legacy devices
var legacyKeywords = ["relay"];

// Identify mqtt messages source
var home_outputComponent = "";
var command;

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
var devmgr_exBtnIconSelect = "exButtonImage-select";
var devmgr_exSliderDescriptionPrefix = "exSliderDescription_";
var devmgr_saveBtnPrfix = "savebtn_";
var devmgr_statusPrefix = "status_";
var devmgr_summaryPrefix = "summary_";

// Site variables
var devmgr_tempComponent = "";

/*
===============================================================
	Standby Manager
===============================================================
*/

// json datastore
var standby_deviceDataJsonStore = "deviceData"; // HTML element
var standby_deviceDataAttribute = "deviceDetails"; // Attribute name

// HTML element prefixes
var standby_statusPrefix = "standbyStatus_";
var standby_powerPrefix = "standbyPower_";
var standby_waitPrefix = "standbyWait_";
var standby_saveBtnPrefix = "standbySaveBtn_";

/*
===============================================================
	Timer Manager
===============================================================
*/

// json datastore
var timer_deviceDataAttribute = "deviceDetails"; // HTML element
var timer_timerDataAttribute = "timerDetails"; // Attribute name

// HTML element prefixes
var timer_timerListPrefix = "timerList_"
var timer_timerEntryPrefix = "details_"
var timer_timerPeriodPrefix = "timerPeriod_"
var timer_timerOnPrefix = "timerOn_"
var timer_timerOffPrefix = "timerOff_"
var timer_timerStatusPrefix = "timerStatus_"
var timer_saveButtonPrefix = "timerSaveBtn_"
var timer_removeButtonPrefix = "timerRemoveBtn_"

/*
===============================================================
	3rd Party .js
===============================================================
*/

// MQTT Websocket min.js
var mqttws31minLocation = "../public/nanohome/js/mqttws31.min.js";
