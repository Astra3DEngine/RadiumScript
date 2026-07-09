# 形式化语法

***

> 本文给出 RadiumScript 的核心语法结构。这里的写法不是完整解析器代码，而是用于约束解释器、编译器和文档示例的语法规范。

## 词法

```ebnf
identifier      = letter , { letter | digit | "_" } ;
number          = integer | float ;
integer         = digit , { digit } ;
float           = digit , { digit } , "." , digit , { digit } ;
string          = '"' , { character | escape } , '"' ;
boolean         = "true" | "false" ;
null            = "NULL" ;
infinity        = "INF" ;
nan             = "NaN" ;
literal         = number | string | boolean | null | infinity | nan ;
```

标识符不能使用关键字。关键字包括：`var`、`const`、`def`、`return`、`if`、`else`、`switch`、`case`、`default`、`while`、`do`、`break`、`continue`、`class`、`private`、`public`、`this`、`namespace`、`import`、`as`、`export`、`true`、`false`、`NULL`、`INF`、`NaN`。

## 程序结构

```ebnf
program         = { topLevelStatement } ;

topLevelStatement
                = importStatement
                | exportStatement
                | statement
                | functionDecl
                | classDecl
                | namespaceDecl ;
```

`.rds` 文件表示可执行代码文件，`.rdl` 文件表示库文件。`export` 只能在 `.rdl` 文件中使用。

## 语句

```ebnf
statement       = block
                | varDecl
                | constDecl
                | assignment , ";"
                | expression , ";"
                | ifStatement
                | switchStatement
                | whileStatement
                | doWhileStatement
                | returnStatement
                | breakStatement
                | continueStatement
                | labeledStatement ;

block           = "{" , { statement | functionDecl | classDecl | namespaceDecl } , "}" ;
varDecl         = "var" , identifier , [ "=" , expression ] , ";" ;
constDecl       = "const" , identifier , "=" , expression , ";" ;
assignment      = leftValue , "=" , expression ;
leftValue       = identifier , { memberAccess | indexAccess | namespaceAccess } ;
```

语句位置的 `{...}` 永远表示代码块。表达式位置的 `{...}` 根据内容表示对象字面量或块表达式。

## 表达式

```ebnf
expression      = assignmentExpr ;
assignmentExpr  = ternaryExpr | leftValue , "=" , assignmentExpr ;
ternaryExpr     = logicalOrExpr , [ "?" , expression , ":" , expression ] ;
logicalOrExpr   = logicalAndExpr , { "||" , logicalAndExpr } ;
logicalAndExpr  = equalityExpr , { "&&" , equalityExpr } ;
equalityExpr    = compareExpr , { ( "==" | "!=" ) , compareExpr } ;
compareExpr     = addExpr , { ( ">" | "<" | ">=" | "<=" ) , addExpr } ;
addExpr         = mulExpr , { ( "+" | "-" ) , mulExpr } ;
mulExpr         = unaryExpr , { ( "*" | "/" | "%" ) , unaryExpr } ;
unaryExpr       = ( "!" | "-" ) , unaryExpr | powerExpr ;
powerExpr       = postfixExpr , [ "**" , unaryExpr ] ;
postfixExpr     = primaryExpr , { memberAccess | namespaceAccess | indexAccess | call | postfixUpdate } ;
```

`**` 为右结合，因此 `2 ** 3 ** 4` 等价于 `2 ** (3 ** 4)`。一元负号在指数运算外侧生效，因此 `-2 ** 2` 等价于 `-(2 ** 2)`。

```ebnf
primaryExpr     = literal
                | identifier
                | listLiteral
                | objectLiteral
                | blockExpression
                | "(" , expression , ")" ;

listLiteral     = "[" , [ expression , { "," , expression } ] , "]" ;
objectLiteral   = "{" , [ objectPair , { "," , objectPair } ] , "}" ;
objectPair      = identifier , ":" , expression ;
blockExpression = "{" , { statement } , "}" ;
memberAccess    = "." , identifier ;
namespaceAccess = "::" , identifier ;
indexAccess     = "[" , expression , "]" ;
call            = "(" , [ expression , { "," , expression } ] , ")" ;
postfixUpdate   = "++" | "--" ;
```

对象字面量的成员名必须是标识符。`++` 和 `--` 只能作为后缀运算符使用。

## 函数

```ebnf
functionDecl    = "def" , identifier , "(" , [ param , { "," , param } ] , ")" , ( block | ";" ) ;
param           = identifier , [ "=" , expression ] ;
returnStatement = "return" , [ expression ] , ";" ;
```

函数参数按值传入。没有显式返回值时返回 `NULL`。函数声明需要在调用前可见，可以用以分号结尾的元数据声明提前声明函数。

## 分支和循环

```ebnf
ifStatement     = "if" , "(" , expression , ")" , block , [ "else" , block ] ;

switchStatement = "switch" , "(" , expression , ")" , "{" , { caseClause } , [ defaultClause ] , "}" ;
caseClause      = "case" , expression , ":" , block ;
defaultClause   = "default" , ":" , block ;

whileStatement  = "while" , "(" , expression , ")" , block ;
doWhileStatement
                = "do" , block , "while" , "(" , expression , ")" , ";" ;

breakStatement  = "break" , [ identifier ] , [ "if" , "(" , expression , ")" ] , ";" ;
continueStatement
                = "continue" , [ identifier ] , [ "if" , "(" , expression , ")" ] , ";" ;
labeledStatement
                = identifier , ":" , ( whileStatement | doWhileStatement | switchStatement | block ) ;
```

`break` 和 `continue` 后跟标识符表示带标签形式，跟 `if (...)` 表示条件形式，两者可组合；由于标识符不能是关键字，`break if` 与 `break <label>` 不会冲突。标签只能修饰 `while`、`do-while`、`switch` 或普通代码块；语句开头的 `identifier ":"` 只能是标签。具体执行规则见[控制流规范](spec/control-flow.md)。

## 类和名称空间

```ebnf
classDecl       = "class" , identifier , "{" , [ privateSection ] , publicSection , "}" ;
privateSection  = "private" , ":" , { classMember } ;
publicSection   = "public" , ":" , { classMember } ;
classMember     = varDecl | constDecl | functionDecl ;

namespaceDecl   = "namespace" , identifier , block ;
```

`private` 必须在 `public` 之前，且 `private` 可省略。类内访问自身成员使用 `this`。

## 导入和导出

```ebnf
importStatement = "import" , ( identifier | string ) , [ "as" , identifier ] , ";" ;
exportStatement = "export" , identifier , ";" ;
```

库导入形成模块对象式名称空间，使用 `.` 访问；`namespace` 形成词法名称空间，使用 `::` 访问。
