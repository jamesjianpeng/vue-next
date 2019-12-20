/**
 * 数据监听步骤
 * 1. 代理对象
 * 2. 深层代理对象
 * 3. 动态添加代理对象，在只更改自身没有的属性
 * 4. 处理多次代理问题
 *
 */

const isObject = val => val !== null && typeof val === 'object'
const hasOwn = (target, key) => target.hasOwnProperty(key)

const rawToReactive = new WeakMap() // 存放 原始对象=>代理对象 的映射
const reactiveToRaw = new WeakMap() // 存放 代理对象=>原始对象 的映射

const baseHandlers = {
  get(target, key, receiver) {
    const response = Reflect.get(target, key, receiver)
    return isObject(response) ? reactive(response) : response
  },
  set(target, key, value, receiver) {
    const hadKey = hasOwn(target, key) // 判断对象上没有key属性,如数组的length是已经存在的属性
    const oldValue = target[key]
    const result = Reflect.set(target, key, value, receiver)
    console.log(key, value)
    if (!hadKey) {
      trigger()
    } else if (value !== oldValue) {
      trigger()
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

function trigger() {
  console.log('数据更新')
}

// 5.多次代理已经是被代理的对象
const obj = { name: 'kira', a: { age: 12 } }
proxy = reactive(obj)

proxy = reactive(proxy)
proxy = reactive(proxy)

proxy.name = 'pppp'

// 4.多次代理原对象和多次代理已经是被代理的对象
// 多次代理的对象后再对呆了的对象数据变化就监听不到了，
// 所以我们需要判断对象是否被代理，和需要代理的对象是不是已经是代理对象
// 所以这时就需要创建两个WeakMap来存放 原始对象=>代理对象 的映射， 代理对象=>原始对象 的映射
// 这时就要在创建代理对象的时候做处理
const obj = { name: 'kira', a: { age: 12 } }
proxy = reactive(obj)
proxy = reactive(obj)

proxy.name = 'pppp'

// 3.不修改原有属性,
// 新值和老值不相等的时候，也要进行更新
// const arr = [1,2,3]
// const proxy = reactive(arr);
// proxy.push(4)
// proxy.length = 10
// console.log(arr)

// 2.递归的代理对象
// const obj = {name: 'kira', a: {age: 12}};
// const proxy = reactive(obj);
// proxy.a.age = 18
// console.log(proxy.a.age)

// 1.代理对象
// const obj = {name: 'kira'};
// const proxy = reactive(obj);
// console.log(proxy.name)
