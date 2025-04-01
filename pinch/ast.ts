import paper from "paper";

import { collapseTextChangeRangesAcrossMultipleVersions } from "typescript"

enum NodeType {
    Program,
    ObjectStatement,
    Number,
    String,
    Identifier,
    Label,
    Push,
    Pop,
    Append,
    Flow,
    BodyStatement,
    Transformation,
    Procedure,
    Block
}

class treeNode {
    type: NodeType
    id: string
    children: any[]
    constructor(ns: NodeType, id: string,childs: any[])
    {
        this.type = ns
        this.id = id
        this.children = childs
        //this.children = childs.filter(x=>x!=null && x != undefined)
    }
}

// the above is our first AST pass. The below is the "compilation" pass.

enum RuntimeType{
    Element,
    Procedure,
    String,
    Number,
}

class RuntimeNode {
    type: RuntimeType = RuntimeType.Element
    elementValue: RuntimeElement | undefined //rename to item
    procudureValue: Procedure | undefined
    stringValue: string = ""
    numValue: Number = 0

    getValue(): RuntimeElement | Procedure | string | Number | RuntimeGroup | undefined {
        switch (this.type){
            case RuntimeType.Element: return this.elementValue;
            case RuntimeType.Procedure: return this.procudureValue;
            case RuntimeType.String: return this.stringValue;
            case RuntimeType.Number: return this.numValue;
        }
    }
    getStringValue(): string {
        switch(this.type){
            case RuntimeType.String: return this.stringValue;
            case RuntimeType.Number: return this.numValue.toString();
            default:
                throw new Error("Can't get string value for runtime node of type "+this.type)
        }
    }
    
    appendChildElement(element: RuntimeNode | null){
        if(element == null){
            throw new Error("can't append child element that is null!")
        }
        if(element.type != RuntimeType.Element){
            throw new Error("Can't append child element, is not element.");//todo append groups into groups?
        }else if(this.type == RuntimeType.Element){
            if(this.elementValue){
                if(element.elementValue){
                        this.elementValue.AddChild(element.elementValue)
                 }else{
                    throw new Error("element value of appendee is null but element is marked as element.")
                 }
            }else{
                throw new Error("element value is of this null but element is marked as element.")
            }
        }
        else if(this.type == RuntimeType.Procedure){
            throw new Error("Can't append child element to procedure. we meant to do a different thing.")
        }else{
            throw new Error("call to append on invalid runtime item.")
        }
    }
}

function CreateElementNode(shape: paper.Path){
    var r = new RuntimeNode();
    r.type = RuntimeType.Element;
    r.elementValue = new RuntimeItem(shape);
    return r;
}
function CreateGroupNode(){
    var r = new RuntimeNode();
    r.type = RuntimeType.Element;
    r.elementValue = new RuntimeGroup();
    return r;
}
function CreateProcedureNode(procedure: Procedure){
    var r = new RuntimeNode();
    r.type = RuntimeType.Procedure;
    r.procudureValue = procedure;
    return r;
}
function CreateNumberNode(number: Number){
    var r = new RuntimeNode();
    r.type = RuntimeType.Number;
    r.numValue = number;
    return r;
}

class Procedure{
    type: NodeType = NodeType.Procedure
    id: string
    statements: treeNode[] = []
    internalPushCount: number = 0

    constructor(id: string, statements: treeNode[]){
        this.id = id
        this.statements = statements
    }

    pushStatement(node: treeNode){
        if(node.type == NodeType.Push){
            this.internalPushCount++;
        }else if(node.type == NodeType.Pop){
            this.internalPushCount--;
        }
        this.statements.push(node)
    }
    
}

enum RuntimeElementType{
    Path,
    Group
}

abstract class RuntimeElement {
    abstract item: paper.Item
    style: Dict<any>
    blendMode: string = ""
    opacity: number = -1
    type: RuntimeElementType = RuntimeElementType.Path
    isGroup = ():boolean => {return this.type == RuntimeElementType.Group} 

    constructor(){
        this.style = {}
    }

    SetStyleIfNotSet(attr: string, value: any){
        if(!(attr in this.style)){
            this.style[attr] = value
        }
    }

    Render(): paper.Item{
        //todo: paperJS is applying styles in order, not by hierarchy.
        //so style will need to be our own object, and then we check all of the current styles and do an appropriate union of them such that the more specific application takes priority.
        this.item.style = new paper.Style(this.style);
        if(this.blendMode){
            this.item.blendMode = this.blendMode
        }else{
            this.item.blendMode = "normal"
        }
        //using < for unset blendmodes.
        if(this.opacity <0){
            this.item.opacity = 1
        }else{
            this.item.opacity = this.opacity
        }
        return this.item
    }

    AddChild(element: RuntimeElement){
        throw new Error("addChild is not implemented.");
    }
    SetBlendMode(bm: string){
        bm = bm.toLowerCase().trim()
        const valid = ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'color-dodge', 'color-burn', 'darken', 'lighten', 'difference', 'exclusion', 'hue', 'saturation', 'luminosity', 'color', 'add', 'subtract', 'average', 'pin-light', 'negation', 'source-over', 'source-in', 'source-out', 'source-atop', 'destination-over', 'destination-in', 'destination-out', 'destination-atop', 'lighter', 'darker', 'copy', 'xor']   
        if(valid.includes(bm)){
            this.blendMode = bm;
        }else{
            throw new Error(bm+" is not a valid blend mode.");
        }
    }
}

class RuntimeItem extends RuntimeElement{
    item: paper.PathItem

    constructor(shape: paper.Path){
        super()
        this.item = shape;
        this.type = RuntimeElementType.Path
    }
}

class RuntimeGroup extends RuntimeElement {
    item: paper.Group 
    children: RuntimeElement[] = []
    constructor(){
        super()
        this.type = RuntimeElementType.Group;
        this.item = new paper.Group();
    }
    override Render(): paper.Item{
        console.log("render group")
        this.children.forEach(c=>{
            //set styles if not set.
            for(let key in this.style){
                if(!(key in c.style)){
                    c.style[key] = this.style[key]
                }
            }
            //set blendmode if unset.
            if(c.blendMode === "" && this.blendMode !== ""){
                c.blendMode = this.blendMode;
            }

            //if they don't have opacity set but we do.
            if(c.opacity < 0 && this.item.opacity >= 0){
                c.item.opacity = this.item.opacity
            }
        })
    
        //we can remove the second loop here and do them all in one loop, but im holding off until im confident this is the approach i want to use.
        this.children.forEach(c=>{
            let child = c.Render()
            this.item.addChild(child)
        })

        //we don't call super because, in paperjs, the group application will override the child application. We want hierarchial (most specific set), not temporal (last set) precedence
        return this.item;
    }

    override AddChild(element: RuntimeElement): void {
        this.children.push(element)
    }
}

export {NodeType, treeNode, Procedure, RuntimeNode, RuntimeType, RuntimeItem, RuntimeGroup, RuntimeElement, CreateElementNode, CreateGroupNode, CreateProcedureNode, CreateNumberNode}