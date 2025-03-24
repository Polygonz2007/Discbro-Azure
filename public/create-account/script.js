const doc = document;

const form = doc.querySelector("form");
const info = doc.querySelector("#info");

// Check for username formatting
const username_field = doc.querySelector("#username");

username_field.addEventListener("keyup", () => {
    const username = username_field.value;

    if (!username.match(/^[a-z0-9-_]+$/) || username.length < 4 || username.length > 32)
        username_field.classList.add("invalid");
    else
        username_field.classList.remove("invalid");
});

// Send request to server
form.addEventListener("submit", login);

async function login(event) {
    event.preventDefault();

    // Prepare
    const payload = {
        username: form.username.value,
        password: form.password.value,
        confirm: form.confirm.value
    };

    // Make request
    try {
        const response = await fetch("/create-account", {
            method: "POST",
            headers: {"Content-type": "application/json"},
            body: JSON.stringify(payload)
        });

        // Redirect if redirected
        if (response.redirected)
            window.location.href = response.url;

        // If not redirected, handle error response
        let data = await response.json();
        if (data.error)
            info.innerText = data.error;
    } catch {
        info.innerHTML = "Request to server failed. Please try again.";
    }
}