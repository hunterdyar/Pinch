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
    Item,
    Group,
    Procedure,
    String,
    Number,
}
type RuntimeElement = RuntimeType.Item | RuntimeType.Group

class RuntimeNode {
    type: RuntimeType = RuntimeType.Item
    itemValue: RuntimeItem | undefined //rename to item
    groupValue: RuntimeGroup | undefined
    procudureValue: Procedure | undefined
    stringValue: string = ""
    numValue: Number = 0

    getValue(): RuntimeElement | Procedure | string | Number | RuntimeGroup | undefined {
        switch (this.type){
            case RuntimeType.Item: return this.itemValue;
            case RuntimeType.Procedure: return this.procudureValue;
            case RuntimeType.String: return this.stringValue;
            case RuntimeType.Number: return this.numValue;
            case RuntimeType.Group: return this.groupValue;
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
        if(element.type != RuntimeType.Item){
            throw new Error("Can't append child element, is not element.");//todo append groups into groups?
        }else if(this.type == RuntimeType.Item){
            if(element.itemValue){ 
                throw new Error("Can't append a shape to a shape yet! But this will maybe be a thing with compound path?")
            }
            return;
        }else if(this.type == RuntimeType.Group){
            if(element.itemValue){
                this.groupValue?.group.addChild(element.itemValue.path)
            }else if(element.groupValue){
                this.groupValue?.group.addChild(element.groupValue.group)
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
    r.type = RuntimeType.Item;
    r.itemValue = new RuntimeItem(shape);
    return r;
}
function CreateGroupNode(){
    var r = new RuntimeNode();
    r.type = RuntimeType.Group;
    r.groupValue = new RuntimeGroup();
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

interface Renderable {
    Render(): paper.Item;
}
interface Styled {
    style: object
}

class RuntimeItem implements Renderable, Styled{
    path: paper.Path
    style: paper.Style

    constructor(shape: paper.Path){
        this.path = shape;
        this.style = new paper.Style({"fillColor":"red"})
    }

    Render(): paper.Item {
        this.path.style = this.style
        //test
        return this.path;
    }
}

class RuntimeGroup implements Renderable, Styled{
    group: paper.Group = new paper.Group();
    style: object 

    constructor(){
        this.style = {}
    }

    Render(): paper.Item{
        this.group.style = new paper.Style(this.style);
        return this.group
    }
}

export {NodeType, treeNode, Procedure, RuntimeNode, RuntimeType, CreateElementNode, CreateGroupNode, CreateProcedureNode, CreateNumberNode}