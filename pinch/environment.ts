import { RuntimeNode, Procedure, CreateGroupNode, CreateProcedureNode, treeNode, RuntimeElementType,  } from "./ast"
import { PEvalError } from "./pinchError"

class StackMetaItem {
    start: number = 0
    end: number | undefined = undefined
}

class Environment  {
    width: number = 256
    height: number = 256
    active: RuntimeNode | null = null
    root: RuntimeNode
    stack: RuntimeNode[] = []
    frames: Dict<RuntimeNode>[] = [] 
    stackMetaItems: StackMetaItem[] = []
    stackMetaIndex: number = 0
    maxFrameCount = 2048
    defaults: Dict<string> = {
        "stroke": "black",
        "fill": "lightgrey",
    }
    definitions: Dict<Procedure> = {} 

    constructor(){
        //root runtime group element.
        this.root = CreateGroupNode();
        //defaults
        //@ts-ignore
        this.root.elementValue.style["strokeColor"] = this.defaults["stroke"]
        //@ts-ignore
        this.root.elementValue.style["fillColor"] = this.defaults["fill"]
 
        this.stack.push(this.root)
        this.stackMetaIndex = -1
    }
    push(i:RuntimeNode | null, node: treeNode){
        if(i != null){
            let b4 = this.stack.length
            this.stack.push(i)
        }else{
            console.warn("[x pushed null]")
        }
        let lineNum = node.sourceInterval.getLineAndColumn().lineNum
        this.stackMetaIndex++
        this.stackMetaItems.push({start: lineNum, end: undefined})
        console.log("push",this.stackMetaIndex, this.stackMetaItems.length)
    }
    pop(node:treeNode):RuntimeNode{
        let x= this.stack.pop();
        let lineNum = node.sourceInterval.getLineAndColumn().lineNum
        //dumb gutter calculation things
        this.stackMetaItems[this.stackMetaIndex].end = lineNum
        this.stackMetaIndex--


        console.log("pop",this.stackMetaIndex, this.stackMetaItems.length)

        //actual work:
        if(x){
            return x
        }else{
            console.log("popped empty stack!",this.stack)
            return this.root
        }
    }
    peek(node:treeNode):RuntimeNode{
        if(this.stack.length == 0){
            throw new PEvalError("EmptyStack","Empty Stack!",node)
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