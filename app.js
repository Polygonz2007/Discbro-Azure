
///  CONFIG  ///
const config = {
    port: 80, // used for both websocket and app
    rate_limit: 100, // minimum time (ms) between each request per user 
    database_path: "./src/discbro.db"
}

///  Prerequisites and tests  ///
require('dotenv').config()
const fs = require("fs");

// Check if database is present, if not, create one (.gitignore)


///  IMPORT  ///
const format = require("./src/format.js");
const database = require("./src/database.js");
const account = require("./src/account.js");
const page = require("./src/page.js");
const websocket = require("./src/websocket.js");

(async () => {
    await database.connect();
    //await database.setup(); // first time
    //await database.erase();
})();

///  SETUP  ///
// Express + routing
const express = require("express");
const session = require("express-session");
const path = require("path");

const session_parser = session({
    secret: process.env.session_secret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // If using HTTPS, set to true
});

const app = express();
app.set('trust proxy', true);

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // To parse urlencoded parameters
app.use(session_parser);

app.all("/app/*", account.check_login); // Make sure no gets or posts happen without being logged in

// Get
app.get("/app/user/:username", page.profile); 
//app.get("/app", page.app);

app.get("/api/get-theme", (req, res) => {
    res.send(JSON.stringify({"theme": "dark"}));
})

// Post
app.post("/login", account.login); // Allow users to log in, check if the credentials are correct and if they are update session
app.post("/create-account", account.create_account);

global.public_path = path.join(__dirname, "public");

// EJS
app.set('views', path.join(global.public_path, "app"));
app.set('view engine','ejs');

// HTTP
const http = require("http");
const server = http.createServer(app);
format.log("server", `HTTP server created.`);

// WebSockets
const WebSocket = require('ws');
global.wss = new WebSocket.Server({ noServer: true });
format.log("server", `WebSocket server created.`);

server.on('upgrade', function (request, socket, head) {
    socket.on('error', console.error);

    session_parser(request, {}, () => {
        if (!request.session.user_id) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
    
        socket.removeListener('error', console.error);
    
        wss.handleUpgrade(request, socket, head, function (ws) {
            wss.emit('connection', ws, request);
        });
    });
});

wss.on('connection', (ws, req) => {
    req.session.last_time = Date.now();

    ws.on('message', async (data, isBinary) => {
        // Translate
        data = isBinary ? data : data.toString();
        data = JSON.parse(data);

        // Rate limit
        // Doesnt really work, but, good enough for now.
        // Make counter system instead (available requests vs. completed requests, +1 av. every someting)
        const diff = Date.now() - req.session.last_time;
        if (diff < config.rate_limit)
            await delay(config.rate_limit - diff);

        req.session.last_time = Date.now();

        // Functions
        const type = data.type;
        switch (type) {
            case "send_message": websocket.send_message(data, req, ws); return;

            case "get_chunk": websocket.get_chunk(data, req, ws); return;
            case "get_channels": websocket.get_channels(data, req, ws); return;
            case "get_channel": websocket.get_channel(data, req, ws); return;
        }
    });

    ws.on('close', () => {
        // Handle connection close
    });
});

// Not found page
app.use("*", (req, res) => {
    if (!fs.existsSync(path.join(global.public_path, req.baseUrl)))
        res.sendFile(path.join(global.public_path, "/util/not-found.html"));
    else
        req.next();
});

// Start server
app.use(express.static(global.public_path));
server.listen(config.port, () => {
    format.log("server", `Server running on 127.0.0.1:${config.port}.`);
});

// move to different file
const delay = ms => new Promise(res => setTimeout(res, ms));