const MethodSignatures:Dict<string[][]> = {
    "rect": [
        ["width", "height"],
        ["x","y","width","height"],
        ["x", "y", "width", "height", "rx", "ry"]
    ],
    "circle": [
        ["r"],
        ["cx","cy","r"]
    ],
};

function getSignature(count: Number, method: string): object {
    let methods = MethodSignatures[method];
    if(methods){
        for (let i = 0; i <methods.length; i++) {
            const sig = methods[i];
            if(sig){
                if(sig.length == count){
                    let o: Dict<any> = {}
                    sig.forEach (a=>{
                        o[a] = 0
                    })
                }
            }
        }
    }
    throw new Error("wrong number of arguments for "+method)
}

export {getSignature}