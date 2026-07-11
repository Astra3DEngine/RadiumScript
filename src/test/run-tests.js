// Self-test: runs all spec samples from docs/spec/tests.md and compares output.
import { run } from "../index.js";

const cases = [
  {
    name: "作用域遮蔽",
    code: `{
    var a = 114;
    print(a);
    {
        var a = 514;
        print(a);
    }
    print(a);
}`,
    expect: "114\n514\n114\n",
  },
  {
    name: "块内 break",
    code: `{
    print(1);
    break;
    print(2);
}
print(3);`,
    expect: "1\n3\n",
  },
  {
    name: "循环中的内层块 break",
    code: `var x = 0;
while (x < 2) {
    x++;
    {
        print(x);
        break;
    }
    print("after");
}`,
    expect: "1\nafter\n2\nafter\n",
  },
  {
    name: "循环 continue",
    code: `var x = 0;
while (x < 4) {
    x++;
    if (x == 2) {
        continue;
    }
    print(x);
}`,
    expect: "1\n3\n4\n",
  },
  {
    name: "函数 return 穿过 if",
    code: `def test(a) {
    if (a > 0) {
        return 1;
    }
    return 0;
}

print(test(1));
print(test(0));`,
    expect: "1\n0\n",
  },
  {
    name: "块表达式返回值",
    code: `var a = 3;
var b = {print("calc"); return 5 ** a;};
print(b);`,
    expect: "calc\n125\n",
  },
  {
    name: "switch 穿透",
    code: `var abc = 2;
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
}`,
    expect: "two\ndefault\n",
  },
  {
    name: "switch 中的嵌套块 break",
    code: `var abc = 1;
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
}`,
    expect: "inner\ncase\n",
  },
  {
    name: "默认参数",
    code: `def test(a = 1,b = 2,c = [1,2,3]) {
    print(a);
    print(b);
    print(c.len());
}

test(9);`,
    expect: "9\n2\n3\n",
  },
  {
    name: "对象字面量",
    code: `var p = {x:10,y:20};
print(p.x);
print(p.y);`,
    expect: "10\n20\n",
  },
  {
    name: "指数和一元负号",
    code: `print(-2 ** 2);
print((-2) ** 2);
print(2 ** 3 ** 2);`,
    expect: "-4\n4\n512\n",
  },
  {
    name: "带标签的 break 退出循环",
    code: `var x = 0;
loop: while (x < 10) {
    x++;
    if (x == 3) {
        break loop;
    }
    print(x);
}
print("end");`,
    expect: "1\n2\nend\n",
  },
  {
    name: "break if 退出循环",
    code: `var x = 0;
while (x < 10) {
    x++;
    break if (x == 3);
    print(x);
}
print("end");`,
    expect: "1\n2\nend\n",
  },
  {
    name: "嵌套循环 break 外层",
    code: `var i = 0;
outer: while (i < 3) {
    var j = 0;
    while (j < 3) {
        if (i == 1 && j == 1) {
            break outer;
        }
        print(i * 10 + j);
        j++;
    }
    i++;
}
print("end");`,
    expect: "0\n1\n2\n10\nend\n",
  },
  {
    name: "continue 标签跳到外层循环",
    code: `var i = 0;
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
}`,
    expect: "11\n21\n31\n",
  },
  {
    name: "多分支 else if 链",
    code: `def grade(s) {
    if (s >= 90) {
        return "A";
    } else if (s >= 80) {
        return "B";
    } else if (s >= 60) {
        return "C";
    } else {
        return "D";
    }
}

print(grade(95));
print(grade(85));
print(grade(70));
print(grade(50));`,
    expect: "A\nB\nC\nD\n",
  },
  {
    name: "模块别名 (sys.time int)",
    code: `import sys as s;
print(type(s.argv));`,
    expect: "list\n",
  },
  {
    name: "math sin degrees",
    code: `import math;
print(math.sin(30));`,
    expect: "0.5\n",
  },
  {
    name: "列表方法",
    code: `var a = ["114","514","191"];
print(a.len());
print(a.in("114"));
print(a[-1]);`,
    expect: "3\ntrue\n191\n",
  },
  {
    name: "运算类型提升",
    code: `print(1 + "2");
print(true + 1);
print(NULL + 1);
print([1] + [2]);`,
    expect: "12\n2\n1\n[1, 2]\n",
  },
  {
    name: "块作用域 (README 示例)",
    code: `{
    var a = 114;
    print(a);
    {
        var a = 514;
        print(a);
    }
    print(a);
}`,
    expect: "114\n514\n114\n",
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const { output, error } = run(c.code);
  if (error) {
    console.log(`FAIL  ${c.name}  -> ERROR: ${error.message}`);
    fail++;
  } else if (output === c.expect) {
    console.log(`PASS  ${c.name}`);
    pass++;
  } else {
    console.log(`FAIL  ${c.name}`);
    console.log(`  expected: ${JSON.stringify(c.expect)}`);
    console.log(`  got:      ${JSON.stringify(output)}`);
    fail++;
  }
}
console.log(`\n${pass} passed, ${fail} failed (${cases.length} total)`);
process.exit(fail ? 1 : 0);
