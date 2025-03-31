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
                    if(this.elementValue.isGroup()){
                        this.elementValue.item.addChild(element.elementValue.item)
                    }else{
                        throw new Error("Can't, yet, append path to path. yet!")
                    }
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
    style: {}
    type: RuntimeElementType = RuntimeElementType.Path
    isGroup = ():boolean => {return this.type == RuntimeElementType.Group} //this is "type" but we only have two types so boolean inste

    constructor(){
        this.style = {}
    }

    Render(): paper.Item{
        this.item.style = new paper.Style(this.style);
        return this.item
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
    
    constructor(){
        super()
        this.type = RuntimeElementType.Group;
        this.item = new paper.Group();
    }
}

export {NodeType, treeNode, Procedure, RuntimeNode, RuntimeType, RuntimeItem, RuntimeGroup, RuntimeElement, CreateElementNode, CreateGroupNode, CreateProcedureNode, CreateNumberNode}