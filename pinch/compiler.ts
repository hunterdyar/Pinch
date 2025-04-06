
import { Environment } from "./environment";
import { NodeType, treeNode, RuntimeNode, RuntimeElementType, CreateElementNode,CreateGroupNode, CreateNumberNode, RuntimeType } from "./ast";
import paper from "paper";

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
    performance.mark("compile-end")

    environment.stack.forEach((rt:RuntimeNode)=>{
        console.log("render stack", rt);
        rt.elementValue?.Render();
    });

    return
}

function GetSVGFromCurrentPaperContext(){
    return paper.project.exportSVG();
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
                    console.log(env.active)
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
                throw new Error("Parsing error? bad number children for pop statement.")
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

        if(node.children.length == 1){
            let size = parseFloat(compile(node.children[0],env))
            let tr = new paper.Point(paper.view.center.x-size/2,paper.view.center.y+size/2)
            let s = new paper.Size(size,size)
            path = new paper.Path.Rectangle(tr,s);
            
        }else if(node.children.length == 2){
            let width = parseFloat(compile(node.children[0],env))
            let height = parseFloat(compile(node.children[1],env))
            let tr = new paper.Point(paper.view.center.x-width/2,paper.view.center.y+height/2)
            let bl = new paper.Point(paper.view.center.x+width/2,paper.view.center.y-height/2)
            path = new paper.Path.Rectangle(tr,bl);

        }else if(node.children.length == 4){
            let x = parseFloat(compile(node.children[0],env))
            let y = parseFloat(compile(node.children[1],env))
            let w = parseFloat(compile(node.children[2],env))
            let h = parseFloat(compile(node.children[3],env))
            let pos = new paper.Point(x,y)
            let s = new paper.Size(w,h)
            path = new paper.Path.Rectangle(pos,s);

        }else{
            throw new Error("Rect: bad number of arguments. Want 1 (square size) or 2 (width height) or 4 (x y width height)")
        }
            
        env.active = CreateElementNode(path)

            break;
        case "line":
            if(node.children.length == 4){
                let x1 = parseFloat(compile(node.children[0],env))
                let y1 = parseFloat(compile(node.children[1],env))
                let x2 = parseFloat(compile(node.children[2],env))
                let y2 = parseFloat(compile(node.children[3],env))
                let a = new paper.Point(x1,y1)
                let b = new paper.Point(x2,y2)
                path = new paper.Path.Line(a,b);
            }else{
                throw new Error("Line: bad number of arguments. Want 4 (x1 y1 x2 y2)")
            }
            env.active = CreateElementNode(path);
        break;
        case "polygon":
            if(node.children.length == 2){
                let sides = parseFloat(compile(node.children[0],env))
                let radius = parseFloat(compile(node.children[1],env))
                path = new paper.Path.RegularPolygon(paper.view.center,sides,radius);
            }else if(node.children.length == 4){
                let x = parseFloat(compile(node.children[0],env))
                let y = parseFloat(compile(node.children[1],env))
                let sides = parseFloat(compile(node.children[2],env))
                let radius = parseFloat(compile(node.children[3],env))
                let a = new paper.Point(x,y)
                path = new paper.Path.RegularPolygon(a,sides,radius);
            }
            else{
                throw new Error("Line: bad number of arguments. Want 2 (sides radius) or 4 (x y sides radius)")
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
                let x = parseFloat(compile(node.children[0],env))
                let y = parseFloat(compile(node.children[1],env))
                let content = compile(node.children[2],env)
                let a = new paper.Point(x,y)
                let textitem = new paper.PointText(a);
              //  textitem.content = content;
                //env.active = CreateElementNode(textitem);
            }
            else{
                throw new Error("Text: bad number of arguments. Want 1 (text) or 3 (x y text)")
            }
            break
        default:
            //def lookup!            
            if(!tryRunDefinitionLookup(node.id,env)){
                console.log("Warning. Unknown standalone object statement "+node.id)
            }
        }
    //
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

function compilePopStatement(node: treeNode ,args: RuntimeNode[], env: Environment){
    console.log("pop statement",node.id, args)
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
                throw new Error("Append popop must have 2 elements e.g:(.append)")
            }
            let appe = args[0]
            if(!appe){
                throw new Error("invalid runtime node")
            }
            
            //new path item, now replace a.
            //env.peek().elementValue.item = path;
            env.peek().appendChildElement(appe)
            // a pop operator also pushes back to the stack.
        break;
        default:
            throw new Error("Unknown Pop Statement "+node.id)
    }
}

function doBooleanOp(op: string, args: RuntimeNode[], env: Environment){
    let path: paper.PathItem
    if(args.length == 1){                    
        let ae = args[0]?.elementValue
        let be = env.peek().elementValue
        if(!ae || !be){
            throw new Error("invalid runtime node")
        }
        if(ae.type != RuntimeElementType.Path || be.type != RuntimeElementType.Path){
            throw new Error("Cannot perform boolean on group (yet)");
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
                throw new Error("unsupported pop operation "+op);
        }
        
        be.item = path
        //env.active = CreateElementNode(path)
    }else if(args.length == 2){
            
        let ae = args[0]?.elementValue
        let be = args[1]?.elementValue
        if(!ae || !be){
            throw new Error("invalid runtime node")
        }
        if(ae.type != RuntimeElementType.Path || be.type != RuntimeElementType.Path){
            throw new Error("Cannot perform boolean on group (yet)");
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
                throw new Error("unsupported pop operation "+op);
        }

        //new path item, now replace a.
        //env.peek().elementValue.item = path;
        env.active = CreateElementNode(path)
    }else{
        //if we only have one argument, it could modify the prior object, while two will pop both, subtract them, set active.
        throw new Error(op+" boolean popop must pop 1 (."+op+", modifies top) or 2 (.."+op+", creates new) stack arguments")
    }
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

function checkChildrenLengthForArgument(node: treeNode, length: number){
    if(node.children.length != 1){
        throw new Error("bad number of arguments for "+node.id)
    }
}


export{ compileAndRun, GetSVGFromCurrentPaperContext}