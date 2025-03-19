const MethodSignatures:Dict<string[][]> = {
    "rect": [
        ["width", "height"],
        ["x","y","wodth","height"],
    ],
    "circle": [
        ["r"],
        ["cx","cy","r"]
    ]
};

function getSignature(count: Number, method: string): string[]{
    let methods = MethodSignatures[method];
    if(methods){
        for (let i = 0; i <methods.length; i++) {
            const sig = methods[i];
            if(sig){
                if(sig.length == count){
                    return sig;
                }
            }
        }
    }
    throw new Error("wrong number of arguments for "+method)
}

export {getSignature}