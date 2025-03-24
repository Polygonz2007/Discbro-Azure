
// This module is responsible for handling database interaction by the app, in a safe and proper way.

const fs = require("fs");
const format = require("./format.js");

console.log(process.env.db_user);

// Configure the connection string
const config = {
  user: process.env.db_user, // Azure SQL Database username
  password: process.env.db_password, // Azure SQL Database password
  server: process.env.db_url, // Azure SQL Database server name
  database: process.env.db_name, // Your database name
  options: {
    encrypt: true, // Encrypt the connection for security (important for Azure)
    trustServerCertificate: false // Ensure the server certificate is trusted
  }
};

const sql = require('mssql');
let pool;

process.on('exit', (code) => {
    if (pool)
        pool.close();
});

const bcrypt = require("bcrypt");
const salt_rounds = 10;

// Setup the database
async function connect() {
    const pool_promise = new sql.ConnectionPool(config)
        .connect()
        .then(pool => {
            return pool;
        });

    pool = await pool_promise;

    console.log("Connected to database")
}

async function setup() {
    const setup_file = "./documentation/database.sql";
    const setup_string = fs.readFileSync(setup_file).toString();

    const queries = setup_string.split(";");

    for (let i = 0; i < queries.length - 1; i++) { // everything except last empty query
        await pool.query(queries[i]);
    }

    console.log("Database setup complete")

    return 0;
}

async function erase() {
    await pool.query(`
        -- Disable all foreign key constraints by dropping them
        DECLARE @sql NVARCHAR(MAX) = N'';

        -- Generate the DROP CONSTRAINT statements for all foreign keys
        SELECT @sql += 'ALTER TABLE ' + QUOTENAME(OBJECT_NAME(parent_object_id)) + ' DROP CONSTRAINT ' + QUOTENAME(name) + ';' + CHAR(13)
        FROM sys.foreign_keys;

        -- Execute the DROP CONSTRAINT statements
        EXEC sp_executesql @sql;

        -- Now, generate and execute the DROP TABLE statements for all user tables
        SET @sql = N'';
        SELECT @sql += 'DROP TABLE ' + QUOTENAME(table_name) + ';' + CHAR(13)
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE';

        -- Execute the DROP TABLE statements
        EXEC sp_executesql @sql;
    `);

    console.log("Database erased.");

    return 0;
}

// Adds a user to the database, with checks if it is a valid name and stuff
async function new_user(username, display_name, password) {
    // Hash password
    const hash = bcrypt.hashSync(password, salt_rounds);

    // Insert new user
    let user = await pool.request()
        .input("username", sql.NVarChar, username)
        .input("display_name", sql.NVarChar, display_name)
        .input("password", sql.NVarChar, hash)
        .query("INSERT INTO users (username, display_name, password, profile_picture) VALUES (@username, @display_name, @password, '/data/profile-pictures/default.png')");

    if (user.length == 0)
        return "Database error. Please try again.";

    return true;
}

async function new_group() {
    return 0;
}

async function new_message(channel_id, author_id, content) {
    if (content.length > 2048)
        return false;

    let result = await pool.request()
        .input("channel_id", sql.BigInt, channel_id)
        .input("author_id", sql.BigInt, author_id)
        .input("content", sql.NVarChar, content)
        .query("INSERT INTO messages (channel_id, author_id, content) OUTPUT INSERTED.id VALUES (@channel_id, @author_id, @content)");

    console.log(result)

    if (result.rowsAffected[0] == 0)
        return false;

    return result.recordset[0].id;
}

async function check_username(username) {
    // If a user is found returns the users id, if not returns -1
    let user = await pool.request()
        .input("username", sql.NVarChar, username)
        .query("SELECT * FROM users WHERE username = @username");

    user = user.recordset;

    console.log(user)

    if (user[0])
        return user[0].id;

    return false;
}

async function get_user_info(id) {
    if (id == 0)
        return false;

    // Check if another user already has username
    let user = await pool.request()
        .input("id", sql.BigInt, id)
        .query("SELECT * FROM users WHERE id = @id");

    user = user.recordset;

    if (user[0])
        return user[0];

    return false;
}

async function get_group_members() {
    return true;
}

