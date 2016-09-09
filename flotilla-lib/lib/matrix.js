module.exports = function(flotilla, args, channel, module){
    var buffer = [
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        128
    ];

    function update(){
        flotilla.updateModule(channel, buffer);        
    }

    function set_pixel(x, y, value){
        if(value){
            buffer[7-x] |= (1 << y);
        }
        else
        {
            buffer[7-x] &= ~(1 << y); 
        }
    }

    function set_brightness(value){
        buffer[8] = brightness & 0xff;
    }

    return {
        set_pixel: set_pixel,
        show: update
    };
}
