
import { Environment } from "./environment";
import { NodeType, treeNode, RuntimeNode, RuntimeElementType, CreateElementNode,CreateGroupNode, CreateNumberNode,CreateStringNode,RuntimeType } from "./ast";
import paper from "paper";
import { PEvalError } from "./pinchError";

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
        throw new PEvalError("RootIsNotProgram","invalid root object.")
    }
    root.children.forEach(child => {
        //@ts-ignore
        compile(child, environment);
    });
    performance.mark("compile-end")

    environment.stack.forEach((rt:RuntimeNode)=>{
        rt.elementValue?.Render();
    });

    return
}

function GetSVGFromCurrentPaperContext(){
    return paper.project.exportSVG();
}

function compile(node:treeNode, env: Environment): RuntimeNode{
    if(!node){
        throw new PEvalError("EmptyCompile","Can't compile nothing!")
    }
    let c: RuntimeNode
    switch(node.type){
        case NodeType.Number:
            return CreateNumberNode(parseFloat(node.id));
        case NodeType.String:
            return CreateStringNode(node.id);
        case NodeType.Identifier:
            let local = env.getLocalOrNull(node.id);
            if(local){
                return local
            }
            console.log("unable to get local for "+node.id+". treating as string instead.");
            return CreateStringNode(node.id)
        case NodeType.ObjectStatement:
            compileStandaloneObjectStatement(node,env) 
            //append! let empty object statements be equivalent to append.
            //todo: i want to move that logic to the lexer.
            // if(env.active != null){
            //     c = env.peek();
            //     if(c != null){
            //         //todo: we should push 
            //         c.appendChildElement(env.active)
            //     }
            // }   
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
                throw new PEvalError("EmptyStack","Cannot Append Nothing")
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
            //normal pop with no command next to it.
            if(node.children.length == 1){
                //pop the number of dots.
                for(let pops = 0;pops<node.children[0];pops++){
                    env.pop();
                }
            }else if(node.children.length == 2){

                let poppedChilds = []
                //pop the number of dots and shove em into a list for us to use...
                for(let pops = 0;pops<node.children[0];pops++){
                    poppedChilds.push(env.pop());
                }
                compilePopStatement(node.children[1],poppedChilds,env);
            }else{
                throw new PEvalError("EmptyStack","Parsing error? bad number children for pop statement.")
            }
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
            throw new PEvalError("UnknownID","unable to compile node: '"+node.id+"'. node is type "+NodeType[node.type])
        break;
    }
}

function compileFlowStatement(node: treeNode, env: Environment){
    let call: treeNode = node.children[0];
    let body: treeNode[] = node.children[1];
    switch(call.id){
        case "repeat":
            let l = call.children.length;
            if(l < 1){
                throw new PEvalError("BadArgs","repeat: wrong number arguments. need at least 1")
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
                end = compile(call.children[argi],env).getNumberValue();
            } else if(l == 2){
                start = compile(call.children[argi+0],env).getNumberValue();
                end = compile(call.children[argi+1],env).getNumberValue();
            }else if(l == 3){
                start = compile(call.children[argi+0],env).getNumberValue();
                end = compile(call.children[argi+1],env).getNumberValue();
                step = compile(call.children[argi+2], env).getNumberValue();
            }else{
                throw new PEvalError("BadArgs","repeat: wrong number arguments. got too many.")
            }

            if(step == 0){
                throw new PEvalError("BadArgs","repeat: step cannot be 0.")
            } else if(start > end && step > 0){
                throw new PEvalError("BadArgs","repeat: step moves away from end.")
            }else if(start < end && step < 0){
                throw new PEvalError("BadArgs","repeat: step moves away from end.")
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
                throw new PEvalError("BadArgs","ifz: wrong number arguments. need 1")
            }
            let test = compile(call.children[0],env).getNumberValue();
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
                throw new PEvalError("BadArgs","ifz: wrong number arguments. need 1")
            }
            let testnz = compile(call.children[0],env).getNumberValue();
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
                throw new PEvalError("BadArgs","ifz: wrong number arguments. need 1")
            }
            let testpos = compile(call.children[0],env).getNumberValue();
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
                throw new PEvalError("BadArgs","ifz: wrong number arguments. need 1")
            }
            let testneg = compile(call.children[0],env).getNumberValue();
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
            let argDefs = [];
            for(let a = 1;a<call.children.length;a++){
                if(call.children[a].type == NodeType.Label){
                    argDefs.push(call.children[a].id);
                }
            }
            const setDefs = new Set(argDefs);

            if(argDefs.length !== setDefs.size){
                throw new PEvalError("BadArgs","Procedure @arguments must all have unique names.")
            }
   
            env.addAndPushDefinition(name,def,argDefs)
            body.forEach(s=>{
                compile(s,env)
            })
            env.pop();
        break;
        default:
            throw new PEvalError("UnknownID","Unknown control flow statement "+node.id)
        break;
    }
}

