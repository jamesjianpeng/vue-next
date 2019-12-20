/**
 * 数据监听步骤
 * 1. 代理对象
 * 2. 深层代理对象
 * 3. 动态添加代理对象，在只更改自身没有的属性
 * 4. 处理多次代理问题
 * effect 依赖收集
 *
 */

const isObject = val => val !== null && typeof val === 'object'
const isFunction = val => typeof val === 'function'
const hasOwn = (target, key) =>
  Object.prototype.hasOwnProperty.call(target, key)
const isRef = v => (v ? v === true : false)

const activeReactiveEffectStack = []

const targetMap = new WeakMap()

const baseHandlers = {
  get(target, key) {
    const res = Reflect.get(target, key)
    console.log('isRef(res)', isRef(res))
    if (isRef(res)) {
      return res.value
    }
    // 在获取值的时候，收集依赖
    track(target, 'get', key)

    return isObject(res) ? reactive(res) : res
  },
  set(target, key, value) {
    const hadKey = hasOwn(target, key)
    const oldValue = target[key]
    const res = Reflect.set(target, key, value)

    if (!hadKey) {
      // 判断自身对象没有此属性，需要更新视图
      trigger(target, 'add', key)
    } else if (oldValue !== value) {
      // 判断设置的值和老值不相等，则需要更新视图
      trigger(target, 'set', key)
    }

    return res
  },
  deleteProperty() {
    const res = Reflect.deleteProperty(target, key)
    return res
  }
}

const rawToReactive = new WeakMap() // 存放已经代理过的对象 obj
const reactiveToRaw = new WeakMap() // 存放代理的对象后的 proxy对象

function reactive(target) {
  return createReactiveObject(
    target,
    rawToReactive,
    reactiveToRaw,
    baseHandlers
  )
}

function createReactiveObject(target, toProxy, toRaw, baseHandlers) {
  if (!isObject(target)) return target

  let observed = toProxy.get(target)
  if (observed) return observed

  if (toRaw.has(target)) return target

  observed = new Proxy(target, baseHandlers)
  toProxy.set(target, observed)
  toRaw.set(observed, target)
  return observed
}

// []
// {
//   target: {
//     key: [fn, fn]
//   }
// }

function track(target, type, key) {
  const effect = activeReactiveEffectStack[activeReactiveEffectStack.length - 1]
  if (effect) {
    let depsMap = targetMap.get(target)
    if (depsMap === void 0) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (dep === void 0) {
      depsMap.set(key, (dep = new Set()))
    }
    if (!dep.has(effect)) {
      dep.add(effect)
      effect.deps.push(dep)
    }
  }
}

function trigger(target, type, key) {
  const depsMap = targetMap.get(target)

  if (depsMap === void 0) {
    return
  }

  const effects = new Set()

  if (key !== void 0) {
    addRunners(effects, depsMap.get(key))
  }

  const run = effect => {
    scheduleRun(effect, target, type, key)
  }

  effects.forEach(run)
}

function addRunners(effects, effectsToAdd) {
  if (effectsToAdd !== void 0) {
    effectsToAdd.forEach(effect => {
      effects.add(effect)
    })
  }
}

function scheduleRun(effect, target, type, key) {
  if (effect.scheduler !== void 0) {
    effect.scheduler(effect)
  } else {
    effect()
  }
}

function effect(fn, options = {}) {
  const effect = createReactiveEffect(fn, options)
  effect()
  return effect
}

function createReactiveEffect(fn) {
  const effect = function effect(...args) {
    return run(effect, fn, args)
  }
  effect.isEffect = true
  effect.active = true
  effect.raw = fn
  effect.deps = []

  return effect
}

function run(effect, fn, args) {
  try {
    activeReactiveEffectStack.push(effect)
    return fn(...args)
  } finally {
    activeReactiveEffectStack.pop()
  }
}

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

function computed(getterOrOptions) {
  const isReadonly = isFunction(getterOrOptions)

  const getter = isReadonly ? getterOrOptions : getterOrOptions.get
}

// const count = ref(0);
// effect(() => {
//     console.log('count1:', count.value)
// })
// count.value = 2

// const a = ref(1)
// const a = reactive({value: 1})
// console.log(a.value);
// a.value = 2
// console.log(a.value);
// effect(() => {
//   console.log('value:', a.value)
// })

// a.value = 2

// const obj = {name: 'kira'}
// const proxy = reactive(obj);
// effect(() => {
//   console.log('name:', proxy.name)
// })
// proxy.name = 'xyk'

// const obj = reactive({name: 'kira'})
// console.log(obj.name)
// obj.name = 'xyk'
// console.log(obj.name)

// const obj = reactive({
//   name: 'kira',
//   a: {b: 1},
//   arr: [1,2,3]
// })
// obj.arr.push(4)
// console.log(obj.arr)

// const obj = {name: 'kira'}
// const proxy = reactive(obj);
// reactive(obj)
// reactive(obj)

// const obj = {name: 'kira'}
// const proxy = reactive(obj);

// obj.age = 18

// // console.log(proxy)
// proxy.age = 19
