/**
 * effect 依赖收集
 *
 */

const isObject = val => val !== null && typeof val === 'object'
const hasOwn = (target, key) => target.hasOwnProperty(key)

const rawToReactive = new WeakMap() // 存放 原始对象=>代理对象 的映射
const reactiveToRaw = new WeakMap() // 存放 代理对象=>原始对象 的映射

const OperationTypes = {
  SET: 'set',
  ADD: 'add',
  DELETE: 'delete',
  CLEAR: 'clear',
  GET: 'get',
  HAS: 'has',
  ITERATE: 'iterate'
}

const baseHandlers = {
  get(target, key, receiver) {
    const response = Reflect.get(target, key, receiver)

    track(target, OperationTypes.GET, key)

    return isObject(response) ? reactive(response) : response
  },
  set(target, key, value, receiver) {
    const hadKey = hasOwn(target, key) // 判断对象上没有key属性,如数组的length是已经存在的属性
    const oldValue = target[key]
    const result = Reflect.set(target, key, value, receiver)

    if (!hadKey) {
      trigger(target, OperationTypes.ADD, key)
    } else if (value !== oldValue) {
      trigger(target, OperationTypes.SET, key)
    }

    return result
  },
  deleteProperty(target, key) {
    const response = Reflect.deleteProperty(target, key)
    return response
  }
}

function reactive(target) {
  return createReactiveObject(target, rawToReactive, reactiveToRaw)
}
function createReactiveObject(target, toProxy, toRaw) {
  if (!isObject(target)) return target

  let observed = toProxy.get(target)
  if (observed) return observed

  if (toRaw.has(target)) return target // 注意这里的target是第一次代理时存在reactiveToRaw上的key(observe)

  observed = new Proxy(target, baseHandlers)

  toProxy.set(target, observed)
  toRaw.set(observed, target)
  return observed
}

// 存放栈结果，先进后出
const activeReactiveEffectStack = []
const targetsMap = new WeakMap()

// watch 副作用函数数，监听数据变化
function effect(fn) {
  // 需要把 fn 这个函数变成 响应式函数
  const effect = createReactiveEffect(fn)
  effect()
}
function createReactiveEffect(fn) {
  const effect = function() {
    return run(effect, fn)
  }
  return effect
}
function run(effect, fn) {
  activeReactiveEffectStack.push(effect)
  fn()
  activeReactiveEffectStack.pop()
}

// 收集依赖
function track(target, type, key) {
  const effect = activeReactiveEffectStack[activeReactiveEffectStack.length - 1]
  if (effect) {
    let depsMap = targetsMap.get(target)
    if (!depsMap) {
      targetsMap.set(target, (depsMap = new Map()))
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
// 执行依赖
function trigger(target, type, key) {
  console.log('数据更新')
  const depsMap = targetsMap.get(target)
  if (!depsMap) {
    // never been tracked
    return
  }
  const run = effect => {
    scheduleRun(effect, target, type, key)
  }
  const deps = depsMap.get(key)
  deps.forEach(run)
}

function scheduleRun(effect, target, type, key) {
  effect()
}

const covernt = val => (isObject(val) ? reactive(val) : val)
function ref(raw) {
  raw = covernt(raw)
  const v = {
    get value() {
      track(v, 'GET', '')
      return raw
    },
    set value(newValue) {
      raw = convert(newValue)
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
