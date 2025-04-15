import { RuntimeNode, Procedure, CreateGroupNode, CreateProcedureNode, treeNode, RuntimeElementType,  } from "./ast"
import { CreateWarning, PEvalError, PWarn } from "./pinchError"
import paper from "paper";

class StackMetaItem {
    start: number = 0
    end: number | undefined = undefined
}

class Environment  {
    //todo: currently a bug where the width and height need to match what the canvas defaults. Currently set in css.
    //
    width: number = 200
    height: number = 200
    background: paper.Color 
    active: RuntimeNode | null = null
    root: RuntimeNode
    stack: RuntimeNode[] = []
    frames: Dict<RuntimeNode>[] = [] 
    stackMetaItems: StackMetaItem[] = []
    stackMetaIndices: number[] = []
    addToStackMeta: boolean = true
    maxFrameCount = 2048
    defaults: Dict<string> = {
        "stroke": "black",
        "fill": "lightgrey",
    }
    definitions: Dict<Procedure> = {} 
    warnings: PWarn[] = []

    constructor(){
        //root runtime group element.
        this.root = CreateGroupNode();
        //defaults
        //@ts-ignore
        this.root.elementValue.style["strokeColor"] = this.defaults["stroke"]
        //@ts-ignore
        this.root.elementValue.style["fillColor"] = this.defaults["fill"]
 
        this.stack.push(this.root)
        this.background = new paper.Color(1,1,1,0)
    }
    push(i:RuntimeNode | null, node: treeNode){
        if(i != null){
            let b4 = this.stack.length
            this.stack.push(i)

            if(!node.hasPushed){
                let lineNum = node.sourceInterval.getLineAndColumn().lineNum
                let x = this.stackMetaItems.push({start: lineNum, end: undefined})
                this.stackMetaIndices.push(x-1)
                node.hasPushed = true
            }

        }else{
            CreateWarning("PushNull","Tried To Push Nothing. Ignoring.",node,this)
        }
    }
    pop(node:treeNode):RuntimeNode{
        if(this.stack.length == 1){
            throw new PEvalError("EmptyStack","Nothing to pop!",node)
        }
        let x= this.stack.pop();

        if(!node.hasPopped){
            let lineNum = node.sourceInterval.getLineAndColumn().lineNum
            //dumb gutter calculation things
            let index = this.stackMetaIndices.pop();
            if(index != undefined){
                let top = this.stackMetaItems[index]
                if(top){
                    top.end = lineNum
                }
            }
            node.hasPopped = true
         }

        //actual work:
        if(x){
            return x
        }else{
            throw new PEvalError("EmptyStack","Empty Stack!",node)
        }
    }
    peek(node:treeNode):RuntimeNode{
        if(this.stack.length == 0){
            throw new PEvalError("EmptyStack","Empty Stack!",node)
''        }
        
        let x = this.stack[this.stack.length-1]
        if(x){
            return x
        }else{
            throw new Error("cannot peek")
        }
    }
    addAndPushDefinition(identifier: string, body: treeNode[], args: string[],idnode:treeNode){
        if(identifier in this.definitions){
            throw new PEvalError("BadID","Can't define "+identifier+" . It is already defined.", idnode);
        }

        //todo: two wrapper functions basically...
        this.definitions[identifier] = new Procedure(identifier, args, body);
        this.push(CreateProcedureNode(this.definitions[identifier]),idnode)
    }
    hasDefinition(identifier: string):boolean{
        return identifier in this.definitions
    }
    getDefinition(identifier: string, node: treeNode):Procedure
    {
        let x = this.definitions[identifier]
        if(x != undefined){
            return x;
        }else{
            throw new PEvalError("BadID","Invlid definition lookup. "+identifier, node)
        }
    }
    getDefault(key: string, node:treeNode):string{
        key = key.toLowerCase()
        if(key in this.defaults){
         let x = this.defaults[key]
         if(x != null)
         {
            return x;
         }
        }
        throw new PEvalError("Unexpected","Unknown default key "+key,node);
    }
    pushFrame(node: treeNode){
        //todo: picked this arbitrarily. i don't know what a good max is.
        if(this.frames.length >= this.maxFrameCount){
            throw new PEvalError("StackOverflow","Stack Overflow Error",node)
        }
        let f = {}
        this.frames.push(f)
        
    }
    popFrame(node:treeNode)
    {
        if(this.frames.length >= 1){
            this.frames.pop()
        }else{
            throw new PEvalError("FrameStack","Can't Pop Frame",node)
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
    setLocal(id: string, val: RuntimeNode, node: treeNode){
        if(this.frames.length >= 1){
            let frame = this.frames[this.frames.length-1];
            if(frame != undefined){
                frame[id] = val
            }
        }else{
            throw new PEvalError("FrameStack","Can't Set Local, there is no local frame.",node)
        }
    }
    getLocal(id: string, node: treeNode): RuntimeNode
    {
        if(this.frames.length >= 1){
            for(let f = this.frames.length-1;f>=0;f--){
                let frame = this.frames[f];
                if(frame != undefined && frame[id]){
                    return frame[id]
                }
            }
            
        }else{
            throw new PEvalError("FrameStack","Can't Get Local, there is no local frame",node)
        }
        throw new PEvalError("BadID","Unable to get local property "+id,node);
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
export {Environment, StackMetaItem}