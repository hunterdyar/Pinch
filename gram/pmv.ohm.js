const pnvGrammar = `
PNV {
    
   Program = 
   Statement* end
   
  sourceCharacter = any
  space := whitespace | lineTerminator | comment
  whitespace = "\t"
             | "\x0B"    -- verticalTab
             | "\x0C"    -- formFeed
             | " "
             | "\u00A0"  -- noBreakSpace
             | "\uFEFF"  -- byteOrderMark
             | unicodeSpaceSeparator
             
  spacesNoNL = 
  ~"\\n" (whitespace | singleLineComment )*

bodyDelim = ("\\n" | ";")

  lineTerminator = "\\n" | "\\r" | "\\u2028" | "\\u2029"
  lineTerminatorSequence = "\\n" | "\\r" ~"\\n" | "\\u2028" | "\\u2029" | "\\r\\n"
    unicodeSpaceSeparator = "\\u2000".."\\u200B" | "\\u3000"

  comment = multiLineComment | singleLineComment
  multiLineComment = "/*" (~"*/" sourceCharacter)* "*/"
  singleLineComment = "//" (~lineTerminator sourceCharacter)*
   identifier (an identifier) =  identifierName // ~reservedWord
  identifierName = identifierStart identifierPart*

  identifierStart = letter | "$" | "_" | "@"
                 // | "\\" unicodeEscapeSequence -- escaped
  identifierPart = identifierStart 
  				//| unicodeCombiningMark
                 //| unicodeDigit | unicodeConnectorPunctuation
                 | "\u200C" | "\u200D"
	

    sc = space* (";" | end)
     | spacesNoNL (lineTerminator | &".")

    doProc = ">"
    stopProc = "." ~digit
    define = "def"

    ProcBody = 
    doProc BodyStatement stopProc
    | doProc BodyStatement* stopProc

	DefineElementStatement =
    define ident ProcBody

	literal = 
    ~stopProc ident
    | ~stopProc number
  
   Statement =
  Procedure
  | ObjectAndBodyStatement
  | DefineElementStatement
  | objectStatement

ObjectAndBodyStatement =
objectStatement ProcBody

objectStatement =
//| ident Object #sc?

| ident whitespace? listOf<object,whitespace>
    
    BodyStatement =
    Transformation
    | ObjectAndBodyStatement
    | objectStatement
 
    
    Procedure
    = 
     ProcBody
    
    object
    = ident 
    | literal
    
    
    Transformation
    = pipe objectStatement

	pipe = "|"

  ident  (an identifier)
    = ~reservedKeyword letter ("-" | "_" | alnum)* 
    
    reservedKeyword =
    define

  number  (a number)
    = "-"? digit* "." digit+  -- fract
    | "-"? digit+             -- whole
    

}
`

export {pnvGrammar}