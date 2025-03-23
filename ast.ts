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
    DefineProcedureNode,
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
    Group,
    Procedure,
    String,
    Number,
}
class RuntimeNode {
    type: RuntimeType = RuntimeType.Element
    elementValue: SVGElement | undefined
    groupValue :SVGElement[] | undefined //this is of runtime nodes or of elements?
    procudureValue: Procedure | undefined
    stringValue: string = ""
    numValue: Number = 0

    getValue(): SVGElement | SVGElement[] | Procedure | string | Number | undefined {
        switch (this.type){
            case RuntimeType.Element: return this.elementValue;
            case RuntimeType.Group: return this.groupValue;
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
            throw new Error("can't appent child element that is null!")
        }
        if(element.type != RuntimeType.Element){
            throw new Error("Can't append child element, is not element.");
        }
        if(this.type == RuntimeType.Element){
            if(element.elementValue){ 
                this.elementValue?.appendChild(element.elementValue)
            }
            return;
        }
        if(this.type == RuntimeType.Procedure){
            throw new Error("Can't append child element to procedure. we meant to do a different thing, this is the html thing.")
            // this.procudureValue?.statements.push()
        }
        if(this.type == RuntimeType.Group){
            console.log("Appending to groups... This behaviour is not yet supported.")
            if(element.elementValue){
                this.groupValue?.push(element.elementValue);
            }
        }
    }
}

function CreateElementNode(element: SVGElement){
    var r = new RuntimeNode();
    r.type = RuntimeType.Element;
    r.elementValue = element;
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
    constructor(id: string, statements: treeNode[]){
        this.id = id
        this.statements = statements
    }
}

export {NodeType, treeNode, Procedure, RuntimeNode, RuntimeType, CreateElementNode, CreateProcedureNode, CreateNumberNode}