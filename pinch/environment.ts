import { RuntimeNode, Procedure, CreateGroupNode, CreateProcedureNode, treeNode,  } from "./ast"
import { PEvalError } from "./pinchError"
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
            throw new PEvalError("EmptyStack","Empty Stack!")
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
    addAndPushDefinition(identifier: string, body: treeNode[], args: string[]){
        if(identifier in this.definitions){
            throw new PEvalError("BadID","Can't define "+identifier+" . It is already defined.");
        }

        //todo: two wrapper functions basically...
        this.definitions[identifier] = new Procedure(identifier, args, body);
        this.push(CreateProcedureNode(this.definitions[identifier]))
    }
    hasDefinition(identifier: string):boolean{
        return identifier in this.definitions
    }
    getDefinition(identifier: string):Procedure
    {
        let x = this.definitions[identifier]
        if(x != undefined){
            return x;
        }else{
            throw new PEvalError("BadID","Invlid definition lookup. "+identifier)
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
        throw new PEvalError("Unexpected","Unknown default key "+key);
    }
    pushFrame(){
        //todo: picked this arbitrarily. i don't know what a good max is.
        if(this.frames.length >= this.maxFrameCount){
            throw new PEvalError("StackOverflow","Stack Overflow Error")
        }
        let f = {}
        this.frames.push(f)
        
    }
    popFrame()
    {
        if(this.frames.length >= 1){
            this.frames.pop()
        }else{
            throw new PEvalError("FrameStack","Can't Pop Frame")
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
            throw new PEvalError("FrameStack","Can't Set Local, there is no local frame.")
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
            throw new PEvalError("FrameStack","Can't Get Local, there is no local frame")
        }
        throw new PEvalError("BadID","Unable to get local property "+id);
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
export {Environment}