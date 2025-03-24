import { CreateSVG } from "./parser";
import { basicSetup } from "codemirror";
import {EditorState, StateField} from "@codemirror/state"
import {EditorView, keymap, ViewPlugin} from "@codemirror/view"
import {defaultKeymap} from "@codemirror/commands"

console.log("Starting!");
const inputContainer = document.getElementById("inputContainer") as HTMLDivElement
const output = document.getElementById("outputContainer") as HTMLDivElement
const rawoutput = document.getElementById("rawContainer") as HTMLTextAreaElement
const errorp = document.getElementById("errorArea") as HTMLParagraphElement

let startingCode = "def center > \n| x 75\n| y 75\n. \n \n \n + circle 50 > \n | fill blue\n ."
startingCode = `
{ def dot
+ circle 20 >
| fill lightblue
| stroke-width 2
.
}


{ repeat @y 20 256 50
{ repeat @x 20 256 50
  + dot >
  | x x
  | y y
  | translate 7 7
.
}
}



`

const drawSVGOnChangePlugin = ViewPlugin.fromClass(class {
    constructor(view) {
        draw(view.state.doc)
    }
    update(update) {
      if (update.docChanged){
        draw(update.state.doc)
      }
    }
    destroy() { this.dom.remove() }
  })

let startState = EditorState.create({
    doc: startingCode,
    extensions: [drawSVGOnChangePlugin,basicSetup,keymap.of(defaultKeymap)]
})

let view = new EditorView({
    state: startState,
    parent: inputContainer
})


function draw(code:string){
   // let text = inputBox.value
   try {
        let svg = CreateSVG(code);
        output.innerText = ""
        output.appendChild(svg);
        rawoutput.value = output.innerHTML
        errorp.innerText = ""
    } catch (error) {
        console.error(error)
        errorp.innerText = error.toString()
    }
   
}
