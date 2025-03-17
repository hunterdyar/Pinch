import { env } from "bun";
import { NodeType, treeNode } from "./ast";

class Environment  {
    width: Number = 256
    height: Number = 256
    stack: Context[] = []
    definitions: Dict<string> = {} 

    push(i:Context){
        this.stack.push(i)
    }
    pop():Context{
        let x= this.stack.pop();
        if(x){
            return x
        }else{
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
}
//todo: wrapper class with context types
type Context = HTMLElement | SVGSVGElement | Number | string 

function compileAndRun(root: treeNode): SVGSVGElement{
    let svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
    let environment = new Environment()
    environment.push(svg)

    if(root.type != NodeType.Program){
        throw new Error("invalid root object. trying anyway...")
    }
    root.children.forEach(child => {
        //@ts-ignore
        child.forEach(node => {
            compile(node, environment);

        });
    });

    if(environment.stack.length != 1){
        throw new Error("not all pushes got popped, for context stack");
    }
    environment.stack.pop;

    svg.setAttribute("width",environment.width.toString())
    svg.setAttribute("height",environment.width.toString())
    svg.setAttribute("version", "1.1")
    return svg;
}


function compile(node:treeNode, env: Environment){
    switch(node.type){
        case NodeType.Number:
            return node.id
        case NodeType.Identifier:
            return node.id
            
        case NodeType.ObjectStatement:
            compileStandaloneObjectStatement(node,env)       
            break;
        case NodeType.Transformation:
            console.log("transform!")
            break;
        case NodeType.BodyStatement:
            console.log("body statement")
            break;
        case NodeType.ProcBody:
            console.log("procedure body");
            node.children.forEach(x=>{
                compile(x)  
            })
            break;
        default: 
            console.log("unhandled:",node)
    }
    return ""
}

function compileStandaloneObjectStatement(node:treeNode, env: Environment){
    //create and append child to context
    let d = document.createElementNS("http://www.w3.org/2000/svg",node.id);
    switch(node.id){
        case "circle":
            // console.log(node.children[0][0])
            d.setAttribute("r",compile(node.children[0][0],env))
            d.setAttribute("cx","0")
            d.setAttribute("cy","0")
            d.setAttribute("stroke","black")
            d.setAttribute("fill","red")
            d.setAttribute("stroke-width", "5")
    }
    let c = env.peek();
    (c as HTMLElement).appendChild(d);
    //
}


export{ compileAndRun}