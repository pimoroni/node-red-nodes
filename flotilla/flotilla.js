"use strict";

var assign = require('object.assign').getPolyfill();
var SerialPort = require("serialport");

var Flotilla = function(settings){
    var FLOTILLA_VID = "0x16d0";
    var FLOTILLA_PID = "0x08c3";

    var defaultSettings = {
        portName: null
    }

    settings = assign({}, defaultSettings, settings);

    var identifyTimeout = null;

    var dockVersion = null;
    var dockSerial = null;
    var dockUser = null;
    var dockName = null;

    var identified = false;

    var port = null;

    var triggerCallback = function(callback, args){
        if(typeof callback === "function") callback(args);
    }

    var connect = function() {
        port = new SerialPort(settings.portName, {
            baudRate: 115200,
            parser: SerialPort.parsers.readline("\n")
        });

        port.on("open", function(error) {
            sendCmd("v");

            identifyTimeout = setTimeout(function() {
                console.log("SYSTEM: ERROR: Failed to identify Flotilla dock");
                triggerCallback(settings.onError, "Failed to identify Flotilla Dock");
                port.close();
            }, 4000);
        });

        port.on("data", function(data) {
            console.log("GOT DATA:" + data);
            if(data[0] == "#"){
                handleInfo(data.substring(2));
                return;
            }
            if(identified) {
                handleCommand(data)
            };
        });

        port.on("error", function(error) {});

        port.on("disconnect", function() {});

        port.on("close", function() {
            clearTimeout(identifyTimeout);
        });
    }

    var sendCmd = function(cmd) {
        port.write(cmd + "\r");
    }

    var validateIdentity = function(){
        if([dockVersion, dockSerial, dockUser, dockName].indexOf(null) == -1){
            clearTimeout(identifyTimeout);
            identified = true;
            //console.log("SYSTEM: INFO: Dock Identity Verified");
            sendCmd('e');
            triggerCallback(settings.onOpen);
        }
    }

    var handleInfo = function(data) {
        //console.log("INFO: " + data);

        if(data.substring(0,8) === "Version:"){
            dockVersion = parseFloat(data.substring(9));
            validateIdentity();
            return;
        }

        if(data.substring(0,7) === "Serial:"){
            dockSerial = data.substring(8);
            validateIdentity();
            return;
        }

        if(data.substring(0,5) === "User:"){
            dockUser = data.substring(6);
            validateIdentity();
            return;
        }

        if(data.substring(0,5) === "Dock:"){
            dockName = data.substring(6);
            validateIdentity();
            return;
        }
    }

    var handleCommand = function(data) {
        var command = data[0];
        data = data.substring(2);
        switch(command){
            case 'u': // Module update
                console.log("UPDATE: " + data);
                triggerCallback(settings.onUpdate);
                break;
            case 'c': // Module disconnected
                console.log("FOUND: " + data);
                triggerCallback(settings.onFound);
                break;
            case 'd': // Module connected
                console.log("LOST: " + data);
                triggerCallback(settings.onLost);
                break;
        }
    }

    if(settings.portName === null){
        SerialPort.list(function(err, ports) {
            ports.forEach(function(port, index){
                /*
                    comName, manufacturer, serialNumber, pnpId, vendorId, productId
                */
                //console.log("Found port: " + port.comName);
                if(settings.portName === null && port.vendorId == FLOTILLA_VID && port.productId == FLOTILLA_PID){
                    //console.log("SYSTEM: INFO: Found dock at " + port.comName);
                    settings.portName = port.comName;
                    return;
                }
            });
            if(settings.portName === null){
                //console.log("SYSTEM: ERROR: Unable to find Flotilla Dock");
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

    return;
}

module.exports = Flotilla;
