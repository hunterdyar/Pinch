width 200
height 200

//everything is either an element, a transformation, or a procedure. 
//transformations are invalid on the root, but both elements and procedures are valid.
//parenthesis are syntactic sugar for inline mode, which lets you operate on numbers in a non-pipeline way.
rect 10 10 10 10

//@ symbol is a property lookup, and the goal is to reduce the amount of variables that get defined. So isntead of "define variable then set property to that variable" its "keep operating on the property"
//@ is like a search for a property of the current context, but moving upwards. IBelow it won't find x in the "number" context of y, it won't look in neighboring transformations, but it will find it in the "element" property that this transformation gets applied to, when that happens.

def-transformation pos >
| x 20
| y 0 >
    | sin @x > 
        | + PI
        | * 10
        .
    .
.

//the pipe syntax breaks down once we start nesting. an indent is all we get to know we are deeeeeper.
//so what about > to indent and . to dedent? | apples to same level. 

on their own, shapes just append themselves to the current context.
usually thats the canvas at the root level
below, circle and rect are appending themselves to the 'myShape' shape definition
when used, it will create an svg <g> - a group.

def-el myShape 
>
    circle >
        | stroke
        | nofill
        | pos //<- we defined this transformation earlier!
        .
    rect 5 5 0 0

//repeats x 5 times starting at -50 with a gap of 10.
//@x and @i are context variables available in the loop
//<> is string concatenation with implicit 'string x' wrapper, shorthand for the append-string (+) pipeline transformation

label "#" >
| + "2"
| lowercase
| trim

repeat-x 5 -50 10 >
myShape
| fill yellow
| label ("#" <> (@i + 1) )
.


//applies a transformation to the context
| [transformation] 

//sets context to it's left hand side (pushes element to context stack, like a {)
>

//pops from the context stack, like a }
.


