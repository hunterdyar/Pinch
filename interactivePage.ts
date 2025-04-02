import { basicSetup } from "codemirror";
import {EditorState, StateField} from "@codemirror/state"
import {EditorView, keymap, ViewPlugin} from "@codemirror/view"
import {defaultKeymap, indentWithTab} from "@codemirror/commands"
import { CreatePinchDrawing } from "./pinch/parser";
import {GetSVGFromCurrentPaperContext } from "./pinch/svgGenerator"
console.log("Starting!");
const inputContainer = document.getElementById("inputContainer") as HTMLDivElement
const output = document.getElementById("outputCanvas") as HTMLCanvasElement
const errorp = document.getElementById("errorArea") as HTMLParagraphElement
const localStorageKey = "pinchEditorValue"
let starting = localStorage.getItem(localStorageKey);

if(!starting){
starting = `{ def dot
+ circle 20 >
| fill lightblue
| stroke-width 2
.
}


{ repeat @i 20 256 50
{ repeat @j 20 256 50
  + dot >
  | x i
  | y j
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
    extensions: [drawSVGOnChangePlugin,basicSetup,keymap.of(defaultKeymap), keymap.of(indentWithTab)]
})

let view = new EditorView({
    state: startState,
    parent: inputContainer
})

function draw(code:string){
   // let text = inputBox.value
   try {
        let stime = Date.now();
        CreatePinchDrawing(output, code);
        errorp.innerText = ""
        let end = Date.now();
        console.log("done in "+(end-stime).toString()+"ms");
    } catch (error: any) {
        console.error(error)
        errorp.innerText = error.toString()
    }  
}

function getSVG(){
  console.log("svg",GetSVGFromCurrentPaperContext())
}
