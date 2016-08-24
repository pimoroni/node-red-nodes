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
                else:
                    break

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

while running:
    cmd = stdin.readline(0.1)
    if cmd is not None:
        if cmd == "stop":
            stdin.stop()
            running = False

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
