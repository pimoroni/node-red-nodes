module.exports = function(flotilla, args, channel, module){
    return {
        speed: function(value){
            flotilla.updateModule(channel, [value]);
        }
    }
}
