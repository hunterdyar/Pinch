import { CreateSVG } from "./index";
console.log("Starting!");
const inputBox = document.getElementById("input") as HTMLTextAreaElement
const output = document.getElementById("outputContainer") as HTMLDivElement
const rawoutput = document.getElementById("rawContainer") as HTMLTextAreaElement

inputBox.oninput = function update(){
    draw();
}


function draw(){
    let text = inputBox.value
    let svg = CreateSVG(text);
    output.innerText = ""
    output.appendChild(svg);
    rawoutput.value = output.innerHTML
}


draw();