function compileStandaloneObjectStatement(node:treeNode, env: Environment){
    env.active = null;
    let path: paper.Path
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
            if(node.children.length == 1){
                let r = compile(node.children[0],env).getNumberValue()
                path = new paper.Path.Circle(paper.view.center,r);

            }else if(node.children.length == 3){
                let x = compile(node.children[0],env).getNumberValue()
                let y = compile(node.children[1],env).getNumberValue()
                let r = compile(node.children[2],env).getNumberValue()
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

        if(node.children.length == 1){
            let size = compile(node.children[0],env).getNumberValue()
            let tr = new paper.Point(paper.view.center.x-size/2,paper.view.center.y+size/2)
            let s = new paper.Size(size,size)
            path = new paper.Path.Rectangle(tr,s);
            
        }else if(node.children.length == 2){
            let width = compile(node.children[0],env).getNumberValue()
            let height = compile(node.children[1],env).getNumberValue()
            let tr = new paper.Point(paper.view.center.x-width/2,paper.view.center.y+height/2)
            let bl = new paper.Point(paper.view.center.x+width/2,paper.view.center.y-height/2)
            path = new paper.Path.Rectangle(tr,bl);

        }else if(node.children.length == 4){
            let x = compile(node.children[0],env).getNumberValue()
            let y = compile(node.children[1],env).getNumberValue()
            let w = compile(node.children[2],env).getNumberValue()
            let h = compile(node.children[3],env).getNumberValue()
            let pos = new paper.Point(x,y)
            let s = new paper.Size(w,h)
            path = new paper.Path.Rectangle(pos,s);

        }else{
            throw new PEvalError("BadArgs","Rect: bad number of arguments. Want 1 (square size) or 2 (width height) or 4 (x y width height)")
        }
            
        env.active = CreateElementNode(path)

            break;
        case "line":
            if(node.children.length == 4){
                let x1 = compile(node.children[0],env).getNumberValue()
                let y1 = compile(node.children[1],env).getNumberValue()
                let x2 = compile(node.children[2],env).getNumberValue()
                let y2 = compile(node.children[3],env).getNumberValue()
                let a = new paper.Point(x1,y1)
                let b = new paper.Point(x2,y2)
                path = new paper.Path.Line(a,b);
            }else{
                throw new PEvalError("BadArgs","Line: bad number of arguments. Want 4 (x1 y1 x2 y2)")
            }
            env.active = CreateElementNode(path);
        break;
        case "polygon":
            if(node.children.length == 2){
                let sides = compile(node.children[0],env).getNumberValue()
                let radius = compile(node.children[1],env).getNumberValue()
                path = new paper.Path.RegularPolygon(paper.view.center,sides,radius);
            }else if(node.children.length == 4){
                let x = compile(node.children[0],env).getNumberValue()
                let y = compile(node.children[1],env).getNumberValue()
                let sides = compile(node.children[2],env).getNumberValue()
                let radius = compile(node.children[3],env).getNumberValue()
                let a = new paper.Point(x,y)
                path = new paper.Path.RegularPolygon(a,sides,radius);
            }
            else{
                throw new PEvalError("BadArgs","Line: bad number of arguments. Want 2 (sides radius) or 4 (x y sides radius)")
            }
            env.active = CreateElementNode(path);
        break;
        case "text":
            if(node.children.length == 1){
                let content = compile(node.children[0],env)
                let textitem = new paper.PointText(paper.view.center);
               // textitem.content = content;
                //env.active = CreateElementNode(textitem);

            }else if(node.children.length == 3){
                let x = compile(node.children[0],env).getNumberValue()
                let y = compile(node.children[1],env).getNumberValue()
                let content = compile(node.children[2],env)
                let a = new paper.Point(x,y)
                let textitem = new paper.PointText(a);
              //  textitem.content = content;
                //env.active = CreateElementNode(textitem);
            }
            else{
                throw new PEvalError("BadArgs","Text: bad number of arguments. Want 1 (text) or 3 (x y text)")
            }
            break
        default:
            //def lookup!            
            if(!tryRunDefinitionLookup(node,env)){
                console.log("Warning. Unknown standalone object statement "+node.id)
            }
        }
    //
}

