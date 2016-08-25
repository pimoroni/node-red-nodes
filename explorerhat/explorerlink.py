#!/usr/bin/env python

import time
import sys
from threading import Thread, Event
from Queue import Queue, Empty

import explorerhat

class NonBlockingStreamReader:

    def __init__(self, stream):
        '''
        stream: the stream to read from.
                Usually a process' stdout or stderr.
        '''

        self._s = stream
        self._q = Queue()
        self._stop_event = Event()

        def _populateQueue(stream, queue, stop_event):
            '''
            Collect lines from 'stream' and put them in 'queue'.
            '''
            while not stop_event.is_set():
                line = stream.readline()
                if line:
                    queue.put(line)

        self._t = Thread(target = _populateQueue,
                args = (self._s, self._q, self._stop_event))
        self._t.daemon = True
        self._t.start() #start collecting lines from the stream

    def readline(self, timeout = None):
        try:
            return self._q.get(block = timeout is not None, timeout = timeout)
        except Empty:
            return None

    def stop(self):
        self._stop_event.set()


def millis():
    return int(round(time.time() * 1000))

def emit(message):
    sys.stdout.write(message + "\n")
    sys.stdout.flush()

def error(message):
    emit("ERROR: " + message)

running = True

stdin = NonBlockingStreamReader(sys.stdin)

def handle_touch(channel, event):
    emit("touch.{}:{}".format(channel,1 if event == "press" else 0))

explorerhat.touch.pressed(handle_touch)
explorerhat.touch.released(handle_touch)

pin_index = {'one':1, 'two':2, 'three':3, 'four':4}

def handle_input(pin):
    emit("input.{}:{}".format(pin_index[pin.name],pin.read()))

explorerhat.input.changed(handle_input)

last_change = [0,0,0,0]
last_value = [None,None,None,None]

def handle_analog(analog, value):
    global last_change, last_value

    if millis() - last_change[analog.channel] > 1000 or last_value[analog.channel] is None or abs(last_value[analog.channel] - value) >= 0.1:
        last_change[analog.channel] = millis()
        last_value[analog.channel] = value
        emit("analog.{}:{}".format(analog.channel,value))

explorerhat.analog.changed(handle_analog, 0.01)

light_index = ['blue','yellow','red','green']
output_index = ['one','two','three','four']

def handle_command(cmd):
    if cmd is not None:
        cmd = cmd.strip()

        if cmd.startswith("light.") and ":" in cmd:
            cmd, data = cmd.split(":")
            channel = cmd.split(".")[1]

            if channel in light_index:
                channel = light_index.index(channel)
            else:
                channel = int(channel) - 1

            if channel < 0 or channel > 3:
                error("Invalid channel: " + str(channel))
                return

            if data in ["1", "on"]:
                explorerhat.light[channel].on()
            elif data in ["0", "off"]:
                explorerhat.light[channel].off()
            else:
                error("Unhandled value: '" + data + "'")

            return

        if cmd.startswith("motor.") and ":" in cmd:
            cmd, data = cmd.split(":")
            channel = cmd.split(".")[1]

            if channel in ["one", "two"]:
                channel = ["one", "two"].index(channel)
            else:
                channel = int(channel) - 1

            if channel < 0 or channel > 1:
                error("Invalid channel: " + str(channel))
                return

            try:
                data = int(data)
            except ValueError:
                error("Invalud value: " + data)

            if data < -100 or data > 100:
                error("Invalid value: " + str(data))

            explorerhat.motor[channel].speed(data)

            return

        if cmd.startswith("output.") and ":" in cmd:
            cmd, data = cmd.split(":")
            channel = cmd.split(".")[1]

            if channel in output_index:
                channel = output_index.index(channel)
            else:
                channel = int(channel) - 1

            if channel < 0 or channel > 3:
                error("Invalid channel: " + str(channel))
                return

            if data in ["1", "on"]:
                explorerhat.output[channel].on()
            elif data in ["0", "off"]:
                explorerhat.output[channel].off()
            else:
                error("Unhandled value: " + data)
  
            return

        if cmd == "stop":
            stdin.stop()
            running = False


while running:
    cmd = stdin.readline(0.1)
    handle_command(cmd)
    #emit("analog.1:{}".format(explorerhat.analog.one.read()))
    #emit("analog.2:{}".format(explorerhat.analog.two.read()))
    #emit("analog.3:{}".format(explorerhat.analog.three.read()))
    #emit("analog.4:{}".format(explorerhat.analog.four.read()))

    #emit("input.1:{}".format(explorerhat.input.one.read()))
    #emit("input.2:{}".format(explorerhat.input.two.read()))
    #emit("input.3:{}".format(explorerhat.input.three.read()))
    #emit("input.4:{}".format(explorerhat.input.four.read()))

    time.sleep(0.001)


sys.stdout.write("Googbye")
sys.stdout.flush()
