
import { Environment } from "./environment";
import { NodeType, treeNode, RuntimeNode, RuntimeElementType, CreateElementNode,CreateGroupNode, CreateNumberNode,CreateStringNode,RuntimeType, RuntimeElement } from "./ast";
import paper from "paper";
import { CreateWarning, PEvalError, PWarn } from "./pinchError";


function compileAndRun(canvas: HTMLCanvasElement, root: treeNode): Environment{

    //our own paper.Setup() because we want to overwrite, not append.
    if(paper.project){
        paper.project.clear();
    }else{
        paper.project = new paper.Project(canvas)
    }
    paper.project.addLayer(new paper.Layer())    
    
    let environment = new Environment()

    if(root.type != NodeType.Program){
        throw new PEvalError("RootIsNotProgram","invalid root object.", root)
    }
    root.children.forEach(child => {
        //@ts-ignore
        compile(child, environment);
    });
    performance.mark("compile-end")

    environment.stack.forEach((rt:RuntimeNode)=>{
        if(rt.type == RuntimeType.Element){
            rt.elementValue?.Render();
        }else{
            //CreateWarning("UnexpectedRuntimeItem","unexpeted item on the stack. Ignoring.",null,environment)
            console.warn("unexpeted item on the stack. Ignoring.",rt);
        }
    });

    return environment
}

function GetSVGFromCurrentPaperContext(){
    return paper.project.exportSVG();
}

