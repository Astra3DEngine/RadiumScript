# 输入和输出

***

> 获取用户输入和打印内容是计算机和外界交流的重要方式。

## 输入相关

- `input(<content>)` 获取用户输入并返回，在获取之前打印`<content>`

获取到用户的输入之后，将会自动确定输入的类型。

可用的方法:

- `.fill(<list>[],"ch")` 将用户输入以`"ch"`字符分割后覆盖到列表中。比如`input().fill(<list>[]," ");`就是以空格分隔输入并覆盖到`<list>`中，这个时候，`input()`不返回值
- `.sfill(<list>[])` 将用户输入单个字符拆分后覆盖到列表中

## 输出相关

- `print(<content>);` 打印`<content>`并换行
- `print(<content>,<char>);` 打印`<content>`并以字符`<char>`(任意表达式)结尾

可用的方法:

- `printf(<content>,<rule>);` 以`<rule>`为规则打印`<content>`

可用的`<rule>`:

- `%b<n>` 保留`<n>`位有效数字
- `%f<n>` 保留`<n>`位小数
- `%n` 转换字符为 Unicode 编码后打印
- `%nh` 转换字符为 Unicode 编码(十六进制)后打印

比如，你可以使用`printf("Nyan~","%n")`，将字符串`Nyan~`转换为连接的 Unicode 码后打印，这里应该输出的是`7812197110126`。哦，我知道这样根本分不清谁是谁，没关系，我也分不清。

有意思的是，如果你运行下面的内容：
```cpp
import math;
var pi = math.pi;
printf(pi,"%b5");
printf(pi,"%f4");
```
那么它们的输出应该是：
```text
3.1415
3.1415
```