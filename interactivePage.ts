import { basicSetup } from "codemirror";
import {EditorState, StateField} from "@codemirror/state"
import {EditorView, keymap, ViewPlugin} from "@codemirror/view"
import {defaultKeymap, indentWithTab} from "@codemirror/commands"
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { CreatePinchDrawing } from "./pinch/parser";
import {GetSVGFromCurrentPaperContext } from "./pinch/compiler"
console.log("Starting!");
const inputContainer = document.getElementById("inputContainer") as HTMLDivElement
const output = document.getElementById("outputCanvas") as HTMLCanvasElement
const errorp = document.getElementById("errorArea") as HTMLParagraphElement
const exportsvg = document.getElementById("exportSVGButton") as HTMLButtonElement
const exportpng = document.getElementById("exportPNGButton") as HTMLButtonElement
const metricResult = document.getElementById("metrics") as HTMLParagraphElement
const localStorageKey = "pinchEditorValue"
let starting = localStorage.getItem(localStorageKey);
let diagnostics: Diagnostic[] = []

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


const pinchLinter = linter(view => {
  
  return diagnostics
})


let startState = EditorState.create({
    doc: starting,
    extensions: [
      basicSetup,keymap.of(defaultKeymap), keymap.of(indentWithTab),
      drawSVGOnChangePlugin,
      lintGutter(),
      pinchLinter,
    ]
})


let view = new EditorView({
    state: startState,
    parent: inputContainer,
  })

function draw(code:string){
   // let text = inputBox.value
   try {
        performance.mark("pinch-start");
        CreatePinchDrawing(output, code);
        errorp.innerText = ""
        performance.mark("pinch-end");
        diagnostics = []
        const parsePerf = performance.measure("pinch-parse","pinch-start","parse-end");
        const compPerf = performance.measure("pinch-compile","parse-end","compile-end");
        const renderPerf = performance.measure("pinch-render","compile-end","pinch-end");
        const totalPerf = performance.measure("parse","pinch-start","pinch-end");
        metricResult.innerText = totalPerf.duration+"ms:" +
                              " parse "+parsePerf.duration+"ms" +
                              " compile "+compPerf.duration+"ms" +
                              " render "+renderPerf.duration+"ms"
    } catch (error: any) {
      //if here is to catch new errors i'm refactoring to. while still displaying old ones. 
        diagnostics = []
        if(error.message && (error.from != undefined)){
          console.error(error.message)
          errorp.innerText = error.message
          metricResult.innerText = error.name
          diagnostics.push({
            from: error.from,
            to: error.to,
            severity: "error",
            message: error.message
          })
        }else{
          console.error(error)
          errorp.innerText = error.toString()
          metricResult.innerText = "error"
        }
    }  
}

exportsvg.onclick = (e)=>{
  getSVG();
}
exportpng.onclick = (e)=>{getPNG();}

let downloadLink = document.createElement('a')
const serializer = new XMLSerializer();
function getSVG(){
  let svg = GetSVGFromCurrentPaperContext() as SVGElement;
  var url = "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(serializer.serializeToString(svg));
  
  downloadLink.download = 'pinch.svg'
  downloadLink.href = url;
  downloadLink.click();
}

function getPNG(){
  let dataURL = output.toDataURL('image/png');
  let url = dataURL.replace(/^data:image\/png/,'data:application/octet-stream');

  downloadLink.href = url;
  downloadLink.download = "pinch.png"
  downloadLink.click();
}
