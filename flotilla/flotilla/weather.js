module.exports = function(flotilla, args){
    var temperature = parseInt(args[0]) / 100;
    var pressure = parseInt(args[1]) / 1000;
    return {temperature: temperature, pressure: pressure}
}