function compileTransformation(node:treeNode, env: Environment){
    let contextNode = env.peek()
    if(contextNode.type != RuntimeType.Element){
        throw new PEvalError("BadArgs","Can't compile context on type "+contextNode.type.toString()+". Groups not yet supported.")
    }
    let context = contextNode.elementValue;
    if(context == null || context == undefined){
        return;
    }
    switch(node.id){
        case "fill":
            checkChildrenLengthForArgument(node,1)
            context.style["fillColor"] = new paper.Color(compile(node.children[0],env).getStringValue())
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
            context.item.position.x = compile(node.children[0],env).getNumberValue();
            break;
        case "y":
            checkChildrenLengthForArgument(node,1)
            context.item.position.y = compile(node.children[0],env).getNumberValue()
            break;
        case "dx":
            checkChildrenLengthForArgument(node,1)
            context.item.position.x = context.item.position.x+compile(node.children[0],env).getNumberValue()
            break;
        case "dy":
            checkChildrenLengthForArgument(node,1)
            context.item.position.y = context.item.position.y+compile(node.children[0],env).getNumberValue()
            break;
        case "width":
            checkChildrenLengthForArgument(node,1)
            context.item.bounds.width = compile(node.children[0],env).getNumberValue()
            break
        case "height":
            checkChildrenLengthForArgument(node,1)
            context.item.bounds.height = compile(node.children[0],env).getNumberValue()
            break
        case "stroke-width":
        case "sw":
            checkChildrenLengthForArgument(node,1)
            context.style["strokeWidth"] = compile(node.children[0],env).getNumberValue()
            break;
        case "stroke":
        case "stroke-color":
        case "sc":
            checkChildrenLengthForArgument(node,1)
            context.style["strokeColor"] = new paper.Color(compile(node.children[0],env).getStringValue())
            break;
        case "blendmode":
        case "bm":
            checkChildrenLengthForArgument(node,1)
            context.SetBlendMode(compile(node.children[0],env).getStringValue())
            break;
        case "opacity":
            checkChildrenLengthForArgument(node,1)
            let opacity = compile(node.children[0],env).getNumberValue()
            //todo: validity check?
            context.opacity = opacity
            break
        case "transparency":
            checkChildrenLengthForArgument(node,1)
            let transparency = compile(node.children[0],env).getNumberValue()
            //todo: validity check?
            //clamp 01.
            transparency = Math.max(0,Math.min(1,transparency))
            context.opacity = 1-transparency
            break
        default:
            throw new PEvalError("UnknownID","Unknown Transformation "+node.id);
    }
}

