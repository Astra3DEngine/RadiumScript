# 对象和类

***

> 让我看看，谁还不能写OOP呢……

## 对象和类
- `class <name> {code}` 定义一个类名为`<name>`，其中`{code}`是类中的方法

> 类中可以定义数据类型，也可以定义函数

- `var <object> = <name>();` 定义一个名为`<object>`的`<name>`对象
- `<object>.<content>` 访问或调用成员

可以在类中定义一个名为`init()`的函数，将作为构造函数在创建对象的时候执行。如果构造函数需要传入参数，我们建议你设置一个默认值，因为构造函数会**在对象被创建的时候执行**，如果不手动执行的话。没有默认值会导致报错！值得一提的事，构造函数一般不返回值。

我们还需要`private`和`public`。`private`里的内容只能被类成员访问，而`public`可以被外面的东西访问。如果一个类里的东西想要访问或者调用自己的成员，使用`this`来代替对象名称。

> 暂时不支持继承类

给出例子：

```javascript
class test {
    private:
        var awa = NULL; // 空变量
        var qwq = [];
    public:
        def init() {
            this.qwq = [""]; // 初始化列表
        }

        def test(var a) {
            this.awa = a;
        }

        def test2() {
            print(this.qwq,this.awa);
        }
}
```

这里需要注意的是，`private`必须在`public`之前，而且`private`是非必须的。

如果需要创建一个对象，只需要：

```javascript
var abcd = test(); // 调用构造函数
```

调用成员更是简单：

```javascript
abc.test(1);
abc.test2();
```