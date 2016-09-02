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
var inputNodes = [];

function getDock(module, comName, callback, err) {

    if(!comName) err();
    if(docks[comName]) {
        callback(docks[comName]);
        return;
    }

    docks[comName] = new flotilla({
        portName: comName,
        onOpen: function(flotilla, args){
            module.REDvInfo(comName + " opened!");

            if(typeof callback === "function") {
                callback(flotilla);
                err = null;
                callback = null;
            }            
        },
        onUpdate: function(flotilla, args){
            inputNodes.forEach(function(node, index){
                if(node.comName == comName 
                && node.channel == args.channel 
                && typeof node.onUpdate === "function"){
                    node.onUpdate(args);
                }
            });
        },
        onLost: function(flotilla, args){
            inputNodes.forEach(function(node, index){
                if(node.comName == comName 
                && node.channel == args.channel 
                && typeof node.onLost === "function"){
                    node.onLost(args);
                }
            });
        },
        onFound: function(flotilla, args){
            inputNodes.forEach(function(node, index){
                if(node.comName == comName 
                && node.channel == args.channel 
                && typeof node.onFound === "function"){
                    node.onFound(args);       
                }
            });
        },
        onInfo: function(flotilla, message){
            module.REDvInfo(message);
        },
        onError: function(flotilla, message){
            module.REDWarn(message);

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

    var module = (function(RED){
        return {
            REDWarn: function(message){
                RED.log.warn("Flotilla: " + message);
            },
            REDvWarn: function(message){
                if( RED.settings.verbose ) RED.log.warn("Flotilla: " + message);
            },
            REDvInfo: function(message){
                if( RED.settings.verbose ) RED.log.info("Flotilla: " + message);
            }
        }
    })(RED);

    function FlotillaInput(config) {
        RED.nodes.createNode(this,config);

        this.comName = config.comName;
        this.channel = parseInt(config.channel);
        this.input = config.input;

        var node = this;

        this.onUpdate = function(args){
            if(node.input === "all"){
                node.send({topic:"flotilla/" + args.channel + "/" + args.module, payload: args});
            }
            else if(typeof args[node.input] !== "undefined"){
                node.send({topic:"flotilla/" + args.channel + "/" + args.module + "/" + node.input, payload: args[node.input]});
            }   
        };

        inputNodes.push(node);

        getDock(module,this.comName,function(){},function(){});

        node.on("close", function(done) {
            inputNodes.splice(inputNodes.indexOf(node),1);
            done();
        });
    }
    RED.nodes.registerType("node-flotilla in", FlotillaInput);

    function FlotillaOutput(config) {
        RED.nodes.createNode(this,config);

        this.comName = config.comName;
        this.channel = parseInt(config.channel) - 1;
        this.output = config.output;

        var node = this;

        node.on("input", function(msg) {
            if (typeof msg.payload === "number"){
                getDock(module,node.comName, function(dock){
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

    RED.httpAdmin.get("/flotilla/module", RED.auth.needsPermission("serial.read"), function(req,res) {
        var comName = req.query.comName;
        var channel = parseInt(req.query.channel) - 1;
        getDock(module,comName, function(dock){
            res.json(dock.modules[channel]);
        },
        function(message){
            res.json({error:message});
        });
    });

    RED.httpAdmin.get("/flotilla/dock", RED.auth.needsPermission("serial.read"), function(req,res) {
        var comName = req.query.comName;
        getDock(module,comName, function(dock){
            res.json(dock.modules);     
        },
        function(message){
            res.json({error:message});
        });
    });
};
