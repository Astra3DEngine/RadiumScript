# 编译到 JavaScript

***

> RadiumScript 可以由 JavaScript 解释器直接执行，也可以编译成 JavaScript 再运行。两种运行方式必须使用同一套语义。

## 基本原则

- 用户语法不暴露 JavaScript 标签。
- 编译器可以为普通代码块自动生成内部标签。
- 运行时值、类型转换和控制流行为必须和解释器一致。
- 生成的 JavaScript 不需要保持源码外观，只需要保持行为一致。

## 值映射

| RadiumScript | JavaScript 建议映射 |
| --- | --- |
| `NULL` | `null` |
| `INF` | `Infinity` |
| `NaN` | `NaN` |
| `true` / `false` | `true` / `false` |
| 列表 | `Array` |
| 对象字面量 | plain object |
| 类实例 | JS class 实例或运行时对象 |
| 函数 | JS function |

建议提供一个小型运行时库处理 `type()`、严格相等、真值、列表负数索引、成员访问和类型转换，不要完全依赖 JavaScript 的隐式转换。

## 代码块和 break

RadiumScript 的 `break` 退出最近代码块。JavaScript 需要标签才能从普通代码块中 `break`，所以编译器应自动生成标签。

RadiumScript：

```javascript
{
    print(1);
    break;
    print(2);
}
print(3);
```

JavaScript：

```javascript
__rs_block_1: {
    print(1);
    break __rs_block_1;
    print(2);
}
print(3);
```

嵌套块应生成嵌套标签，`break` 指向最近块标签。

## continue

`continue` 只允许用于循环。编译器应检查当前位置是否处于循环内部。

RadiumScript：

```javascript
while (x < 5) {
    x++;
    if (x == 3) {
        continue;
    }
    print(x);
}
```

JavaScript：

```javascript
while (rs_truthy(x < 5)) {
    x++;
    __rs_block_1: {
        if (rs_truthy(rs_eq(x, 3))) {
            continue;
        }
        print(x);
    }
}
```

如果 `continue` 出现在没有外层循环的位置，编译阶段应报错。

## return 和块表达式

函数中的 `return` 可以直接编译为 JavaScript `return`。块表达式需要包装成可立即执行的函数或运行时结构。

RadiumScript：

```javascript
var b = {print("calc"); return 5;};
```

JavaScript：

```javascript
let b = (() => {
    print("calc");
    return 5;
})();
```

如果块表达式中包含 `break`，它只退出块表达式内部最近代码块，不退出外层语句。

## switch

RadiumScript 的 `switch` 支持 fallthrough。由于 `break` 在普通代码块中退出最近代码块，而在 `case` 或 `default` 顶层直接使用时结束整个 `switch`，编译器不能简单地把每个 `case` 直接映射为 JS `case` 内的普通块后使用裸 `break`。建议将 `switch` 编译为内部状态机或带标签的结构，区分顶层 `case` 的 `break` 和嵌套代码块里的 `break`。

一种简单策略是：

```javascript
__rs_switch_1: {
    let __rs_matched = false;
    if (!__rs_matched && rs_eq(index, item1)) __rs_matched = true;
    if (__rs_matched) {
        // case 1 block
        break __rs_switch_1;
    }
    if (!__rs_matched && rs_eq(index, item2)) __rs_matched = true;
    if (__rs_matched) {
        // case 2 block
    }
    if (__rs_matched || true) {
        // default block
    }
}
```

实际实现可以更紧凑，但必须保持 fallthrough 和 `break` 语义。

## 名称空间和模块

`namespace` 是词法名称空间，建议编译为内部对象或闭包环境，并用 `::` 访问其成员。

`import` 产生模块对象式名称空间，使用 `.` 访问。它不等同于 `namespace`，可以编译为模块对象或运行时库对象。

## 类

类可以编译为 JS class，也可以编译为运行时对象构造函数。无论选择哪种方式，都必须保持这些规则：

- `init()` 是构造函数。
- `private` 成员只能被类成员访问。
- `public` 成员可被外部访问。
- `this` 指向当前实例。
- 暂时不支持继承。