function compile(node:treeNode, env: Environment): RuntimeNode{
    if(!node){
        throw new PEvalError("EmptyCompile","Can't compile nothing!", node)
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
            throw new PEvalError("UnknownID","Unknown symbol '"+node.id+"'.",node)
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
            let ctx = env.peek(node);
            if(ctx != null){
                if(ctx.type == RuntimeType.Procedure){
                    ctx.procudureValue?.statements.push(node);
                }else if (ctx.type == RuntimeType.Element){
                    node.children.forEach(x=>{
                        compileTransformation(x,env)
                    });
                }else{
                    throw new PEvalError("BadType","Can't apply transformation to "+node.type.toString(),node)
                }
            }
            
            break;
        case NodeType.Append:
            //add to current object.
            c = env.peek(node);
            if(c != null){
                if(c.type == RuntimeType.Procedure){
                    c.procudureValue?.pushStatement(node);
                }else if (c.type == RuntimeType.Element){
                    compile(node.children[0],env);
                    c.appendChildElement(env.active,node);
                }
            }else{
                throw new PEvalError("EmptyStack","Cannot Append Nothing", node)
            }
            break;
        case NodeType.Push:
            c = env.peek(node);
            if(c != null){
                if(c.type == RuntimeType.Procedure){
                    c.procudureValue?.pushStatement(node);
                    break;
                }
            }
            //else
            compile(node.children[0], env)
            env.push(env.active,node); 
            break;
        case NodeType.Pop:
            c = env.peek(node);
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
                    env.active = env.pop(node);
                }
            }else if(node.children.length == 2){

                let poppedChilds = []
                //pop the number of dots and shove em into a list for us to use...
                for(let pops = 0;pops<node.children[0];pops++){
                    env.active = env.pop(node)
                    poppedChilds.push(env.active);
                }
                compilePopStatement(node.children[1],poppedChilds,env);
            }else{
                throw new PEvalError("EmptyStack","Parsing error? bad number children for pop statement.", node)
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
        case NodeType.EnvironmentProperty:
            compileEnvironmentProperty(node,env);
            break;
        default: 
            throw new PEvalError("UnknownID","unable to compile node: '"+node.id+"'. node is type "+NodeType[node.type], node)
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
                throw new PEvalError("BadArgs","repeat: wrong number arguments. need at least 1", node)
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
                throw new PEvalError("BadArgs","repeat: wrong number arguments. got too many.", node)
            }

            if(step == 0){
                throw new PEvalError("BadArgs","repeat: step cannot be 0.", node)
            } else if(start > end && step > 0){
                throw new PEvalError("BadArgs","repeat: step moves away from end.", node)
            }else if(start < end && step < 0){
                throw new PEvalError("BadArgs","repeat: step moves away from end.", node)
            }else if(start == end){
                //todo: how to highlight start and end nodes. We don't track if they are child 1, 2, or 3. pWarn doesn't accept them.
               CreateWarning("UselessOp","Repeat Block Start and end are the same? Nothing will happen.", node,env)
            }

            env.pushFrame(node)
            env.addToStackMeta = true
            for(let i = start;i<end;i+=step){
                env.setLocal(label,CreateNumberNode(i),node);
                body.forEach(s=>{
                    compile(s,env)
                })
                if(env.addToStackMeta){
                    env.addToStackMeta = false;
                }
            }
            env.addToStackMeta = true
            env.popFrame(node);
            break;
        case "ifz":
        case "if-zero":
            //if zero
            let ifzl = call.children.length;
            if(ifzl != 1){
                throw new PEvalError("BadArgs","ifz: wrong number arguments. need 1", node)
            }
            let test = compile(call.children[0],env).getNumberValue();
            if(test == 0){
                env.pushFrame(node)
                body.forEach(s=>{
                    compile(s,env)
                })
                env.popFrame(node);
            }
        break
        case "ifnz":
        case "if-not-zero":
            //if zero
            let ifnzl = call.children.length;
            if(ifnzl != 1){
                throw new PEvalError("BadArgs","ifz: wrong number arguments. need 1", node)
            }
            let testnz = compile(call.children[0],env).getNumberValue();
            if(testnz != 0){
                env.pushFrame(node)
                body.forEach(s=>{
                    compile(s,env)
                })
                env.popFrame(node);
            }
        break
        case "ifpos":
        case "if-positive":
            //if zero
            let ifposl = call.children.length;
            if(ifposl != 1){
                throw new PEvalError("BadArgs","ifz: wrong number arguments. need 1", node)
            }
            let testpos = compile(call.children[0],env).getNumberValue();
            if(testpos >= 0){
                env.pushFrame(node)
                body.forEach(s=>{
                    compile(s,env)
                })
                env.popFrame(node);
            }
        break
        case "ifneg":
        case "if-negative":
            //if zero
            let ifnegl = call.children.length;
            if(ifnegl != 1){
                throw new PEvalError("BadArgs","ifz: wrong number arguments. need 1", node)
            }
            let testneg = compile(call.children[0],env).getNumberValue();
            if(testneg < 0){
                env.pushFrame(node)
                body.forEach(s=>{
                    compile(s,env)
                })
                env.popFrame(node);
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
                throw new PEvalError("BadArgs","Procedure @arguments must all have unique names.", node)
            }
   
            env.addAndPushDefinition(name,def,argDefs,call)
            body.forEach(s=>{
                compile(s,env)
            })
            env.pop(node);
        break;
        default:
            throw new PEvalError("UnknownID","Unknown control flow statement "+node.id, node)
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
                throw new PEvalError("BadArgs","Circle: bad number of arguments. Want 1 (r) or 3 (x y r)",node)
            }
            //todo: sig should return a properties: values object.
            //d.setAttribute("stroke",env.getDefault("stroke"))
            //d.setAttribute("fill",env.getDefault("fill"))
            //d.setAttribute("stroke-width", env.getDefault("stroke-width"))

            env.active = CreateElementNode(path)
            
            break;
        case "square":
            if(node.children.length == 1){
                let size = compile(node.children[0],env).getNumberValue()
                let tr = new paper.Point(paper.view.center.x-size/2,paper.view.center.y-size/2)
                let s = new paper.Size(size,size)
                path = new paper.Path.Rectangle(tr,s);
            }else{
                throw new PEvalError("BadArgs","Square: bad number of arguments. Want 1 (size)", node)
            }
            break;

        case "rect":
        if(node.children.length == 1){
            let size = compile(node.children[0],env).getNumberValue()
            let tr = new paper.Point(paper.view.center.x-size/2,paper.view.center.y-size/2)
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
            throw new PEvalError("BadArgs","Rect: bad number of arguments. Want 1 (square-size) or 2 (width height) or 4 (x y width height)", node)
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
                throw new PEvalError("BadArgs","Line: bad number of arguments. Want 4 (x1 y1 x2 y2)", node)
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
                throw new PEvalError("BadArgs","Line: bad number of arguments. Want 2 (sides radius) or 4 (x y sides radius)", node)
            }
            env.active = CreateElementNode(path);
        break;
        case "text":
            throw new PEvalError("Unsupported","Text is not yet supported! Working on it!", node)

            if(node.children.length == 1){
                let content = compile(node.children[0],env)
                let textitem = new paper.PointText(paper.view.center);
                //textitem.content = content;
                //env.active = CreateElementNode(textitem);

            }else if(node.children.length == 3){
                let x = compile(node.children[0],env).getNumberValue()
                let y = compile(node.children[1],env).getNumberValue()
                let content = compile(node.children[2],env)
                let a = new paper.Point(x,y)
                let textitem = new paper.PointText(a);
                //textitem.content = content;
                //env.active = CreateElementNode(textitem);
            }
            else{
                throw new PEvalError("BadArgs","Text: bad number of arguments. Want 1 (text) or 3 (x y text)", node)
            }
            break
        default:
            //def lookup!            
            if(!tryRunDefinitionLookup(node,env)){
                throw new PEvalError("BadID","Unknown standalone object statement: "+node.id, node);
            }
        }
}

