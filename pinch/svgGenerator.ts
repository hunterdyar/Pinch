import { Point } from "paper/dist/paper-core";
import { NodeType, treeNode, Procedure, RuntimeNode, RuntimeElement, RuntimeItem, RuntimeGroup, CreateElementNode,CreateGroupNode, CreateProcedureNode,CreateNumberNode, RuntimeType } from "./ast";
import { getSignature } from "./methodSigs";
import paper from "paper";

class Environment  {
    width: Number = 256
    height: Number = 256
    active: RuntimeNode | null = null
    root: RuntimeNode
    stack: RuntimeNode[] = []
    frames: Dict<RuntimeNode>[] = [] 
    maxFrameCount = 2048
    defaults: Dict<string> = {
        "stroke": "black",
        "fill": "lightgrey",
        "stroke-width": "5",
    }
    definitions: Dict<Procedure> = {} 

    constructor(){
        //root runtime group element.
        this.root = CreateGroupNode();
        //defaults
 
        this.stack.push(this.root)
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
            return this.root
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
    printJSFrame():string {
        var print = ""
        for(let f = this.frames.length-1;f>=0;f--){
            const fr = this.frames[f];
            if(fr){
                for(let v in fr)
                {
                    let val = fr[v];
                    if(val){
                        print += "let "+v+" = "
                        print += val.getStringValue()
                        print +=";\n"
                    }
                }
            }
        }
        return print;
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
function GetSVGFromCurrentPaperContext(){
    return paper.project.exportSVG();
}
function compileAndRun(canvas: HTMLCanvasElement, root: treeNode){

    //our own paper.Setup() because we want to overwrite, not append.
    if(paper.project){
        paper.project.clear();
    }else{
        paper.project = new paper.Project(canvas)
    }
    paper.project.addLayer(new paper.Layer())    

    let c = new paper.Path.Circle(paper.view.center,30)
    
    let environment = new Environment()

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
    environment.root.elementValue?.Render();

    return
}


function compile(node:treeNode, env: Environment){
    if(!node){
        throw new Error("Can't compile nothing!")
    }
    let c: RuntimeNode
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
                c = env.peek();
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
                }else{
                    throw new Error("Can't apply transformation to "+node.type.toString())
                }
            }
            
            break;
        case NodeType.Append:
            //add to current object.
            c = env.peek();
            if(c != null){
                if(c.type == RuntimeType.Procedure){
                    c.procudureValue?.pushStatement(node);
                }else if (c.type == RuntimeType.Element){
                    compile(node.children[0],env);
                    c.appendChildElement(env.active);
                }
            }else{
                throw new Error("Cannot Append Nothing")
            }
            break;
        case NodeType.Push:
            c = env.peek();
            if(c != null){
                if(c.type == RuntimeType.Procedure){
                    c.procudureValue?.pushStatement(node);
                    break;
                }
            }
            //else
            compile(node.children[0], env)
            env.push(env.active); 

            break;
        case NodeType.Pop:
            c = env.peek();
            if(c != null){
                if(c.type == RuntimeType.Procedure){
                    //count the number of pushes in procedure! 
                    if(c.procudureValue){
                        if(c.procudureValue.internalPushCount > 0){
                            c.procudureValue?.pushStatement(node);
                            break;
                        }
                    }
                }
            }
            //else
            env.pop();
            break;
        case NodeType.Flow:
            compileFlowStatement(node,env);
            break;
        case NodeType.Block:
            node.children.forEach(n=>{
                compile(n,env);
            })
            break;
        case NodeType.RawJS:
            //todo: rawJS is a hacky workaround to do inline math expressions without having to use node transformers for math (we don't have "normal" binary operators.)
            //eventually, i'll just write the inline math functions as shorthand for the pipeline flow. Maybe backticks for inline, or single quotes like right now.
            //for now, | * 3 will multiply the context by three, not the left by three.... 
            let expression = "'use strict';\n"+env.printJSFrame()+"\n"+node.id
            return eval?.(expression) 
            break;
        default: 
            console.log("unhandled:",node)
            break;
    }
    return node.id;
}

function compileFlowStatement(node: treeNode, env: Environment){
    let call: treeNode = node.children[0];
    let body: treeNode[] = node.children[1];
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
                body.forEach(s=>{
                    compile(s,env)
                })
            }
            env.popFrame();
            break;
        case "ifz":
        case "if-zero":
            //if zero
            let ifzl = call.children.length;
            if(ifzl != 1){
                throw new Error("ifz: wrong number arguments. need 1")
            }
            let test = parseInt(compile(call.children[0],env));
            if(test == 0){
                env.pushFrame()
                body.forEach(s=>{
                    compile(s,env)
                })
                env.popFrame();
            }
        break
        case "ifnz":
        case "if-not-zero":
            //if zero
            let ifnzl = call.children.length;
            if(ifnzl != 1){
                throw new Error("ifz: wrong number arguments. need 1")
            }
            let testnz = parseInt(compile(call.children[0],env));
            if(testnz != 0){
                env.pushFrame()
                body.forEach(s=>{
                    compile(s,env)
                })
                env.popFrame();
            }
        break
        case "ifpos":
        case "if-positive":
            //if zero
            let ifposl = call.children.length;
            if(ifposl != 1){
                throw new Error("ifz: wrong number arguments. need 1")
            }
            let testpos = parseInt(compile(call.children[0],env));
            if(testpos >= 0){
                env.pushFrame()
                body.forEach(s=>{
                    compile(s,env)
                })
                env.popFrame();
            }
        break
        case "ifneg":
        case "if-negative":
            //if zero
            let ifnegl = call.children.length;
            if(ifnegl != 1){
                throw new Error("ifz: wrong number arguments. need 1")
            }
            let testneg = parseInt(compile(call.children[0],env));
            if(testneg < 0){
                env.pushFrame()
                body.forEach(s=>{
                    compile(s,env)
                })
                env.popFrame();
            }
        break
        case "def":
        case "define":
            let def: treeNode[] = []
            
            //todo: we can do this with fewer lookups if we pass the procedure into compile instead of onto the stack.
            let name = call.children[0].id

            env.addAndPushDefinition(name,def)
            body.forEach(s=>{
                compile(s,env)
            })
            env.pop();
        break;
        default:
            throw new Error("Unknown control flow statement "+node.id)
        break;
    }
}