function compilePopStatement(node: treeNode ,args: RuntimeNode[], env: Environment){
    switch(node.id){
        case "subtract":
            doBooleanOp("subtract",args,env);
        break;
        case "intersect":
            doBooleanOp("intersect",args,env);
        break;
        case "exclude":
            doBooleanOp("exclude",args,env);
        break;
        case "unite":
            doBooleanOp("unite",args,env);
            // a pop operator also pushes back to the stack.
        break;
        case "divide":
            doBooleanOp("divide",args,env);
            break;
            // a pop operator also pushes back to the stack.
        break;
        case "append":
            if(args.length != 1){
                throw new PEvalError("BadArgs","Append popop must have 2 elements e.g:(.append)")
            }
            let appe = args[0]
            if(!appe){
                throw new PEvalError("BadStack","invalid runtime node")
            }
            
            //new path item, now replace a.
            //env.peek().elementValue.item = path;
            env.peek().appendChildElement(appe)
            // a pop operator also pushes back to the stack.
        break;
        default:
            throw new PEvalError("UnknownID","Unknown Pop Statement "+node.id)
    }
}

function doBooleanOp(op: string, args: RuntimeNode[], env: Environment){
    let path: paper.PathItem
    if(args.length == 1){                    
        let ae = args[0]?.elementValue
        let be = env.peek().elementValue
        if(!ae || !be){
            throw new PEvalError("BadStack","invalid runtime node")
        }
        if(ae.type != RuntimeElementType.Path || be.type != RuntimeElementType.Path){
            throw new PEvalError("BadStack","Cannot perform boolean on group (yet)");
        }
        let a = ae.item as paper.PathItem
        let b = be.item as paper.PathItem
        
        switch(op){
            case "intersect":
                path = a.intersect(b);
            break;
            case "subtract":
                path = b.subtract(a);
            break;
            case "divide":
                path = b.divide(a);
                break;
            case "unite":
                path = a.unite(b);
                break;
            case "exclude":
                path = a.exclude(b);
                break;
            default:
                throw new PEvalError("UnknownID","unsupported pop operation "+op);
        }
        
        be.item = path
        //env.active = CreateElementNode(path)
    }else if(args.length == 2){
            
        let ae = args[0]?.elementValue
        let be = args[1]?.elementValue
        if(!ae || !be){
            throw new PEvalError("BadStack","invalid runtime node")
        }
        if(ae.type != RuntimeElementType.Path || be.type != RuntimeElementType.Path){
            throw new PEvalError("BadStack","Cannot perform boolean on group (yet)");
        }
        let a = ae.item as paper.Path
        let b = be.item as paper.Path
        
        switch(op){
            case "intersect":
                path = a.intersect(b);
            break;
            case "subtract":
                path = b.subtract(a);
            break;
            case "divide":
                path = b.divide(a);
                break;
            case "unite":
                path = a.unite(b);
                break;
            case "exclude":
                path = a.exclude(b);
                break;
            default:
                throw new PEvalError("BadStack","unsupported pop operation "+op);
        }

        //new path item, now replace a.
        //env.peek().elementValue.item = path;
        env.active = CreateElementNode(path)
    }else{
        //if we only have one argument, it could modify the prior object, while two will pop both, subtract them, set active.
        throw new PEvalError("BadArgs",op+" boolean popop must pop 1 (."+op+", modifies top) or 2 (.."+op+", creates new) stack arguments")
    }
}

function tryRunDefinitionLookup(node: treeNode, env:Environment):boolean{
    const id = node.id;
    if(env.hasDefinition(id)){
        let proc = env.getDefinition(id)

        env.pushFrame();
        //set local variables
        for(let i = 0;i<proc.argNames.length;i++){
            let id = proc.argNames[i];
            if(id){
                env.setLocal(id, compile(node.children[i],env))
            }
        }
        RuntimeNode
        //run body
        proc.statements.forEach(x=>{
            compile(x,env);
        });

        env.popFrame();

        return true
    }
    return false
}

function checkChildrenLengthForArgument(node: treeNode, length: number){
    if(node.children.length != 1){
        throw new PEvalError("ArgCount","bad number of arguments for ")
    }
}


export{ compileAndRun, GetSVGFromCurrentPaperContext}