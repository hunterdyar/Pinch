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

    doPush = ">"
    doPop = "." ~digit
    doAppend = "+"
    doAlter = "~" | "^"
 	doFlow = "#"
    pipe = "|"
    doLabel = "@"
    startBlock = "{"
    endBlock = "}"
    
    operator = doPush | doPop | doAlter | pipe | doAppend | doFlow | doLabel

    define = "def"

	DefineNamedStatement =
    define ident doPush

	literal = 
    ~operator ident
    | ~operator number
    
    Statement = 
    MetaStatement
|   ObjectStatement
    
    StatementBlock = 
    startBlock Statement* endBlock
    
  ObjectStatement =
  | DefineNamedStatement
  | Transformation
  | AppendOperation
  | objectStatement
  | FlowOperation
  
   MetaStatement =
  | PushOperation
  | PopOperation

PopOperation =
doPop

objectStatement =
//| ident Object #sc?
| ident whitespace? listOf<object,whitespace>
    
    PushOperation =
    (ObjectStatement | AppendOperation) doPush
    AppendOperation =
    doAppend objectStatement
    Transformation
    = pipe objectStatement
    
    FlowOperation =
    doFlow objectStatement StatementBlock?
    
    label = doLabel ident
   
    object
    = ~operator ident 
    | ~operator literal
    | label

  ident  (an identifier)
    = ~reservedKeyword letter ("-" | "_" | alnum)* 
    
    reservedKeyword =
    operator | define

  number  (a number)
    = "-"? digit* "." digit+  -- fract
    | "-"? digit+             -- whole
    
}
`

export {pnvGrammar}