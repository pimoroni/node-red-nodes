var flotilla = require("./flotilla");

/*
 * Flotilla Node-RED Node
 * 
 * - Should support multiple docks
 * - Each dock has up to 8 connected modules
 * - Each module may have one or more inputs or outputs;
 *    - Like temperature/pressure as inputs on Weather
 *    - Or time/temperature as outputs on Number
 *
 * UX
 * 
 * A drop down list should display a list of Docks. Ideally any connected dock would be queried for its particulars
 * so that this list could use the dock friendly-name if its set.
 *
 * Once a Dock is selected, an asyncronous connection is established and maintained, and the connected modules enumerated.
 *
 * The list of connected modules populates a second drop down list (or a nice grid of icons if we're feeling sassy)
 *
 * Selecting/clicking a connected module would prompt a third UI widget for selecting a particular module output/input stream and configuring options.
 *
 * Internally
 *
 * The Flotilla onUpdate hook would be used to collect updates from connected modules and dispatch them to the nodes concerned.
 *
 * The relationship between nodes and Docks should be keyed upon comPort
 *
*/

var docks = {};
var callbacks = {};

function registerCallback(comName, channel, callback, success, err){
    if(!callbacks[comName]) callbacks[comName] = {};

    callbacks[comName][channel] = callback;
    console.log("Registering callback: " + comName + " " + channel);

    getDock(comName, success, err);
}

function getDock(comName, callback, err) {
    console.log("Getting Dock: " + comName);

    if(!comName) err();
    if(docks[comName]) {
        callback(docks[comName]);
        return;
    }

    docks[comName] = new flotilla({
        portName: comName,
        onOpen: function(flotilla, args){
            console.log(comName + " opened!");

            if(typeof callback === "function") {
                callback(flotilla);
                err = null;
                callback = null;
            }            
        },
        onUpdate: function(flotilla, args){
            var channel = args.channel;
            if(callbacks[comName] && typeof callbacks[comName][channel] === "function"){
                callbacks[comName][channel](flotilla, "update", args);
            }
        },
        onLost: function(flotilla, args){
            var channel = args.channel;
            if(callbacks[comName] && typeof callbacks[comName][channel] === "function"){
                callbacks[comName][channel](flotilla, "lost", args);
            }
        },
        onFound: function(flotilla, args){
            var channel = args.channel;
            if(callbacks[comName] && typeof callbacks[comName][channel] === "function"){
                callbacks[comName][channel](flotilla, "found", args);
            }
        },
        onInfo: function(flotilla, message){
            console.log("FLOTILLA(INFO): " + message);
        },
        onError: function(flotilla, message){
            console.log("FLOTILLA(ERROR): " + message);
            if(typeof err === "function") {
                err(message);
                err = null;
                callback = null;
            }
            docks[comName] = null;
        },
    });

};

module.exports = function(RED) {
    "use strict";

    function REDvWarn(message){
        if( RED.settings.verbose ) RED.log.warn("ExplorerHAT: " + message);
    }
    
    function REDvInfo(message){
        if( RED.settings.verbose ) RED.log.info("ExplorerHAT: " + message);
    }

    function FlotillaInput(config) {
        RED.nodes.createNode(this,config);
        console.log("New Input Node With Config: ", config);
        this.comName = config.comName;
        this.channel = parseInt(config.channel);
        this.input = config.input;

        var node = this;

        registerCallback(this.comName, this.channel, function(flotilla, evt, args){
            console.log("Node got event: ", evt, args);
            if(typeof args[node.input] !== "undefined"){
                node.send({topic:"flotilla/" + args.channel + "/" + args.module, payload: Number(args[node.input])});
            }
        },
        function(flotilla){}, // Successfully registered callback,
        function(message){}) // Failed to register callback;
    }
    RED.nodes.registerType("node-flotilla in", FlotillaInput);

    function FlotillaOutput(config) {
        RED.nodes.createNode(this,config);
        console.log("New Output Node With Config: ", config);
        this.comName = config.comName;
        this.channel = parseInt(config.channel) - 1;
        this.output = config.output;

        var node = this;

        node.on("input", function(msg) {
            console.log("Got message", msg, this.comName, this.channel, this.output);
            if (typeof msg.payload === "number"){
                getDock(node.comName, function(dock){
                    if(dock.modules[node.channel]){
                        if(typeof dock.modules[node.channel][node.output] === "function"){
                            dock.modules[node.channel][node.output](msg.payload);
                        }
                    }
                });           
            }
        });
    }
    RED.nodes.registerType("node-flotilla out", FlotillaOutput);

    function FlotillaModify(config) {
        RED.nodes.createNode(this,config);
    }
    RED.nodes.registerType("node-flotilla modify", FlotillaModify);

    RED.httpAdmin.get("/flotilla/docks", RED.auth.needsPermission("serial.read"), function(req,res) {
        flotilla.listDocks(function(docks){
            res.json(docks);
        });
    });

    RED.httpAdmin.get("/flotilla/test", function(req,res) {
        console.log(req);
    });

    RED.httpAdmin.get("/flotilla/dock", RED.auth.needsPermission("serial.read"), function(req,res) {
        var comName = req.query.comName;
        getDock(comName, function(dock){
            res.json(dock.modules);     
        },
        function(message){
            res.json({error:message});
        });
    });
};
