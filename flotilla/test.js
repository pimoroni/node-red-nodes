var Flotilla = require("./flotilla");

var f = new Flotilla({
    onOpen: function(flotilla){
        console.log("Flotilla Connected! Version:" + flotilla.dockVersion);
    },
    onUpdate: function(flotilla, args){
        console.log("UPDATE!", args);
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
