import "ohm-js";
import { grammar } from "ohm-js";
import { NodeType, treeNode } from "./ast";
import { compileAndRun } from "./compiler";
import { pnvGrammar } from "../gram/pmv.ohm";
import { PSyntaxError } from "./pinchError";

const g = grammar(pnvGrammar);

const s = g.createSemantics()

s.addOperation("toTree",{
    //@ts-ignore
    Program(s,_) {return new treeNode(NodeType.Program, "program",s.children.map(x=>x.toTree()))},
    //@ts-ignore
    objectStatement(ident,w,c) {
        let parameters = c.asIteration().children.map(x=>x.toTree())
        return new treeNode(NodeType.ObjectStatement,ident.sourceString,parameters, ident.source)
    },
    //@ts-ignore
    Transformation(pipe,b) {
        let os = b.toTree();
        return new treeNode(NodeType.Transformation,"|",[os], b.source);
    },
    //@ts-ignore
    Transformation(a,b){
        return new treeNode(NodeType.Transformation, b.sourceString, [b.toTree()], b.source);
    },
    //@ts-ignore
    AppendOperation(a,b){
        return new treeNode(NodeType.Append,b.sourceString, [b.toTree()], b.source)
    },
    //@ts-ignore
    PushOperation(a,b){
        return new treeNode(NodeType.Push,b.sourceString, [a.toTree()], b.source)
    },
    //@ts-ignore
    stringLiteral(a,b,c){
        return new treeNode(NodeType.String, b.sourceString,[], b.source)
    },
    //@ts-ignore
    rawjsLiteral(a,b,c){
        return new treeNode(NodeType.RawJS, b.sourceString,[], b.source)
    },
    //@ts-ignore
    FlowOperation(a,b,c,d){
        let op = b.toTree()
        let block = []
            block = c.children.map(x=>x.toTree())
        return new treeNode(NodeType.Flow,op.id,[op,block], b.source);
    },
    //@ts-ignore
    popOperation(a,b){
        if(b.children.length == 0){
            return new treeNode(NodeType.Pop,"pop",[a.children.length], b.source);
        }else{
            if(b.children[0]){
                if(b.children[0].sourceString === "+"){
                    //.+ is shorthand for .append
                    return new treeNode(NodeType.Pop,"pop",[a.children.length, new treeNode(NodeType.Identifier, "append",[], b.source)], b.source);
                }else{
                    return new treeNode(NodeType.Pop,"pop",[a.children.length, b.children[0].toTree()], b.source);
                }
            }else{
                throw new Error("invalid parse somehow");
            }
        }
    },
    //@ts-ignore
    label(a,b){
        return new treeNode(NodeType.Label,b.sourceString,[], b.source)
    },
     //@ts-ignore
    number(n) {
        return new treeNode(NodeType.Number,n.sourceString,[],n.source)
    },
    //@ts-ignore
    ident(n,r) {
        return new treeNode(NodeType.Identifier, n.sourceString+r.sourceString,[], n.source)
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
        performance.mark("parse-end");
        compileAndRun(canvas, ast);
        return;
    }else{
        throw new PSyntaxError(lex)
    }
}

export {CreatePinchDrawing}