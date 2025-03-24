const doc = document;

let div1 = doc.querySelector("#a");

div1.addEventListener("scroll", (e) => {
    console.log(e);
})