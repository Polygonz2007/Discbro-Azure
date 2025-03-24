
const port = 2337; // port used for WebSocket
const url = `ws://${window.location.host}`;

const doc = document;
const root = doc.querySelector(":root");
const body = doc.body;
const socket = new WebSocket(url);

let app = {
	debug: false,
	channel_id: 1,

	max_chunks: 8, // Max number of chunks that can be loaded at once, configurable by user
	chunk_s: 32, // size of each chunk
	up_to_date: false, // If true, it means the newest available chunk is loaded
	at_first: false, // If true, the first chunk in this channel is loaded
	chunk_loading: false, // If true, a request is currently being handled. Do NOT make a new request while this is true

	lock_newest: true, // if true, always scrolls down when something changes

	chunk_index: 0, // incremented for each new chunk, used for unique index
	oldest_chunk: 0, // when loading a chunk backward, update this
	newest_chunk: 0, // when loading chunk forward, update this
	chunks: [
		// id: ?, messages: ..., oldest_id, newest_id, prev_id
	]
}

console.log(`Connecting on ${url}...`);

// Sending messages
let message_box = doc.querySelector("#message-box");
let message_button = doc.querySelector("#message-button");
let messages = doc.querySelector("body");

socket.addEventListener("open", (event) => {
	// Connected, set up event listener
	message_box.addEventListener("keydown", (e) => {
	if (e.key == 'Enter') {
			send_message();
		}
	});

	message_button.addEventListener("click", () => {
		send_message();
	})

	get_chunk(true); // after, because there are none yet, and we want latest messages
	socket.send(JSON.stringify({"type": "get_channels"}));

	return;
});

socket.addEventListener("message", (event) => {
	// Parse, get, and check data
	const data = JSON.parse(event.data);
	console.log(data);

	switch (data.type) {
		case "channels":
			display_channels(data.channels);
			break;
	}

	const dir = data.dir; // false: older, true: newer
	let messages = data.messages;
	if (messages.length == 0) {
		if (dir == true)
			app.up_to_date = true;
		else
			app.at_first = true;

		app.chunk_loading = false;
		return;
	}

	// We only care about current channel
	if (data.channel_id != app.channel_id)
		return;

	if (data.up_to_date)
		app.up_to_date = true;

	// Check if it is a lone message, not in a chunk
	if (data.type == "message") {
		// If up to date, we can either add to the newest chunk or make a new one if previous is full
		console.log("Up to date: " + app.up_to_date);
		if (!app.up_to_date)
			return; // In the future, notify user of new messages on top of screen

		// Format time
		messages = format_datetime(messages);

		let newest_chunk = get_chunk_by_id(app.newest_chunk);
		if (newest_chunk && newest_chunk.messages.length < app.chunk_s) {
			// Add message to newest chunk
			newest_chunk.messages.push(messages[0]);
			newest_chunk.newest_id = messages[0].id;
			refresh_chunk(app.newest_chunk, get_farthest_chunk_id(true, app.newest_chunk));

			scroll_to_bottom();
			app.chunk_loading = false;
			return;
		}

		// We have to make a new one!
		// Store previous newest chunk
		const prev_chunk = get_chunk_by_id(app.newest_chunk);
		const prev_newest_chunk_message = get_message_by_id(prev_chunk.newest_id);
		
		// Remove chunks if there are too many now
		if (app.chunks.length > app.max_chunks)
			remove_chunk(app.oldest_chunk); // because new messages always appear newest

		// Create the new chunk data, add message
		const message_id = messages[0].id;
		app.chunks.push({ "id": app.chunk_index, "messages": messages, "oldest_id": message_id, "newest_id": message_id });

		// And add it to the DOM
		add_chunk(prev_newest_chunk_message, true, app.chunk_index);
		app.newest_chunk = app.chunk_index;
		app.chunk_index++;

		scroll_to_bottom();
		app.chunk_loading = false;
		return;
	}

	console.log(`Parsing ${data.messages.length} message(s) from ${url} at ${now()}`);

	// Add to chunks
	delete data.dir;
	delete data.type;

	const pos = app.chunks.push(data) - 1;
	let chunk = app.chunks[pos];
	chunk.id = app.chunk_index;
	app.chunk_index++;

	chunk.oldest_id = Infinity;
	chunk.newest_id = 0;

	// Find oldest_id & newest_id
	for (let i = 0; i < messages.length; i++) {
		// Check id
		if (messages[i].id < chunk.oldest_id)
			chunk.oldest_id = messages[i].id;
		else if (messages[i].id > chunk.newest_id)
			chunk.newest_id = messages[i].id;
	}

	// Add formatting for time
	format_datetime(messages);

	// Previous, for combining messages by same author
	const prev_chunk = get_chunk_by_id(dir ? app.newest_chunk : -1);
	let prev;
	if (prev_chunk && prev_chunk.id != chunk.id)
		prev = get_message_by_id(prev_chunk.newest_id);

	if (prev)
		chunk.prev_id = prev.id;

	// Add chunk, and update first / last chunk
	add_chunk(prev, dir, chunk.id);

	if (dir)
		app.newest_chunk = chunk.id;
	else {
		refresh_chunk(app.oldest_chunk, chunk.id);
		app.oldest_chunk = chunk.id;
	}

	// Remove old chunk (if necessary)
	if (app.chunks.length > app.max_chunks) {
		const to_unload = dir ? app.oldest_chunk : app.newest_chunk; // opposite of scrolling direction
		remove_chunk(to_unload);
	}

	app.chunk_loading = false;
	return;
});

