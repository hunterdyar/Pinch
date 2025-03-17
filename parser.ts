import "ohm-js";
import { grammar } from "ohm-js";
import { NodeType, treeNode } from "./ast";
import { compileAndRun } from "./svgGenerator";
import { pnvGrammar } from "./gram/pmv.ohm";

const g = grammar(pnvGrammar);
const s = g.createSemantics()

s.addOperation("toTree",{
    //@ts-ignore
    Program(s,_) {return new treeNode(NodeType.Program, "program",s.children.map(x=>x.toTree()))},
    //@ts-ignore
    ObjectStatement(ident,c) {
        console.log("os",ident,c)
        let parameters = c.asIteration().children.map(x=>x.toTree())
        return new treeNode(NodeType.ObjectStatement,ident.sourceString,parameters)
    },
    //@ts-ignore
    Transformation(pipe,b) {
        let os = b.toTree();
        return new treeNode(NodeType.Transformation,"|",[os]);
    },
    //@ts-ignore
    DefineElementStatement(a,b,c) {
        console.log("def statement",b,c);
        return new treeNode(NodeType.DefineElement,b.sourceString,c.child(1).children.map(x=>{       
            return x.toTree()
        }))
    },
    //@ts-ignore
    ObjectAndBodyStatement(a,b){
        let o = a.toTree()
        let body = b.toTree()
        return new treeNode(NodeType.ObjectWithBody, "owithn",[o,body])
    },
    //@ts-ignore
    ProcBody(a,b,c) {
        return new treeNode(NodeType.ProcBody, "procBody",b.children.map(x=>x.toTree()))
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
    }
})



function CreateSVG(input: string): SVGElement{
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