const items = require("./listsItems.json").value

function getUnqDomainFrom(items) {
  const set = new Set(items.map(item => [getDomain(item.fields.ImgUrl), getDomain(item.fields.VideoUrl)]).flat())
  return set
}

function getDomain(url) {
  const reg = /^https?:\/\/[\w\.-]*(?=[\/\w]*)/g
  const result = reg.exec(url)
  if (!result) throw new Error(`bad url: ${url}`)
  return result[0]
}

console.log(getUnqDomainFrom(items))