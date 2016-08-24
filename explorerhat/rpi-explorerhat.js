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

    if (!fs.existsSync("/usr/share/doc/python-rpi.gpio")) {
        util.log("[rpi-explorerhat] Info : Can't find RPi.GPIO library.");
        throw "Warning : Can't find RPi.GPIO python library.";
    }

    if ( !(1 & parseInt((fs.statSync(hatCommand).mode & parseInt("777", 8)).toString(8)[0]) )) {
        throw "Error: "+RED._("node-red:rpi-explorerhat.errors.mustbeexecutable");
    }

    process.env.PYTHONBUFFERED = 1;

        var HAT = (function(){

            var hat = null;
            var onclose = null;
            var reconnectTimer = null;
            var disconnectTimeout = null;
            var users = [];

            var connect = function() {
                hat = spawn(hatCommand);

                hat.stdout.on('data', function(data) {
                    data = data.toString().trim();
                    if (data.length == 0) return;

                    users.forEach(function(node){
                        if (data.substring(0,6) == "analog" && node.send_analog){
                            node.send({topic:"explorerhat/analog", payload:data});
                        }
                        if (data.substring(0,5) == "touch" && node.send_touch){
                            node.send({topic:"explorerhat/touch", payload:data});
                        }
                        if (data.substring(0,5) == "input" && node.send_input){
                            node.send({topic:"explorerhat/input", payload:data});
                        }

                        node.status({fill:"green",shape:"dot",text:"ok"});
                    });


                    //if (RED.settings.verbose) RED.log.info("Got Data: " + data + " :");

                });

                hat.stderr.on('data', function(data) {
                    if (RED.settings.verbose) { RED.log.warn("Process Error: "+data+" :"); }
                    hat.stdin.write("stop");
                    hat.kill("SIGKILL");
                });

                hat.on('close', function(code) {
                    if (RED.settings.verbose) { RED.log.info("Process Exit: "+code+" :"); }
                    hat = null;
                    users.forEach(function(node){
                        node.status({fill:"red",shape:"circle",text:""});
                    });
                    if (onclose) {
                        onclose();
                        onclose = null;

                        if (RED.settings.verbose) {RED.log.info("Process Complete"); }
                    } else if (!reconnectTimer){
                        reconnectTimer = setTimeout(function(){
                            connect();
                        },5000);
                    }
                });

            }

            var disconnect = function(){
                disconnectTimeout = setTimeout(function(){
                    if (hat !== null) {
                        hat.stdin.write("stop");
                        hat.kill("SIGKILL");
                    }
                    if (reconnectTimer) {
                        clearTimeout(reconnedTimer);
                    }
                },3000);
            }

            return {
                open: function(node){
                    if (disconnectTimeout) clearTimeout(disconnectTimeout);
                    if (!hat) connect();

                    if(!reconnectTimer){
                        node.status({fill:"green",shape:"dot",text:"Connected"});
                    }

                    if(RED.settings.verbose) { RED.log.info("Adding node, touch: " + (node.send_touch ? "yes" : "no") + ", input: " + (node.send_input ? "yes" : "no") + ", analog:" + (node.send_analog ? "yes" : "no")); }

                    users.push(node);
                },
                close: function(node,done){
                    users.splice(users.indexOf(node),1);
                    
                    if(RED.settings.verbose) { RED.log.info("Removing node, count: " + users.length.toString()); }

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

        this.send_touch = config.touch || true;
        this.send_input = config.input || true;
        this.send_analog = config.analog || true;

        var node = this;

        node.status({fill:"red",shape:"ring",text:"Disconnected"});

        if(RED.settings.verbose) { RED.log.info("Initialising node"); }

        HAT.open(this);

        node.on("close", function(done) {
            var fini = function(){
                done();
                if (RED.settings.verbose) { RED.log.info("Done Called"); }
            }

            HAT.close(this);
            fini();
            if (RED.settings.verbose) { RED.log.info("Closing node"); }
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
