const fs = require("fs")
const path = require("path")
const writeFile = require("./writeFileSafe")



const FILE_PATH = path.join(__dirname, "./data/MS-700.html")
const RESULT_PATH = path.join(__dirname, "./data/MS-700_mini.json")

fs.promises.readFile(FILE_PATH, {
  encoding: "utf-8"
}).then(content => {
  const result = new Result(content)

  result
    .getBody()
    .removeTag("span")
    .reviseChoices(["A", "B", "C", "D", "E", "F", "G"])
    .flatContent()
    .build()

  writeFile(RESULT_PATH, JSON.stringify(result.structedContent.slice(53, 60)))
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

    return this
  }

  build() {
    this.structedContent = splitContentIntoSection(this.content).map(section => {
      if (section[0].text.startsWith("QUESTION")) {
        const headOfAnswerSection = section.findIndex(_ => _.text && _.text.startsWith("Correct Answer:"))
        const headOfSelections = section.slice(0, headOfAnswerSection)
          .findIndex(_ => _.text && _.text.startsWith("A."))

        const questionSection = section.slice(1, headOfSelections)
        const questionText = {
          type: "text",
          text: questionSection.filter(_ => _.text).map(_ => _.text).join(" ")
        }
        const questionImages = questionSection.filter(_ => _.src)

        const selections = section.slice(headOfSelections, headOfAnswerSection)

        const answers = section.slice(headOfAnswerSection)
        const headOfExplanation = answers.findIndex(_ => _.text === "Explanation:")
        if (headOfExplanation !== -1) {
          const headOfReference = answers.findIndex(_ => _.text === "Reference:")
          const explanationText = answers
            .slice(headOfExplanation + 1, headOfReference)
            .map(_ => _.text)
            .join(" ")
          answers[headOfExplanation + 1].text = explanationText
          answers.splice(headOfExplanation + 2, headOfReference - headOfExplanation - 2)
        }

        return {
          type: "question",
          title: section[0].text,
          question: [questionText, ...questionImages],
          selections,
          answers
        }
      }

      if (section[0].text.startsWith("Case study")) {
        const text = {
          type: "text",
          text: section.slice(1).filter(_ => _.text).join(" ")
        }
        const images = section.filter(_ => _.src)

        return {
          type: "CaseStudy",
          content: [text, ...images]
        }
      }

      return {
        type: "sectionHeader",
        content: section,
      }
    })

    return this
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
      type: "image",
      src: /src="(.*?)"/.exec(rawStr) && /src="(.*?)"/.exec(rawStr)[1]
    }
  else
    content = {
      type: "text",
      text: rawStr.replace(/<.*?>/g, "")
    }

  return content
}


function splitContentIntoSection(content) {
  let lastIndex = 0
  let structedContent = []
  for (let idx = 0; idx < content.length;) {
    const _ = content[idx]

    if (!_.text) {
      ++idx
      continue
    }

    if (_.text.startsWith("Question Set") || _.text.startsWith("Testlet")) {
      structedContent.push(content.slice(lastIndex, idx + 1))
      lastIndex = idx + 1
      idx = lastIndex
      continue
    }

    if (_.text.startsWith("QUESTION") || _.text.startsWith("Case study")) {
      const stepToNextQues = content
        .slice(idx + 1)
        .findIndex(ele => ele.text && ele.text.startsWith("QUESTION"))
      const endOfQues = stepToNextQues === -1 ? content.length : stepToNextQues + idx + 1

      structedContent.push(content.slice(idx, endOfQues))
      lastIndex = endOfQues
      idx = lastIndex
      continue
    }
    ++idx
  }

  return structedContent
}