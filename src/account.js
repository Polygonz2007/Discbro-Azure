
// Handles logging in, permissions and more

const format = require("./format.js");
const database = require("./database.js");
const bcrypt = require("bcrypt");

async function check_login(req, res, next) {
    if (req.session.user_id)
        return next();
    else
        return res.redirect("/login");
}

async function login(req, res) {
    const data = req.body;
    const id = await database.check_username(data.username);
    if (!id)
        return res.send({"error": "User does not exist."});

    const user = await database.get_user_info(id);
    if (!user)
        return res.send({"error": "Error fetching user data. Try again."});

    // Check password
    const compare = bcrypt.compareSync(data.password, user.password);
    if (!compare)
        return res.send({"error": "Username or password is incorrect."});
    
    // Correct, let them in
    req.session.user_id = id;

    format.log("account", `User @${user.username} [ID: ${user.id}] logged in successfully.`);

    // Send to app
    return res.redirect("/app");
}

async function create_account(req, res) {
    const data = req.body;

    // Check there is anything at all
    if (!data.username || !data.password)
        return res.send({"error": "Username / password cannot be empty!"});

    // Check character limits
    if (data.username.length < 4)
        return res.send({"error": "Username is too short."});
    if (data.username.length > 32)
        return res.send({"error": "Username is too long."});

    // Check that username only uses valid characters
    if (!data.username.match(/^[a-z0-9-_]+$/))
        return res.send({"error": "Username contains invalid characters. Only lowercase letters, numbers, dashes and underscores are allowed."});

    // Check that user doesnt already exist
    if (await database.check_username(data.username))
        return res.send({"error": "Username is in use."});

    // Check passwords match
    if (data.password != data.confirm)
        return res.send({"error": "Passwords do not match. Please make sure they are typed correctly."});

    // Create user (default displayname is same as username)
    const new_user = await database.new_user(data.username, data.username, data.password);
    if (!new_user)
        return res.send({"error": new_user});

    // Get new id and log in
    const id = await database.check_username(data.username);
    req.session.user_id = id;

    format.log("account", `Account @${data.username} [ID: ${id}] created successfully.`);
    format.log("account", `User @${data.username} [ID: ${id}] logged in successfully.`);

    // Send to app
    return res.redirect("/app");
}

module.exports = {
    check_login,
    login,
    create_account
}