// Get all messages in a channel
async function get_messages(channel_id) {
    let result = await pool.request()
        .input("channel_id", sql.BigInt, channel_id)
        .query("SELECT * FROM messages WHERE channel_id = @channel_id ORDER BY id DESC");

    result = result.recordset;

    if (result.length != 0)
        return result;

    return false;
}

// Gets a chunk of messages, of size chunk_s
// If dir is false, it reads messages BEFORE lastid
// Else, if dir is true, it reads messages AFTER lastid
// If no lastid is specified, it gets the newest chunk
async function get_message_chunk(channel_id, dir = false, last_id, chunk_s) {
    // If empty, get newest
    if (last_id == null) {
        let result = await pool.request()
        .input("channel_id", sql.BigInt, channel_id)
        .input("chunk_s", sql.BigInt, chunk_s)
        .query(`SELECT TOP (@chunk_s) * FROM messages WHERE channel_id = @channel_id ORDER BY id DESC`);

        result = result.recordset;

        if (result.length == 0) // If empty, return error
            return false;

        return result.reverse();
    }

    // We need to find the chunk we are looking for
    let result = await pool.request()
    .input("last_id", sql.BigInt, last_id)
    .input("channel_id", sql.BigInt, channel_id)
    .input("chunk_s", sql.BigInt, chunk_s)
    .query(`SELECT TOP (@chunk_s) * FROM messages WHERE id ${dir ? ">" : "<"} @last_id AND channel_id = @channel_id ORDER BY id ${dir ? "ASC" : "DESC"}`);

    result = result.recordset;
    
    if (result.length == 0) // If empty, return error
        return false;

    // Flip order of chunk when reading old messages
    if (!dir)
        result.reverse();

    return result;
}

async function get_message(message_id) {
    // Curently get all messages in a channel
    let result = await pool.request()
    .input("message_id", sql.BigInt, message_id)
    .query("SELECT * FROM messages WHERE id = @message_id");

    result = result.recordset;
    console.log(result);

    if (result.length != 0)
        return result;

    return false;
}

async function format_messages(messages, user_id) {
    if (!messages)
        return false;

    let buffer = {};
    const user = get_user_info(user_id);

    for (const message of messages) {
        const author_id = message.author_id;

        if (buffer[author_id]) {
            // Use buffered data
            message.author = buffer[author_id];
        } else {
            // We need to find in the database
            const user = await get_user_info(author_id);
            const author = { "username": user.username, "display_name": user.display_name, "id": author_id };
            
            message.author = author;
            buffer[author_id] = author;
        }

        const search_str = " " + message.content + " ";
        if ((user && search_str.indexOf(` @${user.username} `) != -1) || search_str.indexOf(` @everyone `) != -1)
            message.highlight = true;

        // Add embeds and such
        message.content = format.embeds(message.content);

        // Clean up data for transmission
        delete message.author_id; // already in author
        delete message.channel_id; // already in chunk
    };

    return messages;
}

async function delete_user(username) {
    // Get user
    let user_check = await check_username(username);

    if (user_check.length == 0)
        return "Could not find user " + username + " in the database.";

    // REMOVE THEM
    let result = await pool.request()
    .input("user_id", sql.BigInt, user_check[0].id)
    .query("DELETE FROM users WHERE id = @user_id");

    if (result.rowsAffected[0] == 0)
        return "Database error. Please try again."

    return true;
}

async function get_channels(server_id, user_id) {
    // For now just returns all channels
    // But eventually, returns all channels in a server the user has access to
    let channels = await pool.request()
        .query("SELECT id, name FROM channels");

    channels = channels.recordset;

    if (channels.length == 0)
        return false;

    return channels;
}

async function get_channel(id) {
    let channel = pool.request()
        .input("channel_id", sql.BigInt, id)
        .query("SELECT id, name, created_time FROM channels WHERE id = @channel_id");

    channel = channel.recordset;

    if (channel.length == 0)
        return false;

    return channel[0];
}

module.exports = {
    connect,
    setup,
    erase,

    new_user,
    check_username,
    get_user_info,
    delete_user,

    get_channel,
    get_channels,
    
    new_message,

    get_message,
    get_messages,
    get_message_chunk,
    format_messages
}
