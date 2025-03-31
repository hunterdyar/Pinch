import "ohm-js";
import { grammar } from "ohm-js";
import { NodeType, treeNode } from "./ast";
import { compileAndRun } from "./svgGenerator";
import { pnvGrammar } from "../gram/pmv.ohm";

const g = grammar(pnvGrammar);

const s = g.createSemantics()

s.addOperation("toTree",{
    //@ts-ignore
    Program(s,_) {return new treeNode(NodeType.Program, "program",s.children.map(x=>x.toTree()))},
    //@ts-ignore
    objectStatement(ident,w,c) {
        let parameters = c.asIteration().children.map(x=>x.toTree())
        return new treeNode(NodeType.ObjectStatement,ident.sourceString,parameters)
    },
    //@ts-ignore
    Transformation(pipe,b) {
        let os = b.toTree();
        return new treeNode(NodeType.Transformation,"|",[os]);
    },
    //@ts-ignore
    Transformation(a,b){
        return new treeNode(NodeType.Transformation, b.sourceString, [b.toTree()]);
    },
    //@ts-ignore
    AppendOperation(a,b){
        return new treeNode(NodeType.Append,b.sourceString, [b.toTree()])
    },
    //@ts-ignore
    PushOperation(a,b){
        return new treeNode(NodeType.Push,b.sourceString, [a.toTree()])
    },
    //@ts-ignore
    stringLiteral(a,b,c){
        return new treeNode(NodeType.String, b.sourceString,[])
    },
    //@ts-ignore
    FlowOperation(a,b,c,d){
        let op = b.toTree()
        let block = []
            block = c.children.map(x=>x.toTree())
        return new treeNode(NodeType.Flow,op.id,[op,block]);
    },
    //@ts-ignore
    PopOperation(a){
        return new treeNode(NodeType.Pop,"pop",[]);
    },
    //@ts-ignore
    // StatementBlock(a,b,c){
    //     let children = b.children.map(x=>x.toTree());
    //     return new treeNode(NodeType.Block,"{}",children);
    // },
    //@ts-ignore
    label(a,b){
        return new treeNode(NodeType.Label,b.sourceString,[])
    },
     //@ts-ignore
    number(n) {
        return new treeNode(NodeType.Number,n.sourceString,[])
    },
    //@ts-ignore
    ident(n,r) {
        return new treeNode(NodeType.Identifier, n.sourceString+r.sourceString,[])
    },
    whitespace(w){return null},
    _iter(...c){
        console.log("iter",c)
        return c.map(x => {
            x.toTree();
        });
    },

})


function CreatePinchDrawing(canvas: HTMLCanvasElement, input: string){
    let lex = g.match(input);
    if(lex.succeeded())
    {
        let ast = s(lex).toTree();
        compileAndRun(canvas, ast);
        return;
    }else{
        throw new Error(lex.message)
    }
}

export {CreatePinchDrawing}