function compileTransformation(node:treeNode, env: Environment){
    let contextNode = env.peek(node)
    if(contextNode.type != RuntimeType.Element){
        throw new PEvalError("BadArgs","Can't compile context on type "+contextNode.type.toString()+". Groups not yet supported.", node)
    }
    let context = contextNode.elementValue;
    if(context == null || context == undefined){
        return;
    }
    switch(node.id){
        case "fill":
            checkChildrenLengthForArgument(node,1)
            context.style["fillColor"] = compileColorFromSingleNode(node.children[0],env)
            break
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
        case "rotate":
            checkChildrenLengthForArgument(node,1)
            if(context.type == RuntimeElementType.Path){
                context.item.rotate(compile(node.children[0],env).getNumberValue())
            }else{
                throw new PEvalError("BadContext", "Rotations on groups not supported (yet).",node);
            }
            break;
        case "ra":
        case "rotate-around":
                checkChildrenLengthForArgument(node,3)
                if(context.type == RuntimeElementType.Path){
                    let r = compile(node.children[0],env).getNumberValue()
                    let x = compile(node.children[1],env).getNumberValue()
                    let y = compile(node.children[2],env).getNumberValue()
                    context.item.rotate(r, new paper.Point(x,y))
                }else{
                    throw new PEvalError("BadContext", "Rotations on groups not supported (yet).",node);
                }
            break;
        case "pivotg":
        case "pivot-global":
                checkChildrenLengthForArgument(node,2)
                let x = compile(node.children[0],env).getNumberValue()
                let y = compile(node.children[1],env).getNumberValue()
                context.item.pivot = new paper.Point(x,y)
            break;
        case "pivot":
            if(node.children.length === 1){
                let p = compilePivotPointFromSingleNode(node.children[0],context, env)
                context.item.pivot = p
            }else if(node.children.length === 2){
                checkChildrenLengthForArgument(node,2)
                let pivx = compile(node.children[0],env).getNumberValue()
                let pivy = compile(node.children[1],env).getNumberValue()
                //lerp functions
                pivx =  context.item.bounds.left * (1 - pivx) + context.item.bounds.right * pivx;
                pivy =  context.item.bounds.top * (1 - pivy) + context.item.bounds.bottom * pivy;
                context.item.pivot = (new paper.Point(pivx,pivy))
            }else{
                throw new PEvalError("BadArgs", "Pivot: Invalid arguments. Want 1 (keyword, e.g. 'topleft' 'rightmiddle' 'center') or 2 args (%x %y)",node);
            }
        break;
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
            context.SetBlendMode(compileBlendmodeFromSingleNode(node.children[0], env), node.children[0])
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
            throw new PEvalError("UnknownID","Unknown Transformation "+node.id, node);
    }
}

