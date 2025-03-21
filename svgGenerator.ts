import { env } from "bun";
import { NodeType, treeNode, Procedure } from "./ast";

class Environment  {
    width: Number = 256
    height: Number = 256
    active: Context
    stack: Context[] = []
    baseSVG: Context
    defaults: Dict<string> = {
        "stroke": "black",
        "fill": "lightgrey",
        "stroke-width": "5",
    }
    definitions: Dict<Procedure> = {} 
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
            console.log("popped empty stack!",this.stack)
            return this.baseSVG
        }
    }
    peek():Context{
        if(this.stack.length == 0){
            return this.baseSVG
        }
        
        let x = this.stack[this.stack.length-1]
        if(x){
            return x
        }else{
            console.log("bad stack, cant peek.",this.stack);
            throw new Error("cannot peek")
        }
    }
    addAndPushDefinition(identifier: string, body: treeNode[]){
        this.debug.push("def "+identifier)
        if(identifier in this.definitions){
            throw new Error("Can't define "+identifier+" . It is already defined.");
        }

        this.definitions[identifier] = new Procedure(identifier, body);
        this.push(this.definitions[identifier])
    }
    hasDefinition(identifier: string):boolean{
        return identifier in this.definitions
    }
    getDefinition(identifier: string):treeNode[]
    {
        this.debug.push("get def "+identifier)
        let x = this.definitions[identifier]
        if(x != undefined){
            return x.statements;
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
type Context = HTMLElement | SVGElement | Number | string | Procedure

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
       //     environment.pop()
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
            console.log("os", node);
            compileStandaloneObjectStatement(node,env) 
            break;
        case NodeType.Transformation:
            let ctx = env.peek();
            if(ctx != null){
                if(ctx.type == NodeType.Procedure){
                    console.log("holding onto this transform node until later!");
                    ctx.statements.push(node);
                }else{
                    node.children.forEach(x=>{
                        compileTransformation(x,env)
                    });
                }
            }
            
            break;
        case NodeType.BodyStatement:
            break;
        case NodeType.Append:
            //add to current object.
            let c = env.peek();
            console.log("append onto...",c);
            if(c != null){
                if(c.type == NodeType.Procedure){
                    console.log("holding onto this node until later!");
                    c.statements.push(node);
                }else{
                    compile(node.children[0],env);
                    (c as HTMLElement).appendChild(env.active);
                }
            }else{
                throw new Error("Cannot Append Nothing")
            }
            break;
        case NodeType.Push:
            compile(node.children[0], env)
            console.log("push ",env.active);
            env.push(env.active); 
            break;
        case NodeType.Pop:
            env.pop();
            break;
        case NodeType.DefineElement:            
            //todo: the stack needs to become our empty container for more statements.
            let def: treeNode[] = []
            env.addAndPushDefinition(node.id,def)
            break;
        default: 
            console.log("unhandled:",node)
    }
    return ""
}

function compileStandaloneObjectStatement(node:treeNode, env: Environment){
    let d: SVGElement
    let c: Context
    switch(node.id){
        case "circle":
            //todo: boilerplate out the d element code.
            d = document.createElementNS("http://www.w3.org/2000/svg",node.id) as SVGElement;
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

            env.debug.push("circle")
            env.active = d
            
            break;
        case "rect":
            d = document.createElementNS("http://www.w3.org/2000/svg",node.id) as SVGElement;
            //setting radius inline is optional
            if(node.children.length==2){
                //todo: this can become a function where we pass in a list of attributes and array of children to compile for them.
                //or even, we pass in a lookup table of valid "method signatures" of arrays of different lengths. Neat!
                let width = compile(node.children[0],env)
                if(width != null){
                    d.setAttribute("width",width)
                }

                let height = compile(node.children[0],env)
                if(height != null){
                    d.setAttribute("height",height)
                }
            }
            //if length is 4, set x y width height
            d.setAttribute("x","0")
            d.setAttribute("y","0")
            d.setAttribute("stroke",env.getDefault("stroke"))
            d.setAttribute("fill",env.getDefault("fill"))
            d.setAttribute("stroke-width", env.getDefault("stroke-width"))


        
            env.debug.push("rect")
            env.active = d
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
            setX(context,compile(node.children[0]))
            break;
        case "cx":
            //todo: determine if we need to update x or cx
            setX(context,compile(node.children[0]))
            break;
        case "y":
            setY(context, compile(node.children[0]))
            break;
        case "cy":
            //todo: determine if we need to update y or cy. We can check if context is a circle, or if it has a cx attribute.
            setY(context, compile(node.children[0]))
            break;
        case "stroke-width":
        case "sw":
            console.log("sw")
            context.setAttribute("stroke-width",compile(node.children[0]))
            break;
        case "translate":
            let x = parseFloat(compile(node.children[0]))
            let y = parseFloat(compile(node.children[1]))
    
            let ex = parseFloat(getAttribute(context,"x","0"))
            let ey = parseFloat(getAttribute(context,"y","0"))
            if(x == null || y==null)
            {
                console.log("translate ",x,y)
                throw new Error("bad properties for translate");
            }

            setX(context,x+ex)
            setY(context,y+ey)

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

function getAttribute(element: Context, attr: string, fallback: string | null = null){
    //check x/cx y/cy variations.
    if(attr == "x" || attr == "y"){
        if(element.nodeName == "circle" || element.nodeName == "ellipse" || element.nodeName == "radialGradient"){
            attr = "c"+attr;
        }
    }
    if(element.hasAttribute(attr)){
        return element.getAttribute(attr)
    }else{
        return fallback
    }
}

function setX(element: Context, value: string){
    switch(element.nodeName){
        case "circle":
        case "ellipse":
        case "radialGradient":
            element.setAttribute("cx",value);
        break;
        default:
        element.setAttribute("x",value)
    }
}

function setY(element: Context, value: string){
    switch(element.nodeName){
        case "circle":
        case "ellipse":
        case "radialGradient":
            element.setAttribute("cy",value);
        break;
        default:
        element.setAttribute("y",value)
    }
}


export{ compileAndRun}