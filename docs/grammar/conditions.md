# 分支与循环

***

> 最有用的语句，毕竟谁不喜欢if else嵌套呢?

## 分支语句

> 我们需要做判断，电脑也一样。

- `if (<condition>) {code}` 如果`<condition>`那么`{code}`
- `if (<condition>) {code} else {code}` 如果`<condition>`那么`{code}`反之执行下面的语句
- `if (<condition>) {code} else if (<condition2>) {code} ... else {code}` 多分支链，`else if` 是 `else { if (...) {...} }` 的扁平写法，可以在减少代码的情况下完成多个分支
- `<condition>?<value1>:<value2>` 三元运算符，如果`<condition>`成立，则返回`<value1>`，反之返回`<value2>`
- SWITCH 语句:执行`<index>`等于`<item>`(任意右值)后续的代码块，并且后续必须是代码块，不允许空值的存在

这会将`<index>`本身与`<item>`比较，当两者严格相等的时候，就会跳转执行，具体语法如下：

```javascript
switch (<index>) {
    case <item1>:{code1}
    case <item2>:{code2}
    ...
    case <item n>:{code n}
    default : {code}
}
```

执行完一个代码块会继续执行后续 switch 里的东西，直到出去！如果你想要执行的时候跳出去，那你需要再代码块结尾加上一个关键字`break`。

> 你不应该让两个`case`的条件一样！

这是一个示例：

```javascript
var abc = input();
switch (abc) {
    case 1 : {
        print("hello world!");
        break;
    }
    case 2 : {
        print("HELLO WORLD!");
    }
    default : {
        print("Haha! Caps Lock!");
    }
}
```

这段代码如果用户输入`1`，那么它将输出`hello world!`，如果用户输入`2`，那么它将输出`HELLO WORLD!` `换行` `Haha! Caps Lock!`，如果用户输入其他内容，那么它将输出`Haha! Caps Lock!`。

## 循环语句

> 人类的本质是复读姬!

- `while (<condition>) {code}` 重复执行直到`<condition>`不成立
- `do {code} while (<condition>);` 先执行一次之后判断成立
- `break;` 跳出当前最近的代码块
- `break <label>;` 跳出标记的代码块
- `break if (<conditional>);` 如果`<conditional>`成立则跳出最近的代码块
- `continue;` 回到当前循环的开头进行下一次迭代(只能用于循环语句)
- `continue <label>;` 进入标记的循环的下一次迭代
- `continue if (<conditional>);` 如果`<conditional>`成立则进入最近循环的下一次迭代

比如我可以编写下列代码：

```javascript
var x = 0;

while (x<5) {
    var a = x;
    print(a);
    x++;
}
```

它将会执行五次输出，输出的是`0` `1` `2` `3` `4`。

值得一提的是，如果你在一个域里面包括了另一个域，那么内部的域进行`break`只会退出最里面的域，比如下面的例子，它会退出内部打印的域而不是循环：

```javascript
while (x <= 5) {
    x++;
    {
        print(x);
        break;
    }
    // 其他内容
}
```

但是，如果你想要跳出循环，你只需要做出这样的更改：

```javascript
loop: while (x <= 5) {
    x++;
    {
        print(x);
        break loop;
    }
    // 其他内容
}
```