function compilePopStatement(node: treeNode ,args: RuntimeNode[], env: Environment){
    switch(node.id){
        case "subtract":
            doBooleanOp("subtract",args,env,node);
        break;
        case "intersect":
            doBooleanOp("intersect",args,env,node);
        break;
        case "exclude":
            doBooleanOp("exclude",args,env,node);
        break;
        case "unite":
            doBooleanOp("unite",args,env,node);
            // a pop operator also pushes back to the stack.
        break;
        case "divide":
            doBooleanOp("divide",args,env,node);
            break;
            // a pop operator also pushes back to the stack.
        break;
        case "append":
            if(args.length != 1){
                throw new PEvalError("BadArgs","Append popop must have 2 elements e.g:(.append)", node)
            }
            let appe = args[0]
            if(!appe){
                throw new PEvalError("BadStack","invalid runtime node", node)
            }
            
            //new path item, now replace a.
            //env.peek().elementValue.item = path;
            env.peek(node).appendChildElement(appe,node)
            // a pop operator also pushes back to the stack.
        break;
        default:
            throw new PEvalError("UnknownID","Unknown Pop Statement "+node.id, node)
    }
}

function compileEnvironmentProperty(node: treeNode, env: Environment){
    switch(node.id){
        case "width":
            checkChildrenLengthForArgument(node,1);
            let w = compile(node.children[0],env).getNumberValue()
            env.width = w;
            paper.view.viewSize.width = w;
            break
        case "height":
            checkChildrenLengthForArgument(node,1);
            let h = compile(node.children[0],env).getNumberValue()
            env.height = h;
            paper.view.viewSize.height = h;
        break;
        default:
            throw new PEvalError("UnknownID","Unknown Environment Property "+node.id,node);
    }
}

function doBooleanOp(op: string, args: RuntimeNode[], env: Environment, node: treeNode){
    let path: paper.PathItem
    if(args.length == 1){                    
        let ae = args[0]?.elementValue
        let be = env.peek(node).elementValue
        if(!ae || !be){
            throw new PEvalError("BadStack","invalid runtime node",node)
        }
        if(ae.type != RuntimeElementType.Path || be.type != RuntimeElementType.Path){
            throw new PEvalError("BadStack","Cannot perform boolean on group (yet)",node);
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
                throw new PEvalError("UnknownID","unsupported pop operation "+op,node);
        }
        
        be.item = path
        //env.active = CreateElementNode(path)
    }else if(args.length == 2){
            
        let ae = args[0]?.elementValue
        let be = args[1]?.elementValue
        if(!ae || !be){
            throw new PEvalError("BadStack","invalid runtime node",node)
        }
        if(ae.type != RuntimeElementType.Path || be.type != RuntimeElementType.Path){
            throw new PEvalError("BadStack","Cannot perform boolean on group (yet)",node);
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
                throw new PEvalError("BadStack","unsupported pop operation "+op,node);
        }

        //new path item, now replace a.
        //env.peek().elementValue.item = path;
        env.active = CreateElementNode(path)
    }else{
        //if we only have one argument, it could modify the prior object, while two will pop both, subtract them, set active.
        throw new PEvalError("BadArgs",op+" boolean popop must pop 1 (."+op+", modifies top) or 2 (.."+op+", creates new) stack arguments",node)
    }
}

