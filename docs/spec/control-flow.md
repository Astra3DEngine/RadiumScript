# 控制流规范

***

> 本文定义 `return`、`break`、`continue` 和 `switch` 的执行方式。它们应在解释器和 JavaScript 编译目标中保持一致。

## 控制流信号

RadiumScript 的控制流可以看作三种信号：

- `return` 信号，携带一个返回值。
- `break` 信号，表示退出某个代码块。
- `continue` 信号，表示进入某个循环的下一次迭代。

`break` 和 `continue` 可以不带标签，也可以带标签。不带标签时分别作用于最近的代码块和最近的循环；带标签时，信号向外传播，跳过中间不匹配的结构，直到命中带有该标签的结构。

普通执行没有信号。代码块、函数、循环和 `switch` 根据规则消费这些信号。

## return

`return;` 返回 `NULL`。`return <value>;` 返回表达式值。

在函数体内，`return` 退出整个函数，即使它出现在嵌套的 `if`、循环或普通代码块中。

```javascript
def test(a) {
    if (a > 0) {
        return 1;
    }
    return 0;
}
```

在块表达式中，`return` 结束当前块表达式并把值交给表达式位置。

```javascript
var b = {print("calc"); return 5;};
```

语句位置的普通代码块不产生值。如果普通代码块位于函数内部，其中的 `return` 仍返回当前函数。

## break

`break;` 退出当前最近的代码块。函数体、循环体、`if` 主体、`switch` 中的 `case` 块、普通 `{...}` 块都属于代码块。把 `break` 直接写在循环体当前层级会退出循环。

```javascript
while (x <= 5) {
    x++;
    print(x);
    break;
}
```

`break` 只退出最近代码块，因此当它出现在更内层的块里时不会退出循环。普通内层块如此，`if` 主体也是如此：

```javascript
while (x < 10) {
    x++;
    {
        print(x);
        break;          // 只退出内层普通块
    }
    print("after");
}

while (x < 10) {
    x++;
    if (x == 5) {
        break;          // 只退出 if 块，循环继续
    }
    print(x);
}
```

要在特定条件下退出循环，RadiumScript 提供两种写法：带标签的 `break` 和条件形式的 `break if`。

### 带标签的 break

在 `while`、`do-while`、`switch` 或普通代码块前加上 `label:` 即可给它打标签，然后用 `break <label>;` 退出带有该标签的结构。带标签的信号会向外传播，跳过中间的 `if` 块和普通块，直到命中同名标签。

```javascript
loop: while (x < 10) {
    x++;
    if (x == 5) {
        break loop;     // 跳过 if 块，退出 while
    }
    print(x);
}
```

标签打在外层循环上可以一次退出多层嵌套：

```javascript
outer: while (i < n) {
    while (j < m) {
        if (done) {
            break outer;
        }
    }
}
```

标签也可以打在普通代码块上：

```javascript
search: {
    if (found) {
        break search;
    }
    // 其他内容
}
```

`break <label>;` 引用的标签必须在当前作用域内可见，否则为编译期错误。标签的作用域是它所修饰的结构体内部；同名标签嵌套时以最近的一层为准。

### 条件 break

`break if (<expression>);` 是简写：当 `<expression>` 为真时发出一个普通 `break` 信号，目标仍是当前最近的代码块。

```javascript
while (x < 10) {
    x++;
    break if (x == 5);
    print(x);
}
```

它和 `if (<expression>) { break; }` 的关键区别在于：`break if` 是单条语句，不会新建 `if` 块，因此 `break` 信号的目标是外层（这里是循环体）而不是一个新的 `if` 块。所以 `break if` 写在循环体当前层级时能退出循环；若把它嵌进更深的块里，它的目标就变成那个块，此时应改用带标签的 `break`。

带标签与条件形式可以组合：`break <label> if (<expression>);` 表示当条件成立时退出带有 `<label>` 的结构。

`switch` 对 `break` 的特例（在 `case` 或 `default` 顶层直接使用时结束整个 `switch`）保持不变；带标签的 `break` 也可以直接指向被标签修饰的 `switch`。编译到 JavaScript 时，用户书写的标签直接映射为对应的 JavaScript 标签，没有用户标签的普通代码块由编译器自动生成内部标签。

## continue

`continue;` 跳过当前循环剩余代码，进入最近循环的下一轮迭代判断。`continue` 只能用于循环；它不会被普通代码块、`if`、`switch`、函数体、类主体或名称空间主体消费，会直接向外传播到最近的循环。

```javascript
while (x < 5) {
    x++;
    if (x == 3) {
        continue;       // 跳过 if 块，作用于 while
    }
    print(x);
}
```

`continue <label>;` 进入带有该标签的循环的下一轮迭代，用于在嵌套循环中继续外层循环：

```javascript
outer: while (i < 3) {
    i++;
    var j = 0;
    while (j < 3) {
        j++;
        if (j == 2) {
            continue outer;
        }
        print(i * 10 + j);
    }
}
```

`continue if (<expression>);` 是简写：条件为真时发出普通 `continue` 信号。由于普通 `continue` 本就能穿过 `if` 块，`continue if` 只是 `if (<expression>) { continue; }` 的语法糖。组合形式 `continue <label> if (<expression>);` 同样允许。

如果 `continue` 找不到外层循环，应报错。

## switch

`switch` 使用严格相等比较。命中某个 `case` 后执行其代码块，并继续执行后续 `case` 或 `default`，直到 `switch` 结束或在当前 `case` 代码块顶层遇到 `break`。

```javascript
switch (abc) {
    case 1 : {
        print("one");
        break;
    }
    case 2 : {
        print("two");
    }
    default : {
        print("default");
    }
}
```

`switch` 对 `break` 有一个特例：在 `case` 或 `default` 代码块顶层直接使用 `break` 时，它会结束整个 `switch` 的后续执行。若 `break` 位于 `case` 内部的嵌套普通代码块中，则仍只退出最近的嵌套代码块。

```javascript
switch (abc) {
    case 1 : {
        {
            break;
        }
        print("still in case");
        break;
    }
}
```

上例中第一个 `break` 只退出内部普通代码块，第二个 `break` 结束 `switch`。编译到 JavaScript 时可以用内部标记或自动标签保持这个行为。

## 嵌套规则

控制流信号从内向外传播，直到被能处理它的结构消费。

| 信号 | 消费者 |
| --- | --- |
| `return` | 最近的函数或块表达式 |
| `break`（无标签） | 最近的代码块 |
| `break <label>` | 带有 `<label>` 的结构（`while`、`do-while`、`switch` 或普通代码块） |
| `continue`（无标签） | 最近的循环 |
| `continue <label>` | 带有 `<label>` 的循环 |

不带标签的信号会被路过的第一个可消费结构截获；带标签的信号会跳过不匹配的结构，直到命中同名标签。`break <label>` 引用不到的标签、`continue` 找不到外层循环时，均应报错。