function compileStandaloneObjectStatement(node:treeNode, env: Environment){
    env.active = null;
    switch(node.id){
        case "group":
        case "g":
            env.active = CreateGroupNode()
            break;
        case "circle":
            //todo: boilerplate out the d element code.
            //setting radius inline is optional
            //var sig = getSignature(node.children.length,"circle");
            let sig = {}
            let path: paper.Path
            if(node.children.length == 1){
                let r = parseFloat(compile(node.children[0],env))
                path = new paper.Path.Circle(paper.view.center,r);

            }else if(node.children.length == 3){
                let x = parseFloat(compile(node.children[0],env))
                let y = parseFloat(compile(node.children[1],env))
                let r = parseFloat(compile(node.children[2],env))
                path = new paper.Path.Circle(new paper.Point(x,y),r);
            }else{
                throw new Error("Circle: bad number of arguments. Want 1 (r) or 3 (x y r)")
            }
            //todo: sig should return a properties: values object.
            //d.setAttribute("stroke",env.getDefault("stroke"))
            //d.setAttribute("fill",env.getDefault("fill"))
            //d.setAttribute("stroke-width", env.getDefault("stroke-width"))

            env.active = CreateElementNode(path)
            
            break;
        case "rect":

            // for(let i = 0;i<sig.length;i++){
            //     let attr = compile(node.children[i],env)
            //     if(attr != null ){
            //         let attrName = sig[i]
            //         if(attrName!= undefined){
            //             //d.setAttribute(attrName,attr);
            //         }else{
            //             throw new Error("bad signature check?")
            //         }
            //     }else{
            //         throw new Error("bad signature?");
            //     }
            // }
            
            let rect = new paper.Path.Rectangle(new Point(0,0),new Point(20,20))
           // d.setAttribute("x","0")
           // d.setAttribute("y","0")
           // d.setAttribute("stroke",env.getDefault("stroke"))
          //  d.setAttribute("fill",env.getDefault("fill"))
          //  d.setAttribute("stroke-width", env.getDefault("stroke-width"))
        
            env.active = CreateElementNode(rect)
            break;
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
            checkChildrenLengthForArgument(node,1)
            context.style["fillColor"] = new paper.Color(compile(node.children[0],env))
            break
        // case "radius":
        // case "r":
        //     checkChildrenLengthForArgument(node,1)
        //     let r = parseFloat(compile(node.children[0],env))
        //     if(context.type == RuntimeElementType.Path){
        //         let o = (context as RuntimeItem).item
        //         (context as RuntimeItem).item.path = new paper.Path.Circle({center: o.bounds.center, radius: r})
        //     }
        //     break;
        case "x":
            checkChildrenLengthForArgument(node,1)
            context.item.position.x = parseFloat(compile(node.children[0],env))
            break;
        case "y":
            checkChildrenLengthForArgument(node,1)
            context.item.position.y = parseFloat(compile(node.children[0],env))
            break;
        case "dx":
            checkChildrenLengthForArgument(node,1)
            context.item.position.x = context.item.position.x+parseFloat(compile(node.children[0],env))
            break;
        case "dy":
            checkChildrenLengthForArgument(node,1)
            context.item.position.y = context.item.position.y+parseFloat(compile(node.children[0],env))
            break;
        case "width":
            checkChildrenLengthForArgument(node,1)
            context.item.bounds.width = parseFloat(compile(node.children[0],env))
            break
        case "height":
            checkChildrenLengthForArgument(node,1)
            context.item.bounds.height = parseFloat(compile(node.children[0],env))
            break
        case "stroke-width":
        case "sw":
            checkChildrenLengthForArgument(node,1)
            context.style["strokeWidth"] = parseFloat(compile(node.children[0],env))
            break;
        case "stroke":
        case "stroke-color":
        case "sc":
            checkChildrenLengthForArgument(node,1)
            context.style["strokeColor"] = new paper.Color(compile(node.children[0],env))
            break;
        case "blendmode":
        case "bm":
            checkChildrenLengthForArgument(node,1)
            context.SetBlendMode(compile(node.children[0],env))
            break;
        case "opacity":
            checkChildrenLengthForArgument(node,1)
            let opacity = parseFloat(compile(node.children[0],env))
            //todo: validity check?
            context.opacity = opacity
            break
        case "transparency":
            checkChildrenLengthForArgument(node,1)
            let transparency = parseFloat(compile(node.children[0],env))
            //todo: validity check?
            //clamp 01.
            transparency = Math.max(0,Math.min(1,transparency))
            context.opacity = 1-transparency
            break
        default:
            throw new Error("Unknown Transformation "+node.id);
    }
}

function checkChildrenLengthForArgument(node: treeNode, length: number){
    if(node.children.length != 1){
        throw new Error("bad number of arguments for "+node.id)
    }
}


export{ compileAndRun, GetSVGFromCurrentPaperContext}