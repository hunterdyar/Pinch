import { basicSetup } from "codemirror";
import {EditorState, StateEffect, StateField} from "@codemirror/state"
import {Decoration, DecorationSet, gutter, GutterMarker} from "@codemirror/view"
import {EditorView, keymap, ViewPlugin, type EditorViewConfig} from "@codemirror/view"
import {defaultKeymap, indentWithTab} from "@codemirror/commands"
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { CreatePinchDrawing } from "./pinch/parser";
import {GetSVGFromCurrentPaperContext } from "./pinch/compiler"
import { Environment, StackMetaItem } from "./pinch/environment";
import { env } from "bun";

const inputContainer = document.getElementById("inputContainer") as HTMLDivElement
const output = document.getElementById("outputCanvas") as HTMLCanvasElement
const errorp = document.getElementById("errorArea") as HTMLParagraphElement
const exportsvg = document.getElementById("exportSVGButton") as HTMLButtonElement
const exportpng = document.getElementById("exportPNGButton") as HTMLButtonElement
const metricResult = document.getElementById("metrics") as HTMLParagraphElement
const localStorageKey = "pinchEditorValue"
let starting = localStorage.getItem(localStorageKey);
let diagnostics: Diagnostic[] = []
let environment: Environment

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

const environmentField = StateField.define<Environment>({
  create(s){return environment},
  update(state,transaction){
    return environment
  }
})

const drawSVGOnChangePlugin = ViewPlugin.fromClass(class {
    constructor(view: any) {
        draw(view.state.doc)
    }
    update(update: any) {
      if (update.docChanged){
        draw(update.state.doc)
        localStorage.setItem(localStorageKey,update.state.doc)

        //CodeMirror plugin crashed: Error: Calls to EditorView.update are not allowed while an update is in progress
        
        //when the fuck are we supposed to update things?

        // environment.stackMetaItems.forEach(x=>{
        //   view.dispatch({
        //     effects: addStackMetaItem.of({from:x.start, to: ((x!=undefined) ? x.end : 0)})
        //     })
        // })
      }
    }
    //@ts-ignore
    destroy() { this.dom.remove() }
  })



const pinchLinter = linter(view => {
  return diagnostics
})

class StackGutterMarker  extends GutterMarker {
  val: string = ""
  constructor(vals: any[]){
    super()

    this.val = ""
    for (let i = 0; i < vals.length; i++) {
      const element = vals[i];
      this.val+=element.toString();
    }
  }

  toDOM() {
   
    return document.createTextNode(this.val.toString()) }

}
const gutterMarkers: Dict<StackGutterMarker> = {}
const emptyStackGutterMarker = new StackGutterMarker([])
const stackViewGutter = gutter({
  lineMarker(view, line){
      //Right now we are drawing characters for every line.
      let num = view.state.doc.lineAt(line.from).number

      if(environment){
        //this is slow, silly, stupid, and feels bad? doc points instead of line numbers make sense but...
        let stackdec = []
        for(let i = 0;i<environment.stackMetaItems.length;i++){
          const sm = environment.stackMetaItems[i]

          if(sm && sm.end===undefined){
            let end = view.state.doc.lineAt(view.state.doc.length).number
            //plus 1 so we don't draw end-caps.
            environment.stackMetaItems[i].end = end+1
          }

          if(!sm){continue}
          if(num === sm.start && num === sm.end){
            stackdec.push("o")
          }else{
            if(num == sm.start){
              stackdec.push("\\")
            }else if(num > sm.start){
              if(sm.end != undefined){
                if(num < sm.end){
                  stackdec.push("|")
                }else if(num == sm.end){
                  stackdec.push("/")
                }
              }
            }
          }
        }//end loop
        if(stackdec){
          return getGutterMarker(stackdec)
        }
      }
      return null
  },
  initialSpacer: () => emptyStackGutterMarker
})

function getGutterMarker(dec: string[]) : StackGutterMarker{
  let stack = dec.join("");
  if(stack in gutterMarkers){
    let o = gutterMarkers[stack]
    if(o){
      return o;
    }
  }else{
    let m = new StackGutterMarker(dec)
    gutterMarkers[stack] = m;
    return m;
  }
  //
  return new StackGutterMarker([])
}

let state = EditorState.create({
    doc: starting,
    extensions: [
      basicSetup,keymap.of(defaultKeymap), keymap.of(indentWithTab),
      drawSVGOnChangePlugin,
      lintGutter(),
      stackViewGutter,
      pinchLinter,
      environmentField,
    ]
})

let view = new EditorView({
    state: state,
    parent: inputContainer,
  })

function reconfigureCanvas(){
  output.width = environment.width;
  output.style.width = environment.width+"px"
  output.height = environment.height;
  output.style.height = environment.height+"px"
}


function draw(code:string){
   // let text = inputBox.value
   try {
        performance.mark("pinch-start");
        environment = CreatePinchDrawing(output, code);
        //resize, etc, from env.
        reconfigureCanvas();

        errorp.innerHTML = '<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-mood-smile"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 10l.01 0" /><path d="M15 10l.01 0" /><path d="M9.5 15a3.5 3.5 0 0 0 5 0" /></svg>'
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
          //also consider this smiley, the mouth looks like squiggly error underline... https://tabler.io/icons/icon/mood-sick
          errorp.innerHTML = '<svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-mood-sad-squint"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M14.5 16.05a3.5 3.5 0 0 0 -5 0" /><path d="M8.5 11.5l1.5 -1.5l-1.5 -1.5" /><path d="M15.5 11.5l-1.5 -1.5l1.5 -1.5" /></svg><br /><pre>'+error.message+'</pre>'
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