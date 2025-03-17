enum NodeType {
    Program,
    ObjectStatement,
    Number,
    Identifier,
    ProcBody,
    DefineElement,
    BodyStatement,
    Transformation
}

class treeNode {
    type: NodeType
    id: string
    children: any[]
    constructor(ns: NodeType, id: string,...childs: any[])
    {
        this.type = ns
        this.id = id
        this.children = childs
        //this.children = childs.filter(x=>x!=null && x != undefined)
    }
}

export {NodeType, treeNode}