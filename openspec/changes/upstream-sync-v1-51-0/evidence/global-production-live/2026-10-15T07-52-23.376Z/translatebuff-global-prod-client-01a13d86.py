import http.client
import json
import socket
import sys

class UnixConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(55)
        self.sock.connect(sys.argv[1])

connection = UnixConnection('localhost', timeout=55)
code = sys.stdin.read()
payload = {'action':'close'} if code.strip() == '__CLOSE__' else {'code':code}
connection.request('POST','/',json.dumps(payload),{'content-type':'application/json'})
response=connection.getresponse()
print(response.read().decode())