socket.addEventListener("close", (event) => {
	// Handle connection close
	console.warn(`Connection to WebSocket lost. [${now()}]`);

	return;
});

function send_message() {
	console.log("Posting message.");

	// Get data
	const content = message_box.value;

	if (content.replace(/\s+/g, '') === "")
		return; // cant send empty message

	// Send
	const data = { "type": "send_message", "channel_id": app.channel_id, "content": content };
	const send = JSON.stringify(data);

	socket.send(send);

	// Clear box
	message_box.value = "";
}

function get_chunk(dir = false) {
	// Dont make multiple requests at once
	if (app.chunk_loading)
		return;

	app.chunk_loading = true;
	console.log(`Getting a${dir ? " newer" : "n older"} chunk!`);

	// Find chunk to compare position to
	let message_id; // if message_id is null, server gives us the newest messages
	const chunk = get_chunk_by_id(dir ? app.newest_chunk : app.oldest_chunk);
	if (chunk) // but if we already have a chunk we find based off that
		message_id = dir ? chunk.newest_id : chunk.oldest_id;

	let data = { "type": "get_chunk", "channel_id": app.channel_id, "dir": dir, "last_id": message_id, "chunk_s": app.chunk_s };
	data = JSON.stringify(data);

	socket.send(data);
}

