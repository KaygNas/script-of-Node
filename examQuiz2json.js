const fs = require("fs")
const path = require("path")
const writeFile = require("./writeFileSafe")



const FILE_PATH = path.join(__dirname, "./data/MS-700.html")
const RESULT_PATH = path.join(__dirname, "./data/MS-700_mini.html")

fs.promises.readFile(FILE_PATH, {
  encoding: "utf-8"
}).then(content => {
  const result = new Result(content)

  result
    .getBody()
    .removeTag("span")
    .reviseChoices(["A", "B", "C", "D", "E", "F", "G"])
    .flatContent()

  // writeFile(RESULT_PATH, result.content)
})

class Result {
  constructor(content) {
    this.content = content
  }

  getBody() {
    const from = this.content.indexOf("<body>")
    const to = this.content.indexOf("</body>") + "</body>".length
    this.content = this.content.slice(from, to)
    return this
  }

  removeTag(tag) {
    const reg = new RegExp(`</?${tag}.*?>`, "g")
    this.content = this.content.replace(reg, "")
    return this
  }

  reviseChoices(choices) {
    choices.forEach(choice => {
      const reg1 = new RegExp(`<div.*?>(<div.*?>${choice}\\.)<\\/div><\\/div><div.*?><div.*?>(.*?<\\/div>)<\\/div>`, "g")
      this.content = this.content.replace(reg1, "$1$2")

      const reg2 = new RegExp(`(<div.*?>${choice}\\.)<\\/div><div.*?>(.*?<\\/div>)`, "g")
      this.content = this.content.replace(reg2, "$1$2")
    })
    return this
  }

  flatContent() {
    this.content = this.content
      // 将每页的内容拆成数组
      .split(/(?=<div class="pc.*?">)/)
      .map(_ =>
        _
        // 暂时把图片的 src 抹掉
        .replace(/src=".*?"/g, "src=\"...\"")
        // 抹掉不必要的 class 内容
        .replace(/class="(pc)?.*?"/g, "$1"))
      .map(_ =>
        // 只保留每页的内容，去掉其他的嵌套的标签
        leverageRootTag(_, "div")
        // 将内容从标签中提取出来，并组成数组
        .split(/(?=<\w.*?>)/)
        .map(str => formatContentStr(str))
      )
      .flat()

    writeFile(
      path.join(__dirname, "./data/MS-700_mini.json"),
      JSON.stringify(this.content.slice(30, 100)))
  }
}


function leverageRootTag(str, tag) {
  const tagReg = new RegExp(`</?${tag}.*?>`, "g")
  let res = tagReg.exec(str)
  let contentStart = res && tagReg.lastIndex
  let contentEnd = str.length

  let stack = []
  while (res !== null) {
    const matchedStr = res[0]

    if (matchedStr.startsWith(`<${tag}`))
      stack.push(res[0])

    if (matchedStr.startsWith(`</${tag}`))
      stack.pop()

    if (stack.length === 0) {
      contentEnd = tagReg.lastIndex - tag.length - 3
      return str.slice(contentStart, contentEnd)
    }

    res = tagReg.exec(str)
  }

  return str
}


function formatContentStr(rawStr) {
  let content
  if (rawStr.startsWith("<img"))
    content = {
      type: "img",
      src: /src="(.*?)"/.exec(rawStr) && /src="(.*?)"/.exec(rawStr)[1]
    }
  else
    content = {
      type: "text",
      text: rawStr.replace(/<.*?>/g, "")
    }

  return content
}