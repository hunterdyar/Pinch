import { basicSetup } from "codemirror";
import {EditorState, StateField} from "@codemirror/state"
import {gutter, GutterMarker} from "@codemirror/view"
import {EditorView, keymap, ViewPlugin, type EditorViewConfig} from "@codemirror/view"
import {defaultKeymap, indentWithTab} from "@codemirror/commands"
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { CreatePinchDrawing } from "./pinch/parser";
import {GetSVGFromCurrentPaperContext } from "./pinch/compiler"
import { Environment } from "./pinch/environment";

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
      }
    }
    //@ts-ignore
    destroy() { this.dom.remove() }
  })



const pinchLinter = linter(view => {
  return diagnostics
})
const blockColors = ["#5E7432","#FFCB67","#CE6039","#95C55F","#A04615","#F78059"]
const gutterBlockWidth = "4px";
class StackGutterMarker extends GutterMarker {
  val: string = ""
  innerItem: HTMLElement
  
  constructor(val: string){
    super()
    this.val = val;
    this.innerItem = document.createElement("span");    
    this.innerItem.style.position = "relative";
    for (let i = 0; i < val.length; i++) {
      const element = val.charAt(i)
      switch(element){
        case "|":
          let box = document.createElement("span")
          box.classList.add("stackBlockGutterItem")
          //@ts-ignore
          box.innerHTML ='<svg  xmlns="http://www.w3.org/2000/svg"  preserveAspectRatio="none" width="100%"  height="100%"  viewBox="0 0 10 10"  fill="'+blockColors[i%blockColors.length]+'"><path stroke="none" d="m0,0 v11 h10 v-11 z"/></svg>';
          box.style.display = "inline-block"
          this.innerItem.appendChild(box);
          break;
          case "\\":
            let top = document.createElement("span")
            top.classList.add("stackBlockGutterItem")
            //@ts-ignore
            top.innerHTML ='<svg  xmlns="http://www.w3.org/2000/svg"  preserveAspectRatio="none" width="100%"  height="100%"  viewBox="0 0 10 10"  fill="'+blockColors[i%blockColors.length]+'"><path stroke="none" d="m0,0 v11 h11 z"/></svg>';
            //top.style.backgroundColor = blockColors[i%blockColors.length]
            top.style.display = "inline-block"
            this.innerItem.appendChild(top);
            break;
          case "/":
            let bot = document.createElement("span")
            bot.classList.add("stackBlockGutterItem")
            //@ts-ignore
            bot.innerHTML ='<svg  xmlns="http://www.w3.org/2000/svg"  preserveAspectRatio="none" width="100%"  height="100%"  viewBox="0 0 10 10"  fill="'+blockColors[i%blockColors.length]+'"><path d="m0,0 h10 L0,10 z"/></svg>';
            //top.style.backgroundColor = blockColors[i%blockColors.length]
            bot.style.display = "inline-block"
            this.innerItem.appendChild(bot);
            break;
          case "o":
            let sir = document.createElement("span")
            sir.classList.add("stackBlockGutterItem")
            //@ts-ignore
            sir.innerHTML ='<svg  xmlns="http://www.w3.org/2000/svg"  preserveAspectRatio="none" width="100%"  height="100%"  viewBox="0 0 10 10"  fill="'+blockColors[i%blockColors.length]+'"><path stroke="none" d="m0,0 L10,5 L0,10 z"/></svg>';
            sir.style.display = "inline-block"
            this.innerItem.appendChild(sir);
            break;
        default:
          let d = document.createElement("span")
          d.style.display = "inline-block"
          d.innerText = element;
          this.innerItem.appendChild(d); 
      }
    }
  }

  toDOM() {
    return this.innerItem.cloneNode(true)
  }
}

const gutterMarkers: Dict<StackGutterMarker> = {}
const emptyStackGutterMarker = new StackGutterMarker("")
const stackViewGutter = gutter({
  lineMarker(view, line){
      //Right now we are drawing characters for every line.
      let num = view.state.doc.lineAt(line.from).number

      if(environment){
        //this is slow, silly, stupid, and feels bad? doc points instead of line numbers make sense but...
        let stackdec = ""
        for(let i = 0;i<environment.stackMetaItems.length;i++){
          const sm = environment.stackMetaItems[i]
          if(!sm){continue}

          //if it's unclosed.
          if(sm.end===undefined){
            let end = view.state.doc.lineAt(view.state.doc.length).number
            //plus 1 so we don't draw end-caps.
            sm.end = end+1
          }

          if(num === sm.start && num === sm.end){
            stackdec+="o"
          }else{
            if(num == sm.start){
              stackdec +="\\"
            }else if(num > sm.start){
              if(sm.end != undefined){
                if(num < sm.end){
                  stackdec +="|"
                }else if(num == sm.end){
                  stackdec += "/"
                }
              }
            }
          }
        }//end loop
        if(stackdec != undefined){
          return getGutterMarker(stackdec)
        }
      }
      return null
  },
  initialSpacer: () => emptyStackGutterMarker
})

function getGutterMarker(dec: string) : StackGutterMarker{
  let stack = dec
  if(stack in gutterMarkers){
    let o = gutterMarkers[stack]
    if(o){
      return o;
    }
  }else{
    let m = new StackGutterMarker(stack)
    gutterMarkers[stack] = m;
    return m;
  }
  //
  return new StackGutterMarker("")
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