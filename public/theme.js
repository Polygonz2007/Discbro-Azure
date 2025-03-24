(async () => {
    console.log("Loading theme...");

    if (!window.sessionStorage["discbro_theme"]) {
        // Get and store theme
        try {
            const response = await fetch("/api/get-theme");

            // Handle response
            let data = await response.json();
            if (data.theme)
                window.sessionStorage["discbro_theme"] = data.theme;
        } catch {
            console.log("Could not get color theme.");
        }
    }

    document.querySelector(":root").setAttribute("theme", window.sessionStorage["discbro_theme"]);
    console.log(`Theme: ${window.sessionStorage["discbro_theme"]}`)
})()