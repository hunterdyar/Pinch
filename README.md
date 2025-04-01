# Pinch
This is an experimental stack-based programming language for procedurally creating vector graphics.

## About
It transpiles code into vector images. 

It's a programming language designed to feel a bit like a markup language, oriented around pipelines operations and a stack.

It allows you to describe how you want your SVG's to look at a more intuitive and higher level than writing XML.

It's called pinch because it's small. When discussing the project with a friend, they were talking about all of the features that could be added. I held up my thumb and forefinger in a pinch gesture as I explained "No, that's great but no. Scope down!"

## Why?
This is a design research project. My goal is not to "finish", although I am pleased with the prototype so far. There are a few questions/design spaces I hope to explore:

- [Project Goal] Are pipeline programming suitable for image creation. Does this way of problam solving adapt well to destructuring and composing graphics? 
- [Programming Design] How can we write structures normally found in node-based environments (Blender GeoNodes, MaxMSP, vvv, ShaderGraph, etc) in plaintext programming? (I want node tools, but produce standalone plaintext that I use my keyboard to interface with)
- [User Design] Provide intuitive way to think about graphics creation. "Take these, align them, put them over there. These boxes should be the same size". One input does one thing, and we're not fiddling with transform handles or begging the snapping to work *just right*. 

    > Ian Henry describes the joy of this approach to problem solving in their blog post on [building bauble](https://ianthehenry.com/posts/bauble/building-bauble/)


Further, my intended use cases:

- I want to write presentations, slides, diagrams, etc in context-free and nondestructive ways. Write once, render in a staticly generated site, embed in powerpoint, keynote, use with obsidian, etc. SVG is widely supported.
- Small diagrams without real-life scale (e.g. *not* CAD)
- I don't want to learn LaTeX?

## Related & Inspiration
- [OpenSCAD](https://openscad.org/)
- [Bauble](https://bauble.studio/)
- [Penrose](https://penrose.cs.cmu.edu/)
- Creative Coding Frameworks ([Processing](https://processing.org/), [p5](https://p5js.org/), [openFrameworks](https://openframeworks.cc/), etc)
- Shaders ([Shadertoy](https://www.shadertoy.com/), [kodelife](https://hexler.net/kodelife), [shaderplace](https://shader.place/))
- JS canvas/drawing Libraries ([fabricjs](https://fabricjs.com/), [threejs](https://threejs.org/), [paperjs](http://paperjs.org/), [g.js](https://g.js.org/), [konva](https://konvajs.org/))
- [Shelly.dev](https://shelly.dev/)

## Core Concepts
### The Stack
The > is the "push" operator. It put's what is on it's left on the "stack". The . (period) is the "pop" operator, it removes the topmost thing from the stack.

The 'SVG' element is the top of the stack, and many operations will equate directly with the hierarchiel XML/HTML structure.

### Stack Operations
[op] [identifier] [space-separated parameters]

|, + and ~ are stack operators. They do something to whatever is currently on the top of the stack. 

- | (pipe) is a transformation, it changes some attribute of the object on the top of the stack. Usually it sets an attribute of an SVG Element.
- \+ (append) adds it's argument as a child to the one on the stack. e.g.: ```<topofstack><append></append></topofstack>.```
- ~ (tilde) is a conversion. It alters (type casting/converting) the type on the stack, or otherwise significantly changes the object on the stack.

If you don't include an operator, but there is an object, it will append by default. But the '+' symbol is recommended anyway for clarity.

### Flow Operations
[{] [identifier] [space-seperated parameters] [newline] [list of statements] [}]

Stack operations are a symbol followed by an identifier. 

Flow operators all start with a { symbol, then their call on the same line. The rest of the lines are contained in a block, followed by a }.

> The { is on the outside like with Lisp, but using curlies like C. So everyone is unhappy! (Wait, don't leave yet. It's alright. Remember, the left column of the code is a scannable set of operator symbols)

The @ symbol names a local variable within a flow operation. Repeat takes an optional named variable which can then be looked up (without the @)

```
{ repeat @i -20 20 10
    + circle >
    | x i
    .
}

{ def itemname
+ circle 20
}
```

