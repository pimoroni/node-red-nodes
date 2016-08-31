var Flotilla = require("./flotilla");

var f = new Flotilla({
    onOpen: function(flotilla){
        console.log("Flotilla Connected! Version:" + flotilla.dockVersion);
    },
    onUpdate: function(flotilla, args){
        console.log("UPDATE!", args);
        
        var motor = flotilla.firstOfType("motor");

        if(args.module === "dial" && motor){
            motor.speed(Math.round((args.position - 512) * 0.12));
        }
    },
    onLost: function(flotilla, args){
        console.log("LOST! :(", args);
    },
    onFound: function(flotilla, args){
        console.log("FOUND! :D", args);
    },
    onInfo: function(flotilla, message){
        console.log("INFO: " + message);
    },
    onError: function(flotilla, message){
        console.log("ERROR: " + message);
    }
});

console.log(f);
