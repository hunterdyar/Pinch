enum NodeType {
    Program,
    ObjectStatement,
    Number,
    Identifier,
    Push,
    Pop,
    Append,
    DefineElement,
    BodyStatement,
    Transformation,
    Procedure
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

class Procedure{
    type: NodeType = NodeType.Procedure
    id: string
    statements: treeNode[] = []
    constructor(id: string, statements: treeNode[]){
        this.id = id
        this.statements = statements
    }
}

export {NodeType, treeNode, Procedure}