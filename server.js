var http = require('http');
var fs = require('fs');
var url = require('url');
var WebSocketServer = require('ws').Server; //provides web sockets
var ecStatic = require('ecstatic');  //provides static file server service

var counter = 1000;

var ROOT_DIR = 'html';

var playerNum = 0;

var players = {};

var MIME_TYPES = {
    'css': 'text/css',
    'gif': 'image/gif',
    'htm': 'text/html',
    'html': 'text/html',
    'ico': 'image/x-icon',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'js': 'text/javascript', //should really be application/javascript
    'json': 'application/json',
    'png': 'image/png',
    'txt': 'text/plain'
};

var get_mime = (filename) => {
    var ext, type;
    for (ext in MIME_TYPES) {
        type = MIME_TYPES[ext];
        if (filename.indexOf(ext, filename.length - ext.length) !== -1) {
            return type;
        }
    }
    return MIME_TYPES['txt'];
};

var server = http.createServer((request, response) => {
    var urlObj = url.parse(request.url, true, false)
    console.log('\n============================');
    console.log("PATHNAME: " + urlObj.pathname);
    console.log("REQUEST: " + ROOT_DIR + urlObj.pathname);
    console.log("METHOD: " + request.method);

    var receivedData = '';


    request.on('data', chunk => {
      receivedData += chunk;
    }).on('end', () => {
        console.log('received data: ', receivedData);
        console.log('type: ', typeof receivedData);

        if(request.method == "POST") {
          var dataObj = JSON.parse(receivedData);
          console.log('received data object: ', dataObj);
          console.log('type: ', typeof dataObj);
          console.log("USER REQUEST: " + dataObj.text );

          var returnObj = {};
          returnObj = dataObj;

          response.writeHead(200, {'Content-Type': MIME_TYPES['json']});
          response.end(JSON.stringify(returnObj)); //send just the JSON object
        }

        if(request.method == "GET"){
          var filePath = ROOT_DIR + urlObj.pathname;
          if(urlObj.pathname === '/') filePath = ROOT_DIR + '/index.html';

          fs.readFile(filePath, (err, data) => {
            if(err){
              console.log('ERROR: ' + JSON.stringify(err));
              response.writeHead(404);
              response.end(JSON.stringify(err));
              return;
            }

          response.writeHead(200, {'Content-Type': get_mime(filePath)});
          response.end(data);
		  });
		}
    });
}).listen(3000);

var wss = new WebSocketServer({server: server});
wss.on('connection', function(ws) { //ONCE A SOCKET HAS ESTABLISHED A CONNECTION BEGIN
	console.log('Client connected');
	ws.id = playerNum;
	playerNum++;

  ws.on('close', function close() { //REMOVE A PLAYER ONCE THEY'VE DISCONNECTED
    console.log("Player " + ws.id + " has diconnected");
    delete players[ws.id];
    playerNum--;
  });

	ws.on('message', function(msg) { //RECEIVE, UPDATE, AND SEND ALL CURRENT USERS POSITIONS
		var newMsg = JSON.parse(msg);
		var newPlayer = newMsg;
    if(newPlayer.playerName == 0) {

    }else {
      if(!(newPlayer in players)){
  			players[ws.id] = newPlayer;
  		}
    }

		wss.clients.forEach(function(client) {
			client.send(JSON.stringify(players));
		});
	});
});

console.log('Server Running at http://127.0.0.1:3000  CNTL-C to quit');
