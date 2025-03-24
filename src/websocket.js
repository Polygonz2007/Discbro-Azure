
const database = require("./database.js");
const format = require("./format.js");

///  FUNCTIONS  ///
// Message sent by client
async function send_message(data, req) {
    console.log(data);

    // Get and check author of
    const user = await database.get_user_info(req.session.user_id);
    data.author_id = user.id;
    if (!data.author_id)
        return false;

    // Sanetize
    //data.content = format.escape_html(data.content);

    // Store in database
    const message_id = await database.new_message(data.channel_id, data.author_id, data.content);
    if (!message_id)
        return;

    // Share new message with all connected clients (IN THIS CHANNEL) (OH NO)
    const messages = await database.format_messages(await database.get_message(message_id), req.session.user_id);
    global.wss.clients.forEach((client) => {
        client.send(JSON.stringify({ "type": "message", "channel_id": data.channel_id, "dir": true, "messages": messages }));
    });
}

// Get a chunk of messages
async function get_chunk(data, req, ws) {
    // Get messages, if there are none tell client we are up to date, if not send the messages
    let messages = await database.get_message_chunk(data.channel_id, data.dir, data.last_id, data.chunk_s);
    if (!messages)
        messages = [];
    else
        messages = await database.format_messages(messages, req.session.user_id);

    ws.send(JSON.stringify({
        "type": "chunk",
        "channel_id": data.channel_id,
        "dir": data.dir,
        "messages": messages,
        "up_to_date": messages.length == 0 || data.last_id == null
    }));
}

async function get_channels(data, req, ws) {
    const channels = await database.get_channels();
    
    ws.send(JSON.stringify({
        "type": "channels",
        "channels": channels
    }));
}

async function get_channel(data, req, ws) {
    const channel = await database.get_channels();

    ws.send(JSON.stringify({
        "type": "channel",
        "id": channel.id,
        "name": channel.name
    }));
}

module.exports = {
    send_message,
    get_chunk,

    get_channels,
    get_channel
}