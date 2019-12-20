/**
 * effect 依赖收集
 *
 */

const isObject = val => val !== null && typeof val === 'object'
const isFunction = val => typeof val === 'function'
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
function effect(fn, options = {}) {
  // 需要把 fn 这个函数变成 响应式函数
  const effect = createReactiveEffect(fn, options)
  if (!options.lazy) {
    effect()
  }
  return effect
}
function createReactiveEffect(fn, options) {
  const effect = function() {
    return run(effect, fn)
  }
  effect.computed = options.computed
  effect.scheduler = options.scheduler
  effect.deps = []
  return effect
}
function run(effect, fn) {
  try {
    activeReactiveEffectStack.push(effect)
    return fn()
  } finally {
    activeReactiveEffectStack.pop()
  }
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
      effect.deps.push(deps)
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
  const effects = new Set()
  const computedRunners = new Set()

  if (key !== void 0) {
    addRunners(effects, computedRunners, depsMap.get(key))
  }

  const run = effect => {
    scheduleRun(effect, target, type, key)
  }
  // const deps = depsMap.get(key);
  computedRunners.forEach(run)
  effects.forEach(run)
}

function addRunners(effects, computedRunners, effectsToAdd) {
  if (effectsToAdd !== void 0) {
    effectsToAdd.forEach(effect => {
      if (effect.computed) {
        computedRunners.add(effect)
      } else {
        effects.add(effect)
      }
    })
  }
}

function scheduleRun(effect, target, type, key) {
  // effect()
  if (effect.scheduler !== void 0) {
    effect.scheduler(effect)
  } else {
    effect()
  }
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

// computed 是一个 ref 类型
function computed(getterOrOptions) {
  const isReadonly = isFunction(getterOrOptions)
  // 判断getterOrOptions是否是函数，如果是函数直接使用，如果是对象的话，则取对象下的get方法作为getter
  const getter = isReadonly ? getterOrOptions : getterOrOptions.get
  const setter = isReadonly ? null : getterOrOptions.set

  let value
  let dirty = true

  const runner = effect(getter, {
    lazy: true,
    computed: true,
    scheduler: () => {
      dirty = true
    }
  })

  const ref = {
    effect: runner,
    get value() {
      if (dirty) {
        value = runner()
        dirty = false
      }
      trackChildRun(runner)
      return value
    },
    set value(newValue) {
      setter(newValue)
    }
  }

  return ref
}
function trackChildRun(childRunner) {
  const parentRunner =
    activeReactiveEffectStack[activeReactiveEffectStack.length - 1]
  if (parentRunner) {
    for (let i = 0; i < childRunner.deps.length; i++) {
      const dep = childRunner.deps[i]
      if (!dep.has(parentRunner)) {
        dep.add(parentRunner)
        parentRunner.deps.push(dep)
      }
    }
  }
}

// 1.实现computed数据计算属性
// 通过测试用例可以看出来，computed 不会立即执行，但是这个方法会立即执行，而是在调用的时候执行
// effect 则是立即执行的
// 2.只在调用的时候执行

const state = reactive({
  count: 1
})

const double = computed(() => {
  return state.count + 2
})
// const double2 = computed(() => {
//   console.log('000')
//   return double.value * 2;
// })

var d
effect(() => {
  d = double.value
})
console.log('d', d)
double.effect()
state.count++
console.log('d', d)
// console.log('double2', double2.value)
// console.log('double', double.value)
// state.count++
// console.log('double2', double2.value)
// console.log('double', double.value)
// double.value
// state.count = 6
// double.value

// effect(()=>{
//   console.log(state.count)
// })
// state.count = 2

// const double = computed(() => {
//   console.log('000')
//   return state.count + 2;
// })
// const double = computed({
//   get() {
//     return state.count + 2
//   },
//   set(newValue) {
//     console.log('newValue', newValue)
//     state.count = 4
//   }
// })

// double.value
// console.log('double.value', state.count)
// setTimeout(() => {
//   state.count++
//   console.log('double.value', double.value)
// }, 1000)

// effect(() => {
//   console.log(double.value)
// }) // -> 0

// state.count++ // -> 2

// const count = ref({a: 1});
// effect(() => {
//   console.log('count1:', count.value.a)
// })
// count.value.a = 2
