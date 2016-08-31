"use strict";

var assign = require('object.assign').getPolyfill();
var SerialPort = require("serialport");

var Flotilla = function(settings){
    var flotilla = this;

    // USB VID/PID for Flotilla Dock
    var FLOTILLA_VID = "0x16d0";
    var FLOTILLA_PID = "0x08c3";

    var moduleNames = ['colour','motion','light','dial','slider','joystick','weather','touch','motor','number','matrix','rainbow'];
    var moduleHandlers = {};

    var defaultSettings = {
        portName: null
    }

    settings = assign({}, defaultSettings, settings);

    var identifyTimeout = null;
    var port = null;

    this.modules = [null, null, null, null, null, null, null, null];

    this.dockVersion = null;
    this.dockSerial = null;
    this.dockUser = null;
    this.dockName = null;

    this.identified = false;

    function triggerCallback(callback, args){
        if(typeof callback === "function") callback(flotilla, args);
    }

    function sendCmd(cmd) {
        /* Send a command to the Dock,
         * all commands are a single character,
         * sometimes followed by one or more arguments,
         * and always suffixed with \r
         */
        port.write(cmd + '\r');
    }

    function requestVersionInfo() {
        sendCmd('v');
    }

    function enumerateDevices() {
        sendCmd('e');
    }

    function connect() {
        /* Attempt to connect to the Flotilla Dock and identify it using the 'v' command */

        port = new SerialPort(settings.portName, {
            baudRate: 115200,
            parser: SerialPort.parsers.readline('\n')
        });

        port.on("open", function(error) {
            port.drain(function(error){
                requestVersionInfo();
                port.flush(function(){
                    identifyTimeout = setTimeout(function() {
                        //console.log("SYSTEM: ERROR: Failed to identify Flotilla dock");
                        triggerCallback(settings.onError, "Failed to identify Flotilla Dock");
                        port.close();
                    }, 4000);
                });
            });
        });

        port.on("data", function(data) {
            //console.log("GOT DATA:" + data);
            data = data.trim();
            if(data[0] == '#'){
                //console.log("GOT INFO: " + data);
                handleInfo(data.substring(2));
                return;
            }
            if(flotilla.identified) {
                handleCommand(data)
            };
        });

        port.on("error", function(error) {
            triggerCallback(settings.onError, error);
        });

        port.on("disconnect", function(error) {
            triggerCallback(settings.onError, error);
        });

        port.on("close", function() {
            triggerCallback(settings.onClose);
            clearTimeout(identifyTimeout);
        });
    }

    function validateIdentity(){
        /* If a version, serial, username and dockname have been set, the dock is treated as being identified,
         * the onOpen callback is triggered after successful identification.
         *
         */
    
        if([flotilla.dockVersion, flotilla.dockSerial, flotilla.dockUser, flotilla.dockName].indexOf(null) == -1){
            clearTimeout(identifyTimeout);
            flotilla.identified = true;
            enumerateDevices();
            triggerCallback(settings.onOpen);
        }
    }

    function handleInfo(data) {
        /* Any message from the Dock starting with "#" is treated as info
         * many of these are debug messages, apart from the special cases returned in answer to command 'v'
         *
         * Version: the dock version number
         * Serial: A unique serial number for each dock
         * User: The user-name saved to the dock
         * Dock: The dock-name saved to the dock
         *
         * These special cases are parsed into variables for later use, and used to verify a valid, sane dock
         * is connected.
         *
         */
        //console.log("INFO: " + data);

        if(data.substring(0,8) === "Version:"){
            flotilla.dockVersion = parseFloat(data.substring(9));
            validateIdentity();
            return;
        }

        if(data.substring(0,7) === "Serial:"){
            flotilla.dockSerial = data.substring(8);
            validateIdentity();
            return;
        }

        if(data.substring(0,5) === "User:"){
            flotilla.dockUser = data.substring(6);
            validateIdentity();
            return;
        }

        if(data.substring(0,5) === "Dock:"){
            flotilla.dockName = data.substring(6);
            validateIdentity();
            return;
        }

        triggerCallback(settings.onInfo, "DOCK: " + data);
    }

    function parseArgs(channel, module, args){
        /* Loads the relevant parser function for a module, turning
         * the positional, string arguments into correctly scaled,
         * formatted and named arguments for each input module
         *
         */

        if(typeof moduleHandlers[module] === "function"){
            return moduleHandlers[module](flotilla, args, channel, module);
        }
        
        return args;
    }

    function parseCommand(data) {
        /* Parse a Flotilla Module command into channel, module and args,
         * use module specific filters to generate objects with named args.
         *
         * The nasty regular expression here splits on forward-slash, space and comma,
         * turning: "5/light 200,225,325" into ["5", "light", "200", "225", "325"]
         * ie: a set of positional arguments which are always: channel, module, arguments
         *
         */

        var args = data.split(/\/| |\,/);
        var channel = parseInt(args.shift());
        var module = args.shift();
        return assign({},{
                    channel: channel,
                    module: module
                },
                parseArgs(channel, module, args)
        );
    }

    function handleCommand(data) {
        /* Handle an incoming command from Flotilla Dock to client. 
         * These may include module updates, connect and disconnect events, in the format:
         *
         *     <cmd> <channel>/<module_type> <data>
         * 
         */

        var command = data[0]; //  Get command char
        data = data.substring(2); // Strip off command char and space separator
        switch(command){
            case 'u': // Module update
                var m = parseCommand(data);
                flotilla.modules[m.channel - 1] = m;
                triggerCallback(settings.onUpdate, m);
                break;
            case 'c': // Module connected
                var m = parseCommand(data);
                flotilla.modules[m.channel - 1] = m;
                triggerCallback(settings.onFound, m);
                break;
            case 'd': // Module disconnected
                var m = parseCommand(data);
                flotilla.modules[m.channel - 1] = null;
                triggerCallback(settings.onLost, m);
                break;
        }
    }

    moduleNames.forEach(function(name, index){
        triggerCallback(settings.onInfo, "Loading " + name);
        try {
            moduleHandlers[name] = require('./' + name);
        } catch (err) {
            triggerCallback(settings.onError, "Failed to load " + name);
        }
    });

    if(settings.portName === null){
        /* Attempt to auto-detect a Flotilla Dock by picking
         * the first serial device with a matching VID/PID
         *
         */

        triggerCallback(settings.onInfo, "SYSTEM: Trying to auto-detect port");

        SerialPort.list(function(err, ports) {
            ports.forEach(function(port, index){
                if(settings.portName === null && port.vendorId == FLOTILLA_VID && port.productId == FLOTILLA_PID){
                    triggerCallback(settings.onInfo, "SYSTEM: Found dock at " + port.comName);
                    settings.portName = port.comName;
                    return;
                }
            });
            if(settings.portName === null){
                triggerCallback(settings.onError, "Unable to find Flotilla Dock");
                return;
            }
            connect();
        });
    }
    else
    {
        connect();
    }

    flotilla.firstOfType = function(module) {
        for(var x = 0; x < flotilla.modules.length; x++){
            if(flotilla.modules[x] && flotilla.modules[x].module == module){
                return flotilla.modules[x];
            }
        }
    }

    flotilla.send = function(data) {
        if(!flotilla.identified){
            triggerCallback(settings.onError, "Flotilla Dock not yet connected");
            return;
        }
        sendCmd(data);
    };

    flotilla.updateModule = function(channel, args) {
        sendCmd("s " + channel + " " + args.join(','));
    };

    return flotilla;
}

module.exports = Flotilla;