function tryRunDefinitionLookup(node: treeNode, env:Environment):boolean{
    const id = node.id;
    if(env.hasDefinition(id)){
        let proc = env.getDefinition(id,node)

        env.pushFrame(node);
        //set local variables
        for(let i = 0;i<proc.argNames.length;i++){
            let id = proc.argNames[i];
            if(id){
                env.setLocal(id, compile(node.children[i],env),node)
            }
        }
        //run body
        proc.statements.forEach(x=>{
            compile(x,env);
        });

        env.popFrame(node);
        return true
    }
    return false
}

function compileColorFromSingleNode(node:treeNode, env:Environment):paper.Color{
    if(node.id == "")
    {
        throw new PEvalError("BadID","Can't get color, bad input",node)
    }

    if(node.type == NodeType.String){
        return new paper.Color(node.id)
    }

    if(node.type == NodeType.Identifier){
        let local = env.getLocalOrNull(node.id);
        if(local){
        return new paper.Color(local.getStringValue())
        }
        var s = node.id
        return new paper.Color(s);
    }

    throw new PEvalError("BadType","Can't get color from node "+node.id,node)   
}

const validBlendModes = ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'color-burn', 'darken', 'lighten', 'difference', 'exclusion', 'hue', 'saturation', 'luminosity', 'color', 'add', 'subtract', 'average', 'pin-light', 'negation', 'source-over', 'source-in', 'source-out', 'source-atop', 'destination-over', 'destination-in', 'destination-out', 'destination-atop', 'lighter', 'darker', 'copy', 'xor']
function compileBlendmodeFromSingleNode(node:treeNode, env:Environment):string{
    let s: string = node.id
    if(node.id == "")
    {
        throw new PEvalError("BadID","bad input for blendmode (empty)",node)
    }

    if(node.type == NodeType.Identifier){
        
        let local = env.getLocalOrNull(node.id);
        if(local){
            s = local.getStringValue() 
        }
    }
    
    let sl = s.toLowerCase()
    if(sl != s){
        CreateWarning("UseLowercase","Identifiers should be all lowercase",node,env)
    }
    if(validBlendModes.includes(sl)){
       return sl
     }
    
    throw new PEvalError("BadType",s +" is not a valid blendmode.", node)   
}

function compilePivotPointFromSingleNode(node:treeNode, context: RuntimeElement, env:Environment):paper.Point{
    let s: string = node.id
    if(node.id == "")
    {
        throw new PEvalError("BadID","bad input for pivot point (empty)",node)
    }

    if(node.type == NodeType.Identifier){
        let local = env.getLocalOrNull(node.id);
        if(local){
            s = local.getStringValue() 
        }
    }

    let sl = s.toLowerCase()
    if(sl != s){
        CreateWarning("UseLowercase","PivotPoint symbols should be all lowercase",node,env)
    }
    switch(sl){
        case "center":
        case "c":
        case "middlemiddle":
        case "mm":
            return context.item.bounds.center;
        case "topleft":
        case "tl":
            return context.item.bounds.topLeft;
        case "topmiddle":
        case "tm":
        case "topcenter":
        case "tc":
            return context.item.bounds.topCenter;
        case "topright":
        case "tr":
            return context.item.bounds.topRight;
        case "middleleft":
        case "ml":
        case "centerleft":
        case "cl":
            return context.item.bounds.leftCenter;
        case "middleright":
        case "mr":
        case "centerright":
        case "cr":
            return context.item.bounds.rightCenter;
        case "bottomleft":
        case "bl":
            return context.item.bounds.bottomLeft;
        case "bottommiddle":
        case "bm":
        case "bottomcenter":
        case "bc":
            return context.item.bounds.bottomCenter;
        case "bottomright":
        case "br":
            return context.item.bounds.bottomRight;
        default:
            throw new PEvalError("BadType","'"+s +"' is not a valid bounds position.", node)
    }
}

function checkChildrenLengthForArgument(node: treeNode, length: number){
    if(node.children.length != length){
        throw new PEvalError("ArgCount","bad number of arguments for "+node.id+". Expected 1, got "+node.children.length, node)
    }
}

export{ compileAndRun, GetSVGFromCurrentPaperContext}