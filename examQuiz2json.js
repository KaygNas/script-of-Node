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

  writeFile(RESULT_PATH, JSON.stringify(result.content))
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
      const $1 = `(<div.*?>${choice}\\.)`
      const $2 = `(.*?<\\/div>)`
      const before = `<div.*?>`
      const after = `<\\/div>`

      let reg = (depth) => new RegExp(
        before.repeat(depth - 1) +
        $1 +
        after.repeat(depth) +
        before.repeat(depth) +
        $2 +
        after.repeat(depth - 1))

      let depth = 1
      while (reg(depth).test(this.content))
        this.content = this.content.replace(reg(depth++), "$1$2")
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
        .filter(_ => {
          if (_.src) return true
          if (!_.text) return false
          return _.text.trim() !== "" && _.text.trim() !== "302341CE5371968C6E29FD33D6E5E7D9"
        })
      )
      .flat()

    return this
  }

  build() {
    this.content = splitContentIntoSection(this.content)
      .map(section => {
        if (section[0].text.startsWith("QUESTION")) {
          let headOfAnswerSection = section.findIndex(_ => _.text && _.text.startsWith("Correct Answer:"))
          let headOfSelections = section.slice(0, headOfAnswerSection)
            .findIndex(_ => _.text && _.text.startsWith("A."))
          headOfSelections = headOfSelections === -1 ? headOfAnswerSection : headOfSelections

          const questionSection = section.slice(1, headOfSelections)
          const questionText = {
            type: "text",
            text: questionSection.filter(_ => _.text).map(_ => _.text).join(" ")
          }
          const questionImages = questionSection.filter(_ => _.src)

          const selectionsSection = section.slice(headOfSelections, headOfAnswerSection)
          const selectionsTexts = selectionsSection
            .filter(_ => _.text)
            .map(_ => _.text)
            .join(" ")
            .split(/(?=[ABCDEFG]\.)/)
            .filter(text => text.trim() !== "")
            .map(text => ({
              type: "text",
              text: text.trim()
            }))
          const selectionsImages = selectionsSection.filter(_ => _.src)

          let answers = section.slice(headOfAnswerSection)
          let headOfExplanation = answers.findIndex(_ => _.text === "Explanation:")
          let headOfReference = answers.findIndex(_ => _.text === "Reference:")
          let headOfExpOrRef = answers.findIndex(_ => _.text === "Explanation/Reference:")

          let tailOfExplanation = headOfReference === -1 ? answers.length : headOfReference
          const explanation = answers
            .slice(headOfExplanation, tailOfExplanation)
            .map(_ => _.text)
            .join("")
            .split(/(?<=Explanation:)/)
            .map(_ => ({
              type: "text",
              text: _.text
            }))

          const reference = answers
            .slice(headOfReference)
            .filter(_ => _.text)
            .map(_ => _.text)
            .join("")
            .split(/(?=http)/)
            .map(text => ({
              type: "text",
              text: text.trim()
            }))

          return {
            type: "question",
            title: section[0].text,
            question: [questionText, ...questionImages],
            selections: [...selectionsTexts, ...selectionsImages],
            answers: [...answers.slice(0, headOfExpOrRef + 1), ...explanation, ...reference]
          }
        }

        if (section[0].text.startsWith("Case study")) {
          const content = section.slice(1).filter(_ => _.text).map(_ => _.text).join(" ")
          const textBeforeContext = "click the Question button to return to the question."
          const headOfContext = content.lastIndexOf(textBeforeContext) + textBeforeContext.length + 1
          const caseStudyDescription = {
            type: "text",
            text: content.slice(0, headOfContext)
          }
          const context = {
            type: "text",
            text: content.slice(headOfContext)
          }
          const images = section.filter(_ => _.src)

          return {
            type: "CaseStudy",
            content: [caseStudyDescription, context, ...images]
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
      contentEnd = tagReg.lastIndex - tag.length - 3 /** 3 为 </> 这三个符号的长度 */
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
      src: /src="(.*?)"/.test(rawStr) && /src="(.*?)"/.exec(rawStr)[1]
    }
  else
    content = {
      type: "text",
      text: rawStr.replace(/<.*?>/g, "").trim()
    }

  return content
}


function splitContentIntoSection(content) {
  let structedContent = []
  for (let idx = 0; idx < content.length;) {
    const _ = content[idx]

    if (!_.text) {
      ++idx
      continue
    }

    if (_.text.startsWith("Question Set") || _.text.startsWith("Testlet")) {
      structedContent.push(content.slice(idx - 1, idx + 1))
        ++idx
      continue
    }

    if (_.text.startsWith("QUESTION") || _.text.startsWith("Case study")) {
      const stepToNextQues = content
        .slice(idx + 1)
        .findIndex(ele => ele.text && ele.text.startsWith("QUESTION"))

      const stepToNextTestlet = content
        .slice(idx + 1)
        .findIndex(ele => ele.text && ele.text.startsWith("Testlet"))

      const stepToNext = stepToNextTestlet !== -1 ?
        Math.min(stepToNextQues, stepToNextTestlet) : stepToNextQues
      const endOfSection = stepToNext === -1 ? content.length : stepToNext + idx + 1

      structedContent.push(content.slice(idx, endOfSection))
      idx = endOfSection
      continue
    }
    ++idx
  }

  return structedContent
}