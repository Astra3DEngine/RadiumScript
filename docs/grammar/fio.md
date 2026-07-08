# 导入导出

***

> 我不知道为什么你喜欢分这么多文件……

## 导入

- `import <library>;` 导入某个代码库
- `import "<filename>";` 将名为`filename`的文件内容嵌入到本文件中

>在导入的时候，会自动防止重复导入。

你可以通过`import amns`来导入一个名为`amns`的代码库，它将作为一段代码嵌入在你的文件之中。你可以创建一个名为`amns.rdl`的文件，它将被视为一个代码库。但是导入代码库的时候，它的有限查找顺序如下：`内置代码库里的文件` > `同目录文件` > `配置的用户库路径的文件`。

导入代码文件的时候，你应该在导入的字符串中键入一个相对路径(虽然绝对路径也是可以的，理论上)。比如你可以导入一个在`/plugin/counter.rds`的文件，你可以通过`import "./plugin/counter.rds"`来导入它，它被视为一段代码插入在当前文件之中，并直接包含在当前的局部域中。如果你在这个文件里定义了`awa()`函数，那么其他导入该文件的文件就可以直接调用函数`awa()`。

如果你导入了代码库比如`sys`，那么它里面的函数方法将有属于它们的名称空间`sys`，比如你可以调用`sys.time()`来获取当前时间。如果你不喜欢`sys`这个名称空间，你可以为它设置一个**别名**比如`s`，方法只需要在导入的时候添加内容：

```javascript
import sys as s;
```

同理，你导入了`amns.rdl`，那么它的名称空间就是文件名。别名依旧适用！

## 导出

- `export <fn/class>` 导出某个函数/类

这个关键字只能在`.rdl`文件被使用，因为`.rdl`通常被视为一个模块，一个定义文件，而真正运行的文件是`.rds`，其被视为一个实例。

比如我定义了一个`awa.rdl`并做出如下定义：

```javascript
import sys;

class timer {
    private:
        var time;
    public:
        def settime(var time) {
            this.time = time;
        }

        def time() {
            return this.time;
        }

        var nowtime = sys.time();
}

def nowtime() {
    return sys.time();
}

export timer;
export nowtime;
```

然后，我现在在主函数文件`main.rds`中如是写到：

```javascript
import awa; // 导入 awa.rdl 文件

def main() {
    var a = awa.timer(); // 创建一个实例对象 a
    a.settime(1); // 调用对象 a 内部的函数
    print(a.time()); // 输出 1
    print(a.nowtime); // 输出当前时间
    print(awa.nowtime()); // 输出当前时间，但是使用导入的文件的名称空间
    return 0;
}

main();
```