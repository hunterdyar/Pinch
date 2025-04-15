import type { Interval, MatchResult } from "ohm-js";
import type { treeNode } from "./ast";
import type { Environment } from "./environment";

class PEvalError implements EvalError{
    name: string;
    message: string;
    stack?: string | undefined;
    cause?: unknown;
    interval: Interval
    severity: string = "error"
    from: number;
    to: number;

    constructor(name: string, message: string | undefined, node: treeNode){
        this.name = name
        if(message){
            this.message = message
        }else{
            this.message = ""
        }
        this.interval = node.sourceInterval
        this.from = node.sourceInterval.startIdx
        this.to = node.sourceInterval.endIdx
    }

}

class PSyntaxError implements SyntaxError{
    name: string;
    message: string;
    severity: string = "error";
    stack?: string | undefined;
    cause?: unknown;
    interval: Interval
    from: number //thius could be LineAndColumnInfo" or whatever CodeMirror wants.
    to: number

    constructor(lex: MatchResult){
        this.name = "SyntaxError"
        if(lex.message){
        this.message = lex.message;
        }else if(lex.shortMessage){
            this.message = lex.shortMessage
        }else{
            this.message = "Syntax Error"
        }
        this.interval = lex.getInterval()
        this.from = this.interval.startIdx
        this.to = this.interval.endIdx
    }
}

function CreateWarning(name: string, message: string | undefined, node: treeNode, env: Environment){
    if(node.emittedWarnings.includes(name)){
        return;
    }
    env.warnings.push(new PWarn(name,message,node))
    node.emittedWarnings.push(name)
}

class PWarn {
    name: string;
    message: string;
    severity: string = "warning"
    interval: Interval;
    from: number;
    to: number;   
    
    constructor(name: string, message: string | undefined, node: treeNode){
        this.name = name
        if(message){
            this.message = message
        }else{
            this.message = ""
        }
        this.interval = node.sourceInterval
        this.from = node.sourceInterval.startIdx
        this.to = node.sourceInterval.endIdx
    }

}

export {PEvalError, PSyntaxError, PWarn,CreateWarning}