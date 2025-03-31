import { CreateSVG } from "./parser";
import { basicSetup } from "codemirror";
import {EditorState, StateField} from "@codemirror/state"
import {EditorView, keymap, ViewPlugin} from "@codemirror/view"
import {defaultKeymap} from "@codemirror/commands"
import { CreatePinchDrawing } from "./pinch/parser";
console.log("Starting!");
const inputContainer = document.getElementById("inputContainer") as HTMLDivElement
const output = document.getElementById("outputCanvas") as HTMLCanvasElement
const rawoutput = document.getElementById("rawContainer") as HTMLTextAreaElement
const errorp = document.getElementById("errorArea") as HTMLParagraphElement
const localStorageKey = "pinchEditorValue"
let starting = localStorage.getItem(localStorageKey);

if(!starting){
starting = "def center > \n| x 75\n| y 75\n. \n \n \n + circle 50 > \n | fill blue\n ."
starting = `
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
}

const drawSVGOnChangePlugin = ViewPlugin.fromClass(class {
    constructor(view: any) {
        draw(view.state.doc)
    }
    update(update: any) {
      if (update.docChanged){
        draw(update.state.doc)
        localStorage.setItem(localStorageKey,update.state.doc)
      }
    }
    //@ts-ignore
    destroy() { this.dom.remove() }
  })

let startState = EditorState.create({
    doc: starting,
    extensions: [drawSVGOnChangePlugin,basicSetup,keymap.of(defaultKeymap)]
})

let view = new EditorView({
    state: startState,
    parent: inputContainer
})

function draw(code:string){
   // let text = inputBox.value
   try {
        CreatePinchDrawing(output, code);
        rawoutput.value = output.innerHTML
        errorp.innerText = ""
    } catch (error: any) {
        console.error(error)
        errorp.innerText = error.toString()
    }
   
}
