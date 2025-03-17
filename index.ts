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
        let parameters:any[] = []
            c.children.forEach(nonEmptyList => {
                    if(nonEmptyList.ctorName != "nonemptyListOf" && nonEmptyList.ctorName != "emptyListOf"){
                        throw new Error("Unexpected Object Statement Structure")
                    }
                    nonEmptyList.children.forEach(element => {
                        element.children.forEach(e => {
                            let x = e.toTree()
                            if(x != null && x != undefined){
                               // console.log("osc "+e.ctorName)
                                parameters.push(x)
                            }
                            
                        });
                    });
            });
        
        return new treeNode(NodeType.ObjectStatement,ident.sourceString,parameters)
    },
    Transformation(pipe,b) {
        let operation = []
        
        console.log("transformation",pipe,b)
        return new treeNode(NodeType.Transformation,"|",b.child(1).children.forEach(x=>x.toTree()));
    },
    //@ts-ignore
    DefineElementStatement(a,b,c) {
        return new treeNode(NodeType.DefineElement,b.sourceString,c.child(1).children.map(x=>{       
            return x.toTree()
        }))
    },
   
    //@ts-ignore
    ProcBody(a,b,c) {
        return b.children.map(x=>x.toTree())
    },
    number(n) {
        return new treeNode(NodeType.Number,n.sourceString,[])
    },
    ident(n,r) {
        return new treeNode(NodeType.Identifier, n.sourceString+r.sourceString,[])
    },
    whitespace(w){return null}
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