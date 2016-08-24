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
            Collect lines from 'stream' and put them in 'quque'.
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


def emit(message):
    sys.stdout.write(message)
    sys.stdout.flush()

running = True

stdin = NonBlockingStreamReader(sys.stdin)

while running:
    cmd = stdin.readline(0.1)
    if cmd is not None:
        if cmd == "stop":
            stdin.stop()
            running = False


    emit("analog.1:{}".format(explorerhat.analog.one.read()))
    emit("analog.2:{}".format(explorerhat.analog.two.read()))
    emit("analog.3:{}".format(explorerhat.analog.three.read()))
    emit("analog.4:{}".format(explorerhat.analog.four.read()))

    time.sleep(0.99)


sys.stdout.write("Googbye")
sys.stdout.flush()
