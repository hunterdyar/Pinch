import type { Interval, MatchResult } from "ohm-js";

class PEvalError implements EvalError{
    name: string;
    message: string;
    stack?: string | undefined;
    cause?: unknown;

    constructor(name: string, message: string | undefined){
        this.name = name
        if(message){
            this.message = message
        }else{
            this.message = ""
        }
    }
}

class PSyntaxError implements SyntaxError{
    name: string;
    message: string;
    stack?: string | undefined;
    cause?: unknown;
    interval: Interval //thius could be LineAndColumnInfo" or whatever CodeMirror wants.

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
    }
}

export {PEvalError, PSyntaxError}