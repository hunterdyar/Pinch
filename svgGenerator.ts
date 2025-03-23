import { NodeType, treeNode, Procedure, RuntimeNode, CreateElementNode, CreateProcedureNode,CreateNumberNode, RuntimeType } from "./ast";
import { getSignature } from "./methodSigs";


class Environment  {
    width: Number = 256
    height: Number = 256
    active: RuntimeNode | null = null
    stack: RuntimeNode[] = []
    frames: Dict<RuntimeNode>[] = [] 
    maxFrameCount = 2048
    baseSVG: SVGElement
    defaults: Dict<string> = {
        "stroke": "black",
        "fill": "lightgrey",
        "stroke-width": "5",
    }
    definitions: Dict<Procedure> = {} 

    constructor(root: SVGSVGElement){
        this.baseSVG = root;
     }
    push(i:RuntimeNode | null){
        if(i != null){
            let b4 = this.stack.length
            this.stack.push(i)
        }else{
            console.warn("[x pushed null]")
        }
    }
    pop():RuntimeNode{
        let x= this.stack.pop();
        if(x){
            return x
        }else{
            console.log("popped empty stack!",this.stack)
            return CreateElementNode(this.baseSVG)
        }
    }
    peek():RuntimeNode{
        if(this.stack.length == 0){
            throw new Error("Empty Stack!")
            //return this.baseSVG
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
        if(identifier in this.definitions){
            throw new Error("Can't define "+identifier+" . It is already defined.");
        }

        //todo: two wrapper functions basically...
        this.definitions[identifier] = new Procedure(identifier, body);
        this.push(CreateProcedureNode(this.definitions[identifier]))
    }
    hasDefinition(identifier: string):boolean{
        return identifier in this.definitions
    }
    getDefinition(identifier: string):treeNode[]
    {
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
    pushFrame(){
        //todo: picked this arbitrarily. i don't know what a good max is.
        if(this.frames.length >= this.maxFrameCount){
            throw new Error("Stack Overflow Error")
        }
        let f = {}
        this.frames.push(f)
        
    }
    popFrame()
    {
        if(this.frames.length >= 1){
            this.frames.pop()
        }else{
            throw new Error("Can't Pop Frame")
        }
    }
    setLocal(id: string, val: RuntimeNode){
        if(this.frames.length >= 1){
            let frame = this.frames[this.frames.length-1];
            if(frame != undefined){
                frame[id] = val
            }
        }else{
            throw new Error("Can't Set Local, there is no local frame.")
        }
    }
    getLocal(id: string): RuntimeNode
    {
        if(this.frames.length >= 1){
            for(let f = this.frames.length-1;f>=0;f--){
                let frame = this.frames[f];
                if(frame != undefined && frame[id]){
                    return frame[id]
                }
            }
            
        }else{
            throw new Error("Can't Get Local, there is no local frame")
        }
        throw new Error("Unable to get local property "+id);
    }
    getLocalOrNull(id: string): RuntimeNode | null{
        if(this.frames.length >= 1){
            for(let f = this.frames.length-1;f>=0;f--){
                let frame = this.frames[f];
                if(frame != undefined && frame[id]){
                    return frame[id]
                }
            }
        }
        return null;
    }
}

function compileAndRun(root: treeNode): SVGElement{
    let svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
    let environment = new Environment(svg)
    environment.push(CreateElementNode(svg))

    if(root.type != NodeType.Program){
        throw new Error("invalid root object. trying anyway...")
    }
    root.children.forEach(child => {
        //@ts-ignore
        compile(child, environment);
    });

    if(environment.stack.length != 1){
        throw new Error("The stack is "+environment.stack.length+". It should end at 1 (root svg)");
    }
    environment.stack.pop();

    svg.setAttribute("width",environment.width.toString())
    svg.setAttribute("height",environment.height.toString())
    svg.setAttribute("version", "1.1")
    return svg;
}


function compile(node:treeNode, env: Environment){
    if(!node){
        throw new Error("Can't compile nothing!")
    }
    switch(node.type){
        case NodeType.Number:
            return node.id
        case NodeType.String:
            return node.id
        case NodeType.Identifier:
            let local = env.getLocalOrNull(node.id);
            if(local){
                return local.getStringValue()
            }
            return node.id
        case NodeType.ObjectStatement:
            compileStandaloneObjectStatement(node,env) 

            //append! let empty object statements be equivalent to append.
            //todo: i want to move that logic to the lexer.
            if(env.active != null){
                let c = env.peek();
                if(c != null){
                    console.log("appending during default context")
                    c.appendChildElement(env.active)
                }
            }   
            break;
        case NodeType.Transformation:
            let ctx = env.peek();
            if(ctx != null){
                if(ctx.type == RuntimeType.Procedure){
                    ctx.procudureValue?.statements.push(node);
                }else if (ctx.type == RuntimeType.Element){
                    node.children.forEach(x=>{
                        compileTransformation(x,env)
                    });
                }else if(ctx.type == RuntimeType.Group){
                    console.log("Groups not yet supported.")
                }else{
                    throw new Error("Can't apply transformation to "+node.type.toString())
                }
            }
            
            break;
        case NodeType.Append:
            //add to current object.
            let c = env.peek();
            if(c != null){
                if(c.type == RuntimeType.Procedure){
                    c.procudureValue?.statements.push(node);
                }else if (c.type == RuntimeType.Element){
                    compile(node.children[0],env);
                    c.appendChildElement(env.active);
                }
            }else{
                throw new Error("Cannot Append Nothing")
            }
            break;
        case NodeType.Push:
            compile(node.children[0], env)
            env.push(env.active); 
            break;
        case NodeType.Pop:
            env.pop();
            break;
        case NodeType.DefineProcedureNode:            
            //todo: the stack needs to become our empty container for more statements.
            let def: treeNode[] = []
            env.addAndPushDefinition(node.id,def)
            break;
        case NodeType.Flow:
            compileFlowStatement(node,env);
            break;
        case NodeType.Block:
            node.children.forEach(n=>{
                compile(n,env);
            })
            break;
        default: 
            console.log("unhandled:",node)
    }
    return ""
}

function compileFlowStatement(node: treeNode, env: Environment){
    let call = node.children[0];
    let body = node.children[1];
    switch(call.id){
        case "repeat":
            let l = call.children.length;
            if(l < 1){
                throw new Error("repeat: wrong number arguments. need at least 1")
            }
            let label = "_"
            let argi = 0;
            if(call.children[0].type == NodeType.Label){
                label = call.children[0].id
                argi = 1;
            }

            let start = 0;
            let end = 0;
            let step = 1;
            l = l - argi;
            if(l == 1){
                //should this be int?
                end = parseInt(compile(call.children[argi],env));
            } else if(l == 2){
                start = parseInt(compile(call.children[argi+0],env));
                end = parseInt(compile(call.children[argi+1],env));
            }else if(l == 3){
                start = parseInt(compile(call.children[argi+0],env));
                end = parseInt(compile(call.children[argi+1],env));
                step = parseInt(compile(call.children[argi+2], env))
            }else{
                throw new Error("repeat: wrong number arguments. got too many.")
            }

            if(step == 0){
                throw new Error("repeat: step cannot be 0.")
            } else if(start > end && step > 0){
                throw new Error("repeat: step moves away from end.")
            }else if(start < end && step < 0){
                throw new Error("repeat: step moves away from end.")
            }else if(start == end){
                console.warn("Repeat: Start and end are the same? Nothing will happen.")
            }

            env.pushFrame()
            for(let i = start;i<end;i+=step){
                env.setLocal(label,CreateNumberNode(i));
                compile(body,env)
            }
            env.popFrame();
        break
    }
}

function compileStandaloneObjectStatement(node:treeNode, env: Environment){
    env.active = null;
    let d: SVGElement
    switch(node.id){
        case "circle":
            //todo: boilerplate out the d element code.
            d = document.createElementNS("http://www.w3.org/2000/svg",node.id) as SVGElement;
            //setting radius inline is optional
            var sig = getSignature(node.children.length,"circle");

            for(let i = 0;i<sig.length;i++){
                let attr = compile(node.children[i],env)
                if(attr != null ){
                    let attrName = sig[i]
                    if(attrName!= undefined){
                        d.setAttribute(attrName,attr);
                    }else{
                        throw new Error("bad signature check?")
                    }
                }else{
                    throw new Error("bad signature?");
                }
            }

            d.setAttribute("cx","0")
            d.setAttribute("cy","0")
            d.setAttribute("stroke",env.getDefault("stroke"))
            d.setAttribute("fill",env.getDefault("fill"))
            d.setAttribute("stroke-width", env.getDefault("stroke-width"))

            env.active = CreateElementNode(d)
            
            break;
        case "rect":
            d = document.createElementNS("http://www.w3.org/2000/svg",node.id) as SVGElement;

            var sig = getSignature(node.children.length,"rect");
            for(let i = 0;i<sig.length;i++){
                let attr = compile(node.children[i],env)
                if(attr != null ){
                    let attrName = sig[i]
                    if(attrName!= undefined){
                        d.setAttribute(attrName,attr);
                    }else{
                        throw new Error("bad signature check?")
                    }
                }else{
                    throw new Error("bad signature?");
                }
            }
            
        
            //if length is 4, set x y width height
            d.setAttribute("x","0")
            d.setAttribute("y","0")
            d.setAttribute("stroke",env.getDefault("stroke"))
            d.setAttribute("fill",env.getDefault("fill"))
            d.setAttribute("stroke-width", env.getDefault("stroke-width"))
        
            env.active = CreateElementNode(d)
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
            //def lookup!            
            if(!tryRunDefinitionLookup(node.id,env)){
                console.log("Warning. Unknown standalone object statement "+node.id)
            }
        }
        
    //
}

function tryRunDefinitionLookup(id: string, env:Environment):boolean{
    if(env.hasDefinition(id)){
        //push?

        let body = env.getDefinition(id)
        body.forEach(x=>{
            compile(x,env);
        });

        return true
    }
    return false
}

function compileTransformation(node:treeNode, env: Environment){
    let contextNode = env.peek()
    if(contextNode.type != RuntimeType.Element){
        throw new Error("Can't compile context on type "+contextNode.type.toString()+". Groups not yet supported.")
    }
    let context = contextNode.elementValue;
    if(context == null || context == undefined){
        return;
    }
    switch(node.id){
        case "fill":
            context.setAttribute("fill",compile(node.children[0],env))
            break
        case "radius":
            context.setAttribute("r",compile(node.children[0],env))
            break;
        case "x":
            setX(context, compile(node.children[0],env))
            break;
        case "cx":
            //todo: determine if we need to update x or cx
            setX(context, compile(node.children[0],env))
            break;
        case "y":
            setY(context, compile(node.children[0],env))
            break;
        case "cy":
            //todo: determine if we need to update y or cy. We can check if context is a circle, or if it has a cx attribute.
            setY(context, compile(node.children[0],env))
            break;
        case "stroke-width":
        case "sw":
            console.log("sw")
            context.setAttribute("stroke-width",compile(node.children[0],env))
            break;
        case "translate":
            let x = parseFloat(compile(node.children[0],env))
            let y = parseFloat(compile(node.children[1],env))
    
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
            
            if(!tryRunDefinitionLookup(node.id,env)){
                let attr = node.id
                let val = compile(node.children[0],env)
                console.log("unenforced attribute:",attr,val)
                if(val){
                    context.setAttribute(attr,val)
                }
            }
    }
}

function getAttribute(element: SVGElement, attr: Number | string, fallback: Number | string = "") : string{
    //check x/cx y/cy variations.
    if(attr == "x" || attr == "y"){
        if(element.nodeName == "circle" || element.nodeName == "ellipse" || element.nodeName == "radialGradient"){
            attr = "c"+attr;
        }
    }
    if(element.hasAttribute(attr.toString())){
        let a = element.getAttribute(attr.toString())
        if(a){ return a}
        return fallback.toString()
    }else{
        return fallback.toString()
    }
}

function setX(element: SVGElement, value: Number |string){
    switch(element.nodeName){
        case "circle":
        case "ellipse":
        case "radialGradient":
            element.setAttribute("cx",value.toString());
        break;
        default:
            element.setAttribute("x",value.toString())
    }
}

function setY(element: SVGElement, value: Number | string){
    switch(element.nodeName){
        case "circle":
        case "ellipse":
        case "radialGradient":
            element.setAttribute("cy",value.toString());
        break;
        default:
        element.setAttribute("y",value.toString())
    }
}


export{ compileAndRun}