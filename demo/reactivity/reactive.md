# 【Build Your VueJS】——数据监听


首先我们要对我们的数据进行劫持，在vue2中使用的 defineProperty, defineProperty中的get和set方法对对象进行代理，然后进行相应的逻辑，defineProperty不能对数组进行代理，所以，在vue2中是对数组方法的扩展。网上有很多关于vue2数据响应原理的文章，感兴趣的话可以去了解一下。


我们今天主要分析 vue3 中的reactivity模块，这个模块包含了vue3的新特性，`packages/reactivity/src/index.ts` 中我们可以看到它提供了很多方法，这里我们捡几个核心的方法进行解读，`reactive` `effect` `ref` `computed` 理解这几个核心方法的原理，基本上reactivity基本上就掌握了，其他的一些方法都是基于这几个方法扩展的。

本节我主要深入reactive这个方法的源码实现，带大家一步一步的实现和vue3一样的功能

reactive模块

数据监听步骤
1. 代理对象
2. 深层代理对象
3. 动态添加代理对象，在只更改自身没有的属性
4. 处理多次代理问题

基于以上四个步骤，下面我们来逐步的实现

```js
const baseHandlers = {
  get(target, key) {
    const res = Reflect.get(target, key)
    return res;
  },
  set(target, key, value) {
    const res = Reflect.set(target, key, value);
    return res;
  },
  deleteProperty() {
    const res = Reflect.deleteProperty(target, key);
    return res;
  },
}

function reactive(target) {
  return createReactiveObject(target, baseHandlers)
}

function createReactiveObject(target, baseHandlers) {
  if (!isObject(target)) return target;

  const observed = new Proxy(target, baseHandlers)
  return observed
}
```



effect 
1. 获取数据时，依赖收集
2. 更新数据时，执行收集的依赖

