import "ohm-js";
import { grammar } from "ohm-js";
import { NodeType, treeNode } from "./ast";
import { compileAndRun } from "./svgGenerator";
import { pnvGrammar } from "./gram/pmv.ohm";

const g = grammar(pnvGrammar);
const s = g.createSemantics()

s.addOperation("toTree",{
    Program(s,_) {return new treeNode(NodeType.Program, "program",s.children.map(x=>x.toTree()))},
    ObjectStatement(ident,c) {
        let parameters = c.asIteration().children.map(x=>x.toTree())
        return new treeNode(NodeType.ObjectStatement,ident.sourceString,parameters)
    },
    // BodyStatement(b){
    //     console.log("body statement is "+b.ctorName)
    //     return b.toTree()
    // },
    Transformation(pipe,b) {
        let os = b.toTree();
        return new treeNode(NodeType.Transformation,"|",[os]);
    },
    //@ts-ignore
    DefineElementStatement(a,b,c) {
        return new treeNode(NodeType.DefineElement,b.sourceString,c.child(1).children.map(x=>{       
            return x.toTree()
        }))
    },
    ObjectAndBodyStatement(a,b){
        let o = a.toTree()
        let body = b.toTree()
        return new treeNode(NodeType.ObjectWithBody, "owithn",[o,body])
    },
    //@ts-ignore
    ProcBody(a,b,c) {
        return new treeNode(NodeType.ProcBody, "procBody",b.children.map(x=>x.toTree()))
    },
    number(n) {
        return new treeNode(NodeType.Number,n.sourceString,[])
    },
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



function CreateSVG(input: string): HTMLElement{
    let lex = g.match(input);
    if(lex.succeeded())
    {
        let ast = s(lex).toTree();
        let svg = compileAndRun(ast);
        return svg;
    }else{
        throw new Error(lex.message)
    }
}

export {CreateSVG}