# 控制流规范

***

> 本文定义 `return`、`break`、`continue` 和 `switch` 的执行方式。它们应在解释器和 JavaScript 编译目标中保持一致。

## 控制流信号

RadiumScript 的控制流可以看作三种信号：

- `return` 信号，携带一个返回值。
- `break` 信号，表示退出最近的代码块。
- `continue` 信号，表示进入最近循环的下一次迭代。

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

`break;` 退出当前最近的代码块。函数体、循环体、`if` 主体、`switch` 中的 `case` 块、普通 `{...}` 块都属于代码块。

```javascript
while (x <= 5) {
    x++;
    {
        print(x);
        break;
    }
    print("after inner block");
}
```

上面的 `break` 只退出内部普通代码块，不退出 `while`。因此 `print("after inner block")` 仍会执行。

如果要退出循环，可以把 `break` 直接写在循环体当前层级：

```javascript
while (x <= 5) {
    x++;
    print(x);
    break;
}
```

由于 `break` 总是退出最近代码块，RadiumScript 不提供用户可见的代码块标签。编译到 JavaScript 时，编译器可以自动为代码块生成内部标签。

## continue

`continue;` 只能用于循环语句。它跳过当前循环剩余代码，进入下一轮迭代判断。

```javascript
while (x < 5) {
    x++;
    if (x == 3) {
        continue;
    }
    print(x);
}
```

`continue` 不能用于普通代码块、`switch`、函数体、类主体或名称空间主体，除非它们位于循环内部并且目标是最近的循环。

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
| `break` | 最近的代码块 |
| `continue` | 最近的循环 |

如果 `continue` 找不到外层循环，应报错。