function add_chunk(prev, dir, id) {
	console.log(`Adding chunk ${id} in the direction ${dir ? "new" : "old"}.`);

	// Create chunk div
	const chunk = doc.createElement("div");
	chunk.classList = "chunk";
	chunk.id = "C" + id;

	// Write messages into it
	write_messages(chunk, id, prev);
	if (dir)
		body.append(chunk);
	else
		body.insertBefore(chunk, doc.querySelector("#C" + app.oldest_chunk));

	if (app.debug) {
		const r = Math.floor(Math.random() * 255);
		const g = Math.floor(Math.random() * 255);
		const b = Math.floor(Math.random() * 255);
		chunk.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.2)`;
	}

	return id;
}

function refresh_chunk(id, prev_id) {
	console.log(`Refreshing chunk ${id} using chunk ${prev_id} as previous.`)

	// Get chunk
	const chunk = doc.querySelector("#C" + id);
	let prev;
	if (prev_id != null) {
		const prev_c = get_chunk_by_id(prev_id);
		prev = get_message_by_id(prev_c.newest_id);
	}
	
	if (!chunk)
		return false;

	// Clear it
	chunk.textContent = "";

	// Add messages
	write_messages(chunk, id, prev);

	return true;
}

function remove_chunk(id) {
	const chunk = doc.querySelector("#C" + id);
	if (!chunk) {
		console.warn(`Error unloading chunk ${id}, not found!`);
		return;	
	}

	chunk.remove();
	app.chunks.splice(get_chunk_pos_by_id(id), 1);

	if (id == app.newest_chunk)
		app.up_to_date = false;
	if (id == app.oldest_chunk)
		app.at_first = false;

	// Update oldest / newest
	if (app.oldest_chunk == id)
		app.oldest_chunk = get_farthest_chunk_id(false);
	else if (app.newest_chunk == id)
		app.newest_chunk = get_farthest_chunk_id(true);
}

function write_messages(chunk, id, prev) {
	// Get info
	const messages = get_chunk_by_id(id).messages;

	// Write messages into it
	for (let i = 0; i < messages.length; i++) {
		// Get
		const current = messages[i];
		const current_time = new Date(current.time * 1000);
		let prev_time;
		let same_day = false;
		let same_author = false;
		let time_seperation = false;

		// Write date seperator
		if (prev) {
			prev_time = new Date(prev.time * 1000);

			if (prev && current_time.getDay() == prev_time.getDay())
				same_day = true;
		}

		if (!same_day || !prev)
			chunk.innerHTML += `<span>${current_time.toLocaleDateString('en-GB', {month: 'long', day: 'numeric', year: 'numeric'})}</span>`;

		// Get extra format data
		const highlight = (current.highlight) ? "highlight" : "";

		// Write into messages div
		if (prev) { // has to be same author, less than 5 minutes ago, and same day to combine
			same_author = current.author.id == prev.author.id;
			time_seperation = (current.time - prev.time < (60 * 5));
		}

		if (same_author && time_seperation && same_day) {
			chunk.innerHTML  += 
			`<div class="message detached ${highlight}" id="M${current.id}" >
					<p class="content detached">${current.content}</p>
			</div>`;
		} else {
			chunk.innerHTML  += 
			`<div class="message ${highlight}" id="M${current.id}" >
				<a href="/app/user/${current.author.username}"><img src="/data/profile-pictures/default.png" class="pfp"></img></a>
				<div>
					<a class="author" href="/app/user/${current.author.id}">${current.author.display_name} [@${current.author.username}]</a>
					<p class="timestamp">${current.time_date}</p>
					<p class="content">${current.content}</p>
				</div>
			</div>`;
		}

		prev = current;
	}

	return true;
}

window.addEventListener("scroll", (e) => {
	// get and store previous size of window
	// and scroll
	// if you were at bottom but no longer, scroll down

	// Get chunks we care about
	const oldest = doc.querySelector("#C" + app.oldest_chunk);
	const newest = doc.querySelector("#C" + app.newest_chunk);

	// Get current scroll stuff
	const message_box_height = message_box.getBoundingClientRect().height;

	// If they are visible, load new chunk in that direction
	// If we cant load a newer one, set "up_to_date" to true so we dont spam server with requests
	if (oldest && !app.at_first) {
		const oldest_view = oldest.getBoundingClientRect();
		const oldest_boundary = oldest_view.y + oldest_view.height;

		// Compare bottom of oldest chunk to top of screen
		if (oldest_boundary > 0)
			get_chunk(false);
	}

	if (newest && !app.up_to_date) {
		const newest_view = newest.getBoundingClientRect();
		const newest_boundary = newest_view.y - window.innerHeight - message_box_height;

		// Compare top of newest chunk to bottom of screen
		if (newest_boundary < 0)
			get_chunk(true);
	}
});

///  UTILITY FUNCTIONS  ///
function now() {
	const date = new Date();

	return date.toLocaleTimeString();
}

function get_chunk_by_id(id) {
	for (let i = 0; i < app.chunks.length; i++) {
		if (app.chunks[i].id == id)
			return app.chunks[i];
	}

	return false;
}

function get_chunk_pos_by_id(id) {
	for (let i = 0; i < app.chunks.length; i++) {
		if (app.chunks[i].id == id)
			return i;
	}

	return false;
}

function get_message_by_id(id) {
	for (let i = 0; i < app.chunks.length; i++) {
		const chunk = app.chunks[i];
		if (!(chunk.oldest_id <= id && chunk.newest_id >= id))
			continue;

		// Found out chunk
		for (let j = 0; j < chunk.messages.length; j++) {
			const message = chunk.messages[j];
			if (message.id == id)
				return message;
		}
	}

	return false;
}

// Gets the farthest chunk in either direction. Can also be used to find second-farthest with ignore id
function get_farthest_chunk_id(dir, ignore_id) {
	if (dir) {
		// Find chunk with newest messages
		let current_id = 0;
		let current_chunk_id = null;

		for (let i = 0; i < app.chunks.length; i++) {
			const chunk = app.chunks[i];
			if (chunk.newest_id > current_id && chunk.id != ignore_id) {
				current_id = chunk.newest_id;
				current_chunk_id = chunk.id;
			}
		}

		return current_chunk_id;
	} else {
		// Find chunk with oldest messages
		let current_id = Infinity;
		let current_chunk_id = null;

		for (let i = 0; i < app.chunks.length; i++) {
			const chunk = app.chunks[i];
			if (chunk.oldest_id < current_id && chunk.id != ignore_id) {
				current_id = chunk.newest_id;
				current_chunk_id = chunk.id;
			}
		}

		return current_chunk_id;
	}
}

function scroll_to_bottom() {
	scroll(0, body.getBoundingClientRect().height);
}

function format_datetime(messages) {
	for (let i = 0; i < messages.length; i++) {
		// Translate to local time
		const date = new Date(messages[i].time * 1000);
		messages[i].time_date = date.toLocaleString("en-GB");
	}

	return messages;
}

const channel_list = doc.querySelector("#channels");

function display_channels(channels) {
	channel_list.innerHTML = "";

	for (let i = 0; i < channels.length; i++) {
		const channel = channels[i];
		channel_list.innerHTML += `<li>#${channel.name} [ID ${channel.id}]</li>`;
	}

	return true;
}