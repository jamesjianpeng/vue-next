// 核心基于 Proxy
function trigger() {
  console.log('触发视图更新')
}

// hash表记住已经代理过的对象，当前已经被代理的结果
const toProxy = new WeakMap() // 存放代理后的对象
const toRaw = new WeakMap() // 存放代理前的对象

const isObject = target => typeof target !== null && typeof target === 'object'

const hasOwnProperty = Object.prototype.hasOwnProperty
const hasOwn = (val, key) => hasOwnProperty.call(val, key)

function reactive(target) {
  if (!isObject(target)) {
    return target
  }

  // 如果代理表中已经存在了 就把这个对象直接返回（传入的对象）
  const proxy = toProxy.get(target)
  if (proxy) {
    return proxy
  }

  // 如果这个对象已经被代理过了（已经代理过了对象）
  if (toRaw.has(target)) {
    return target
  }

  const handlers = {
    set(target, key, value, receiver) {
      // console.log('receiver', receiver)
      // 如果改私有属性时触发,可以触发视图更新 如（length属性屏蔽）
      // console.log(key)
      if (hasOwn(target, key)) {
        trigger()
      }
      return Reflect.set(target, key, value)
    },
    get(target, key, receiver) {
      const res = Reflect.get(target, key)
      if (isObject(target[key])) {
        return reactive(res) // 是一个递归，如果取值是一个对象的话
      }
      return res
    },
    deleteProperty(target, key) {
      return Reflect.deleteProperty(target, key)
    }
  }

  const observed = new Proxy(target, handlers)
  console.log('proxy')
  toProxy.set(target, observed)
  toRaw.set(observed, target)
  return observed
}

const obj = {
  name: 'kira',
  num: [1, 2, 3, 4]
}
let p = reactive(obj)
p = reactive(obj)
p = reactive(p)
// p.name = '杀手'
p.num.push(5)

// const arr = [1,2,3];
// const p = reactive(arr);
// p.push(4)
