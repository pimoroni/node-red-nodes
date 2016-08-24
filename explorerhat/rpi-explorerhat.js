/**
 * Copyright 2016 Pimoroni Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    var fs = require("fs");
    var spawn = require("child_process").spawn;

    var hatCommand = __dirname+'/explorerlink';


    function REDvWarn(message){
        if( RED.settings.verbose ) RED.log.warn(message);
    }
    
    function REDvInfo(message){
        if( RED.settings.verbose ) RED.log.info(message);
    }

    if (!fs.existsSync("/usr/share/doc/python-rpi.gpio")) {
        REDvWarn("[rpi-explorerhat] Info : Can't find RPi.GPIO library.");
        throw "Warning : Can't find RPi.GPIO python library.";
    }

    if ( !(1 & parseInt((fs.statSync(hatCommand).mode & parseInt("777", 8)).toString(8)[0]) )) {
        throw "Error: "+RED._("node-red:rpi-explorerhat.errors.mustbeexecutable");
    }

    process.env.PYTHONBUFFERED = 1;

    var HAT = (function(){

        var hat = null;
        var allowExit = false;
        var reconnectTimer = null;
        var disconnectTimeout = null;
        var users = [];

        var connect = function() {
            if(reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = null;
            allowExit = false;

            hat = spawn(hatCommand);

            users.forEach(function(node){
                node.status({fill:"green",shape:"dot",text:"Connected"});
            });

            function handleMessage(data){
                data = data.trim();
                if (data.length == 0) return;

                users.forEach(function(node){
                    if (data.substring(0,6) == "analog" && node.send_analog){
                        var channel = data.substring(7,8);
                        data = data.split(":")[1];

                        node.send({topic:"explorerhat/analog." + channel, payload:Number(data)});
                    }
                    if (data.substring(0,5) == "touch" && node.send_touch){
                        var channel = data.substring(6,7);
                        data = data.split(":")[1];

                        node.send({topic:"explorerhat/touch." + channel, payload:Number(data)});
                    }
                    if (data.substring(0,5) == "input" && node.send_input){
                        var channel = data.substring(6,7);
                        data = data.split(":")[1];

                        node.send({topic:"explorerhat/input." + channel, payload:Number(data)});
                    }
                });


            }

            hat.stdout.on('data', function(data) {
                data = data.toString().trim();
                if (data.length == 0) return;

                var messages = data.split("\n");
                messages.forEach(function(message){
                    handleMessage(message);
                });
                //REDvInfo("Got Data: " + data + " :");

            });

            hat.stderr.on('data', function(data) {
                REDvWarn("Process Error: "+data+" :");

                hat.stdin.write("stop");
                hat.kill("SIGKILL");
            });

            hat.on('close', function(code) {
                REDvWarn("Process Exit: "+code+" :");

                hat = null;
                users.forEach(function(node){
                    node.status({fill:"red",shape:"circle",text:"Disconnected"});
                });

                if (!allowExit && !reconnectTimer){
                    REDvInfo("Attempting Reconnect");

                    reconnectTimer = setTimeout(function(){
                        connect();
                    },5000);
                }

            });

        }

        var disconnect = function(){
            disconnectTimeout = setTimeout(function(){
                if (hat !== null) {
                    allowExit = true;
                    hat.stdin.write("stop");
                    hat.kill("SIGKILL");
                }
            },3000);
            if (reconnectTimer) {
                clearTimeout(reconnedTimer);
            }

        }

        return {
            open: function(node){
                if (disconnectTimeout) clearTimeout(disconnectTimeout);
                if (!hat) connect();

                if(!reconnectTimer){
                    node.status({fill:"green",shape:"dot",text:"Connected"});
                }

                REDvInfo("Adding node, touch: " + (node.send_touch ? "yes" : "no") + ", input: " + (node.send_input ? "yes" : "no") + ", analog:" + (node.send_analog ? "yes" : "no"));

                users.push(node);
            },
            close: function(node,done){
                users.splice(users.indexOf(node),1);
                
                REDvInfo("Removing node, count: " + users.length.toString());

                if(users.length === 0){
                    disconnect();
                }
            },
            send: function(msg){
                if(hat) hat.stdin.write(msg+"\n");
            }
        }


    })();


    function ExplorerHATIn(config) {
        RED.nodes.createNode(this,config);

        this.send_touch = config.touch;
        this.send_input = config.input;
        this.send_analog = config.analog;

        var node = this;

        node.status({fill:"red",shape:"ring",text:"Disconnected"});

        REDvInfo("Initialising node");

        HAT.open(this);

        node.on("close", function(done) {
            HAT.close(this);
            done();
            REDvInfo("Node Closed");
        });
    }

    RED.nodes.registerType("rpi-explorerhat in",ExplorerHATIn);


    function ExplorerHATOut(config) {
        RED.nodes.createNode(this,config);
 
        var node = this;

        node.on("close", function(done) {
            done();
        });
    }
    RED.nodes.registerType("rpi-explorerhat out",ExplorerHATOut);
}
