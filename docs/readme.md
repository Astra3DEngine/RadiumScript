# <font color="66ccff">RadiumScript</font>
<small>注:以下内容为 **RadiumScript** 第三版内容</small>

***

## 简介
**RadiumScript** 是一个还需完善的解释性语言。

RadiumScript 支持 **局部变量**，**指针变量**，**复合结构**(比如结构体)，**面向对象编程** 等高级语言功能，通过编写 RS 代码并将其在解释器中运行，你可以为 RadiumOS 编写软件等。而且，RS 语法，虚拟机等都是开源的。

## 关于语法
RS 的语法借鉴了 C++ 、JavaScript 和 Python，所以我几乎可以用 C++ 的上色模式来上色 RS (当然，仅仅是我不喜欢 Python 而已)：

```cpp
import math;
var a;
a = input("Type a number:");
print(sin(a));
```

假如用户输入30，上述的代码就将在控制台输出`0.5`。在 RadiumScript ，你几乎可以像用 Scratch 一样写代码，就像某 SQY 制作的 S++ 一样。但是在下面的代码中，输出却既然不同。首先是 S++ 的代码：

```Python
a=114
print(a)
    a=514
    print(a)
print(a)
```

上述代码在 S++ 中(S++ 中使用缩进表示域)输出应该是：

```
114
114
114

```
然后是 RadiumScript ：

```cpp
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

上述代码在 RS 中(RadiumScript 中使用花括号表示域)输出应该是：

```
114
514
114
```

可以看出，相较于 S++，RS 拥有更直观的域表示，以及**局部域**的区别。

S++ 中，第二个赋值语句未正确执行，是因为这是错误语法。S++ 中本身没有域的概念，即使缩进表示域，也不能正确运行。在赋值给`a`的时候，S++ 的解释器将缩进和a连接起来作为了一个对象(即`  a`)赋值，所以导致错误。这很反直觉，但是事实就是如此。

RadiumScript 的定位是高级语言，所以也有 **OOP** 的概念。

## 关于文件

RadiumScript 的标准代码文件为`.rds`，而标准库文件为`.rdl`。

它们都可以是代码文件。其中，在`.rdl`文件中，你可以定义函数，类等，同时需要通过导出语法将某些函数/方法/类导出用于其他文件使用。

需要一个入口文件，这个文件通常是`main.rds`；该文件中需要一个主函数，通常是`main()`。你大可以像这样编写代码：

```cpp
import xxx;

def abc(var a) {
    // 其他函数定义
}

def main() {
    // 主函数定义
}

main();
```

是的，一个函数在调用之前需要被定义。如果你不想把主函数的定义写在最后面，你可以先定义元数据，然后再定义函数，就像：

```cpp
import xxx;

def abc(var a);

def main() {
    // 主函数定义
}

def abc(var a) {
    // 其他函数定义
}

main();
```

这就是基础结构，更多内容在其他文件进行描述。