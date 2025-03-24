const doc = document;

const form = doc.querySelector("form");
const info = doc.querySelector("#info");

form.addEventListener("submit", login);

async function login(event) {
    event.preventDefault();

    // Prepare
    const payload = {
        username: form.username.value,
        password: form.password.value
    };

    // Make request
    try {
        const response = await fetch("/login", {
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