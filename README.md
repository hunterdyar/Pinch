# Pipes 'n Vecs

## About
This is an experimental language for procedurally creating vector graphics.

It transpiles code into SVG. 

It's a programming language designed to feel a bit like a markup language, oriented around pipelines.

It allows you to describe how you want your SVG's to look at a more intuitive and higher level than writing XML.

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
- OpenSCAD
- Bauble
- Penrose
- Processing (P5, etc)
- Shaders (Shadertoy, kodelife, shaderplace)
- JS canvas/drawing Libraries (fabricjs, threejs, paperjs, g.js)

## Core Concepts
### The Stack
The > is the "push" operator. It put's what is on it's left on the "stack". The . (period) is the "pop" operator, it removes the topmost thing from the stack.

The 'SVG' element is the top of the stack, and many operations will equate directly with the hierarchiel XML/HTML structure.

### Stack Operations
[op] [identifier] [space-separated parameters]

|, + and ~ are stack operators. They do something to whatever is currently on the top of the stack. 

- | (pipe) is a transformation, it changes some attribute.
- \# (append) adds it's argument as a child of the stack, without pushing to it.
- ~ (tilde) is a conversion. It alters (type casting/converting) the type on the stack, or otherwise significantly changes the object on the stack.

If you don't include an operator, but there is an object, it will append by default. This is just syntactic sugar for less typing.

### Flow Operations
[#] [identifier] [space-seperated parameters] [{code block}]

Stack operations are a symbol followed by an identifier. 

Flow operators all start with their own symbol: # 

{ } are code blocks, start and stop. They are exclusively used for flow operators. These are the normal code flow elements you might expect: loops and branching.

The @ symbol names a local variable within a flow operation. Repeat takes an optional named variable which can then be looked up (without the @)

\# repeat @i -20 20 10 {
    circle >
    | |x i
    .
}

### Other Operations
Define "def" is like copy/pasting it's children around. It's real useful!
