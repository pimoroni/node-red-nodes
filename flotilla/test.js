var Flotilla = require("./flotilla");

var f = new Flotilla({
    onOpen: function(){
        console.log("Flotilla Connected!");
    },
    onUpdate: function(channel, data){
        console.log("UPDATE!");
    },
    onLost: function(channel, module){
        console.log("LOST! :(");
    },
    onFound: function(channel, module){
        console.log("FOUND! :D");
    }
});
