const pnvGrammar = String.raw`
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
  ~"\n" (whitespace | singleLineComment )*

bodyDelim = ("\n" | ";")

  lineTerminator = "\n" | "\r" | "\u2028" | "\u2029"
  lineTerminatorSequence = "\n" | "\r" ~"\n" | "\u2028" | "\u2029" | "\r\n"
    unicodeSpaceSeparator = "\u2000".."\u200B" | "\u3000"

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
              
	 // String things taken from JS examples but no raw unicode or unicode escape sequence.
     //for now, just keeping it simple while i can.
  stringLiteral = "\"" doubleStringCharacter* "\""
 //               | "'" singleStringCharacter* "'"
  doubleStringCharacter = ~("\"" | "\\" | lineTerminator) sourceCharacter -- nonEscaped
                        | "\\" characterEscapeSequence                             -- escaped
                        | lineContinuation                                -- lineContinuation
  singleStringCharacter = ~("'" | "\\" | lineTerminator) sourceCharacter -- nonEscaped
                        | "\\" characterEscapeSequence                            -- escaped
                        | lineContinuation                               -- lineContinuation
  lineContinuation = "\\" lineTerminatorSequence
  characterEscapeSequence = singleEscapeCharacter
                          | nonEscapeCharacter
  singleEscapeCharacter = "'" | "\"" | "\\" | "b" | "f" | "n" | "r" | "t" | "v"
  nonEscapeCharacter = ~(characterEscapeSequence | lineTerminator) sourceCharacter

  rawjsLiteral = "'" (~"'" sourceCharacter)* "'"

    
	sc = space* (";" | end)
     | spacesNoNL (lineTerminator | &".")

    doPush = ">"
    doPop = "." ~digit
    doAppend = "+"
    doAlter = "~" | "^"
 	  doFlow = "{"
    endFlow = "}"
    pipe = "|"
    doLabel = "@"
    doEnv = "#"
    
    operator = doPush | doPop | doAlter | pipe | doAppend | endFlow | doLabel | doEnv
    
	literal = 
    ~operator ident
    | ~operator number
    | ~operator stringLiteral
    | ~operator rawjsLiteral
    
  Statement = 
  MetaStatement
|   ObjectStatement
  
  FlowStatement = 
  doFlow objectStatement Statement* endFlow
  
  EnvStatement =
  doEnv objectStatement
    
  ObjectStatement =
  | Transformation
  | AppendOperation
  | objectStatement
  
  MetaStatement =
  | PushOperation
  | popOperation
  | FlowOperation
  | EnvStatement


  popOperation =
  | (doPop)+ doAppend
  | (doPop)+ objectStatement?

  objectStatement =
  //| ident Object #sc?
  | ident whitespace? listOf<object,whitespace>
      
  PushOperation =
  (ObjectStatement | AppendOperation | popOperation) doPush
  AppendOperation =
  doAppend objectStatement
  Transformation
  = pipe objectStatement
  
  FlowOperation =
  doFlow objectStatement Statement* endFlow
  
  label = doLabel ident
  
  object
  = ~operator ident 
  | ~operator literal
  | label

  ident  (an identifier)
    = ~reservedKeyword (letter | "#") ( "-" | "_" | "#" | alnum)* 
    
    reservedKeyword =
    operator 

  number  (a number)
    = "-"? digit* "." digit+  -- fract
    | "-"? digit+             -- whole
    
}
`

export {pnvGrammar}