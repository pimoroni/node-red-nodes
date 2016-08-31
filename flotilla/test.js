var Flotilla = require("./flotilla");

var f = new Flotilla({
    onOpen: function(flotilla){
        console.log("Flotilla Connected! Version:" + flotilla.dockVersion);
    },
    onUpdate: function(flotilla, args){
        console.log("UPDATE!", args);
        
        var motor = flotilla.firstOfType("motor");
        var number = flotilla.firstOfType("number");

        if(args.module === "dial" && motor){
            motor.speed(Math.round((args.position - 512) * 0.12));
        }

        if(args.module === "weather" && number){
            //number.temperature(args.temperature);
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

var count = 0;

setInterval(function(){
    var number = f.firstOfType("number");

    if(!number) return;

    number.number(Math.sin(count),2,true," ");

    count += 0.1;
}, 100);

/*
setInterval(function(){

    var number = f.firstOfType("number");

    if(!number) return;

    number.time(new Date());

}, 100);
*/
