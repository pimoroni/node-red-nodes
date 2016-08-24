from subprocess import Popen, PIPE, STDOUT
import time

p = Popen(['./explorerlink.py'], stdout=PIPE, stdin=PIPE, stderr=PIPE)

p.stdin.write("stop")
p.stdin.flush()

print(p.communicate())

time.sleep(1)
#stdout_data = p.communicate(input='test\n')[0]
