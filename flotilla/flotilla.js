"use strict";

var assign = require('object.assign').getPolyfill();
var SerialPort = require("serialport");

var Flotilla = function(settings){
    var flotilla = this;

    // USB VID/PID for Flotilla Dock
    var FLOTILLA_VID = "0x16d0";
    var FLOTILLA_PID = "0x08c3";

    var moduleHandlers = {
        /* A collection of handler functions to turn the positional,
         * string arguments from each input module into friendly values
         *
         */
        'colour': function(args){
            var red = parseInt(args[0]);
            var green = parseInt(args[1]);
            var blue = parseInt(args[2]);
            var clear = parseInt(args[3]);
            return {
                red: Math.round((red/clear) * 255),
                green: Math.round((green/clear) * 255),
                blue: Math.round((blue/clear) * 255),
                clear: clear
            }
        },
        'motion': function(args){
            return {
                accelerometer: {
                    x: parseInt(args[0]),
                    y: parseInt(args[1]),
                    z: parseInt(args[2]),
                },
                magnetometer: {
                    x: parseInt(args[3]),
                    y: parseInt(args[4]),
                    z: parseInt(args[5]),
                }
            }
        },
        'light': function(args){
            return {
                visible: parseInt(args[0]),
                ir: parseInt(args[1]),
                lux: parseInt(args[2])
            }
        },
        'dial': function(args){return {position: parseInt(args[0])}},
        'slider': function(args){return {position: parseInt(args[0])}},
        'joystick': function(args){return {x: parseInt(args[1]), y: parseInt(args[2]), button: parseInt(args[0])}},
        'weather': function(args){
            var temperature = parseInt(args[0]) / 100;
            var pressure = parseInt(args[1]) / 1000;
            return {temperature: temperature, pressure: pressure}
        },
        // Outputs
        'motor': function(args, channel, module){
            return {
                speed: function(value){
                    flotilla.updateModule(channel, [value]);
                }
            }
        },
        /*     128
         *     --
         *  4 |  | 64
         *  2  --
         *  8 |  | 32
         *     --  . 1
         *     16
         */
        'number': function(args, channel, module){
            var numberFont = [
                 2, // -
                 0, // .
                 64+8, // /
                 252,//0b11111100, 0
                 96, //0b01100000, 1
                 218,//0b11011010, 2
                 242,//0b11110010, 3
                 102,//0b01100110, 4
                 182,//0b10110110, 5
                 190,//0b10111110, 6
                 224,//0b11100000, 7
                 254,//0b11111110, 8
                 230, //0b11100110 9
                 0,   // :
                 0,   // ;
                 0,   // <
                 0,   // =
                 0,   // >
                 0,   // ?
                 0,   // @
                 0,   // A
                 0,   // B
                 16+8+2,       // C
                 128+64+32+16+8+4, // D
                 128+16+8+4+2,     // E
                 128+8+4+2,        // F
            ];

            function stringToDisplay(str) {
                if(typeof str === "number") str = str.toString();

                var realChars = 0;
                var display = [0,0,0,0,0,0,0];

                display[4] = 0; // Clear colon
                display[5] = 0; // Clear apostrophe
                display[6] = 128;

                for(var x = 0; x<str.length; x++){
                    var ord = str.charCodeAt(x) - 45;

                    if(ord == 13 && realChars == 2){ // Special case for :
                        display[4] = 1;
                    }
                    else if(ord == -13){ // Special case for space
                        display[realChars] = 0;
                        realChars++;
                    }
                    else if(ord == -6 && realChars == 3){ // Special case for ' mapped to apostrophe
                        display[5] = 1;
                    }
                    else if(ord == 1 && realChars > 0){ // Special case for .
                        display[realChars-1] |= 1;
                    }
                    else if(ord >= 0 && ord < 45+numberFont.length){
                        display[realChars] = numberFont[ord];
                        realChars++;
                    }

                    if(realChars == 4) break;
                }

                return display;
            };
            
            function update(str) {
                var display = stringToDisplay(str);
                flotilla.updateModule(channel, display);
            }

            return {
                time: function(d){
                    if(!(d instanceof Date)) {
                        return;
                    }
                    var dparts = d.toISOString().split(/-|T|:|\./);
                    var colon = parseInt(dparts[5]) % 2 ? ":" : ""; // Alternates between 1 and 0
                    var dstring = dparts[3] + colon + dparts[4]; // HHMM
                    update(dstring);
                },
                temperature: function(temp){
                    if(typeof temp !== "number") {
                        return;
                    }
                    temp = temp.toFixed(1);
                    if(temp.length < 3) temp = " " + temp;

                    update(temp + "'C");
                },
                number: function(number, decimals, alignRight, padding){
                    /* Display a number:
                     * - from 0 to 9999
                     * - from 0 to 999.9
                     * - from 0 to 99.99
                     * - from 0 to 9.999
                     */
                    if(typeof number !== "number") {
                        return;
                    }

                    var max = 9999;

                    decimals = decimals || 0;
                    if(decimals > 3) decimals = 3;
                    
                    padding = padding || " ";
                    if([':','.','\''].indexOf(padding) > -1 || padding.length == 0) padding = "";

                    if(number < 0) max = 999;

                    if(number > max / Math.pow(10,decimals)){
                        number = max / Math.pow(10,decimals);
                    }
                    number = number.toFixed(decimals);

                    if(alignRight){
                        while(number.replace(/\:|\.|\'/,'').length < 4){
                            number = padding + number
                        }
                    }

                    update(number)
                }
            }
        }
    }

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
            return moduleHandlers[module](args, channel, module);
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
