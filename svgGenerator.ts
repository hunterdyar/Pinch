import { env } from "bun";
import { NodeType, treeNode } from "./ast";

class Environment  {
    width: Number = 256
    height: Number = 256
    stack: Context[] = []
    defaults: Dict<string> = {
        "stroke": "black",
        "fill": "lightgrey",
        "stroke-width": "5",
    }
    definitions: Dict<treeNode[]> = {} 
    debug: string[] = []

    push(i:Context){
        this.debug.push("push")
        let b4 = this.stack.length
        this.stack.push(i)
    }
    pop():Context{
        this.debug.push("pop")
        let x= this.stack.pop();
        if(x){
            return x
        }else{
            console.log("error in stack",this.stack)
            throw new Error("cannot pop")
        }
    }
    peek():Context{
        let x= this.stack[this.stack.length-1]
        if(x){
            return x
        }else{
            throw new Error("cannot pop")
        }
    }
    addDefinition(identifier: string, body: treeNode[]){
        this.debug.push("def "+identifier)
        if(identifier in this.definitions){
            throw new Error("Can't define "+identifier+" . It is already defined.");
        }

        this.definitions[identifier] = body
    }
    hasDefinition(identifier: string):boolean{
        return identifier in this.definitions
    }
    getDefinition(identifier: string):treeNode[]
    {
        this.debug.push("get def "+identifier)
        let x = this.definitions[identifier]
        if(x != undefined){
            return x;
        }else{
            throw new Error("Invlid definition lookup. "+identifier)
        }
    }
    getDefault(key: string):string{
        key = key.toLowerCase()
        if(key in this.defaults){
         let x = this.defaults[key]
         if(x != null)
         {
            return x;
         }
        }
        throw new Error("Unknown default key "+key);
    }
    printdebug(){
        let s = this.debug.reduce((s,x)=>s+x+", ")
        console.log(s);
    }

}
//todo: wrapper class with context types
type Context = HTMLElement | SVGElement | Number | string 

function compileAndRun(root: treeNode): SVGElement{
    let svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
    let environment = new Environment()
    environment.push(svg)

    if(root.type != NodeType.Program){
        throw new Error("invalid root object. trying anyway...")
    }
    root.children.forEach(child => {
        environment.debug.push("\n|root \n")
        //@ts-ignore
        compile(child, environment);
        environment.printdebug()

        if(environment.stack.length >= 2){
            environment.pop()
        }else{
            console.log("protecting last item on stack.")
        }
    });

    if(environment.stack.length != 1){
        throw new Error("not all pushes got popped, for context stack. stack is "+environment.stack.length);
    }
    environment.stack.pop();

    svg.setAttribute("width",environment.width.toString())
    svg.setAttribute("height",environment.height.toString())
    svg.setAttribute("version", "1.1")
    return svg;
}


function compile(node:treeNode, env: Environment){
    if(!node){
        return null
    }
    switch(node.type){
        case NodeType.Number:
            return node.id
        case NodeType.Identifier:
            return node.id
        case NodeType.ObjectStatement:
            compileStandaloneObjectStatement(node,env) 
            break;
        case NodeType.Transformation:
            node.children.forEach(x=>{
                compileTransformation(x,env)
            });
            break;
        case NodeType.BodyStatement:
            break;
        case NodeType.ObjectWithBody:
            env.debug.push("owb")
            if(node.children.length != 2){
                throw new Error("bad Object with Body Format")
            }
            compile(node.children[0],env)
            compile(node.children[1],env)
           // env.pop()//the . clears the stack basically.
            break;
        case NodeType.ProcBody:
            node.children.forEach(x=>{
                compile(x,env)  
            })
            break;
        case NodeType.DefineElement:            
            env.addDefinition(node.id,node.children)
            break;
        default: 
            console.log("unhandled:",node)
    }
    return ""
}

function compileStandaloneObjectStatement(node:treeNode, env: Environment){
    switch(node.id){
        case "circle":
            //todo: boilerplate out the d element code.
            let d = document.createElementNS("http://www.w3.org/2000/svg",node.id);
            //setting radius inline is optional
            if(node.children.length>=1){
                let radius = compile(node.children[0],env)
                if(radius != null){
                    d.setAttribute("r",radius)
                }
            }
            d.setAttribute("cx","0")
            d.setAttribute("cy","0")
            d.setAttribute("stroke",env.getDefault("stroke"))
            d.setAttribute("fill",env.getDefault("fill"))
            d.setAttribute("stroke-width", env.getDefault("stroke-width"))


            let c = env.peek();
            (c as HTMLElement).appendChild(d);
            env.debug.push("circle")
            env.push(d)
            
            break;
        case "rect":
            break;
        //Static Function Calls...
        case "width":
            if(node.children.length == 0)
            {
                //variable accessor! not a thing that we have right now...
                
            }
            let w = compile(node.children[0],env)
            if(w){
                env.width = parseInt(w)
            }else{
                console.log("cannot parse width:",w)
            }
            return;
        case "height":
            let h = compile(node.children[0],env)
            if(h){
                env.height = parseInt(h)
            }else{
                console.log("cannot parse height:",h)
            }
            return;
        default:
            //variable lookup!            
            tryRunVariableLookup(node.id,env)
        }

        //this is down here just so we don't have to keep writing it.
        
    //
}

function tryRunVariableLookup(id: string, env:Environment):boolean{
    if(env.hasDefinition(id)){
        //push?

        let body = env.getDefinition(id)
        body.forEach(x=>{
            compile(x,env);
        });
        //pop? push?
        return true
    }
    return false
}

function compileTransformation(node:treeNode, env: Environment){
    let context = env.peek()
    switch(node.id){
        case "fill":
            context.setAttribute("fill",compile(node.children[0]))
            break
        case "radius":
            context.setAttribute("r",compile(node.children[0]))
            break;
        case "x":
        case "cx":
        context.setAttribute("cx",compile(node.children[0]))
            break;
        case "y":
        case "cy":
        context.setAttribute("cy",compile(node.children[0]))
            break;
        case "stroke-width":
        case "sw":
            console.log("sw")
            context.setAttribute("stroke-width",compile(node.children[0]))
            break;
        case "translate":
            let x = parseFloat(compile(node.children[0]))
            let y = parseFloat(compile(node.children[1]))
    

            let ex = parseFloat(context.getAttribute("cx"))
            let ey = parseFloat(context.getAttribute("cy"))
            if(x == null || y==null)
            {
                console.log("translate ",x,y)
                throw new Error("bad properties for translate");
            }
            if(!ex)
            {
                ex = 0
            }
            if(!ey)
            {
                ey = 0
            }

            context.setAttribute("cx",x+ex)
            context.setAttribute("cy",y+ey)

            break;
        default:
            if(!tryRunVariableLookup(node.id,env)){
                let attr = node.id
                let val = compile(node.children[0],env)
                console.log("unenforced attribute:",attr,val)
                context.setAttribute(attr,val)
            }
    }
}
    export{ compileAndRun}