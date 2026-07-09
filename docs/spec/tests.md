# 规范测试样例

***

> 本文不是自动测试框架，而是一组用于检查解释器和 JavaScript 编译结果是否一致的样例。每个样例都应在两种运行方式下得到相同输出。

## 作用域遮蔽

```javascript
{
    var a = 114;
    print(a);
    {
        var a = 514;
        print(a);
    }
    print(a);
}
```

期望输出：

```text
114
514
114
```

## 块内 break

```javascript
{
    print(1);
    break;
    print(2);
}
print(3);
```

期望输出：

```text
1
3
```

## 循环中的内层块 break

```javascript
var x = 0;
while (x < 2) {
    x++;
    {
        print(x);
        break;
    }
    print("after");
}
```

期望输出：

```text
1
after
2
after
```

## 循环 continue

```javascript
var x = 0;
while (x < 4) {
    x++;
    if (x == 2) {
        continue;
    }
    print(x);
}
```

期望输出：

```text
1
3
4
```

## 函数 return 穿过 if

```javascript
def test(a) {
    if (a > 0) {
        return 1;
    }
    return 0;
}

print(test(1));
print(test(0));
```

期望输出：

```text
1
0
```

## 块表达式返回值

```javascript
var a = 3;
var b = {print("calc"); return 5 ** a;};
print(b);
```

期望输出：

```text
calc
125
```

## switch 穿透

```javascript
var abc = 2;
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

期望输出：

```text
two
default
```

## switch 中的嵌套块 break

```javascript
var abc = 1;
switch (abc) {
    case 1 : {
        {
            print("inner");
            break;
        }
        print("case");
        break;
    }
    default : {
        print("default");
    }
}
```

期望输出：

```text
inner
case
```

## 默认参数

```javascript
def test(a = 1,b = 2,c = [1,2,3]) {
    print(a);
    print(b);
    print(c.len());
}

test(9);
```

期望输出：

```text
9
2
3
```

## 对象字面量

```javascript
var p = {x:10,y:20};
print(p.x);
print(p.y);
```

期望输出：

```text
10
20
```

## 指数和一元负号

```javascript
print(-2 ** 2);
print((-2) ** 2);
print(2 ** 3 ** 2);
```

期望输出：

```text
-4
4
512
```

## 模块别名

```javascript
import sys as s;
print(type(s.time()));
```

期望输出：

```text
int
```

如果 `sys.time()` 的实现返回浮点时间戳，则最后一行可调整为 `float`，但解释器和 JS 编译结果必须一致。
