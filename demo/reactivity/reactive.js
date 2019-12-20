const isObject = val => val !== null && typeof val === 'object'
const hasOwn = (target, key) =>
  Object.prototype.hasOwnProperty.call(target, key)

const activeReactiveEffectStack = [] // 栈
const targetMap = new WeakMap()

const handlers = {
  get(target, key, receiver) {
    const res = Reflect.get(target, key, receiver)
    console.log('get', key)
    // 收集依赖 订阅 把当前的key和effect对应起来
    track(target, key)

    return isObject(res) ? reactive(res) : res // 判断取到的值是不是对象，如果是对象的话需要使用reactive代理对象
  },
  set(target, key, value, receiver) {
    const hadKey = hasOwn(target, key)
    const oldValue = target[key]
    const result = Reflect.set(target, key, value, receiver)

    if (!hadKey) {
      // 判断key是不是target对象上的属性，不存在的时候设置才算有意义
      trigger(target, 'add', key)
    } else if (value !== oldValue) {
      // 新值不等于老值说明此次设置才算有意义
      trigger(target, 'set', key)
    } // 为了屏蔽无意义的修改

    return result
  },
  deleteProperty(target, key) {
    const result = Reflect.deleteProperty(target, key)
    return result
  },
  has() {},
  ownKeys() {}
}

// 存放原对象 (映射=>) 代理对象 target => proxy
// 解决 reactive(obj)
const rawToReactive = new WeakMap()
// 存放已经被代理的对象 代理对象 (映射=>) 原对象  proxy => target
// 解决 reactive(proxy)
const ReactiveToRaw = new WeakMap()

function reactive(target) {
  return createReactiveObject(target, rawToReactive, ReactiveToRaw, handlers)
}

function createReactiveObject(target, toProxy, toRaw, baseHandlers) {
  // 判断如果不是一个对象的话返回
  if (!isObject(target)) return target

  // 判断如果对象target被代理了，就返回改proxy对象, 防止多次new
  let observed = toProxy.get(target)
  if (observed) {
    return observed
  }
  // 注意：这里的 target 是已经被代理过的 proxy对象，所以使用target作为key, 防止多次new
  if (toRaw.has(target)) {
    return target
  }

  // target观察前的原对象； proxy观察后的对象：observed
  observed = new Proxy(target, baseHandlers)
  toProxy.set(target, observed)
  toRaw.set(observed, target)

  // 添加目标对象的映射
  if (!targetMap.has(target)) {
    targetMap.set(target, new Map())
  }
  return observed
}

// ---- effect 文件 ------
// 依赖收集
function track(target, key) {
  const effect = activeReactiveEffectStack[activeReactiveEffectStack.length - 1]
  if (effect) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let deps = depsMap.get(key)
    if (!deps) {
      depsMap.set(key, (deps = new Set()))
    }
    if (!deps.has(effect)) {
      deps.add(effect)
    }
  }
}

function trigger(target, type, key) {
  console.log('视图更新')
  const depsMap = targetMap.get(target)
  if (depsMap) {
    const deps = depsMap.get(key)
    if (deps) {
      deps.forEach(effect => {
        effect()
      })
    }
  }
}

// 响应式 副作用
function effect(fn) {
  // 需要把fn这个函数变成响应式函数
  let effect = createReactiveEffect(fn)
  effect() // 默认先执行一次
}
// 高阶函数， 返回一个可执行函数
function createReactiveEffect(fn) {
  const effect = function() {
    return run(effect, fn)
  }
  return effect
}

function run(effect, fn) {
  try {
    activeReactiveEffectStack.push(effect)
    fn()
  } finally {
    activeReactiveEffectStack.pop()
  }
}
// ------- effect 文件 -------

const convert = val => (isObject(val) ? reactive(val) : val)
function ref(raw) {
  raw = convert(raw)
  const v = {
    get value() {
      track(v, 'GET', '')
      return raw
    },
    set value(newVal) {
      raw = convert(newVal)
      trigger(v, 'SET', '')
    }
  }
  return v
}

const count = ref({ a: 1 })
effect(() => {
  console.log('count1:', count.value.a)
})
count.value.a = 2

// 依赖收集 => 发布订阅
// const proxy = reactive({name: 'kira'});
// effect(() => {
//   console.log('===', proxy.name);
// })
// proxy.name = 'LLLLLL';

// let arr = {a: [1,2,3]};
// let proxy = reactive(arr);
// proxy.a.push(100);

// const obj = reactive({
//   name: 'kira',
//   a: {b: 1},
//   arr: [1,2,3]
// })
// obj.arr.push(4)

// const obj = {
//   name: 'kira',
//   a: { b: 1 },
//   arr: [1,2,3]
// }
// const proxy = reactive(obj);
// reactive(obj) // 多次代理
// reactive(proxy) // 多层代理
// // obj.a.b = '12345'
// proxy.arr.push(4)
