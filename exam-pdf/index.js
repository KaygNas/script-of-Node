const queryStart = window.location.href.indexOf("?")
let query = {}
window.location.href.slice(queryStart + 1)
  .split("&")
  .map(_ => _.split("="))
  .forEach(pair => {
    query[pair[0]] = pair[1]
  })

const pageContent = data[query.page - 1]
console.log(pageContent);
const body = document.querySelector("body")
const title = document.createElement("h1")
title.textContent = pageContent.title
const question = document.createElement("div")
question.append(...pageContent.question.map(_ => {
  if (_.type === "text") {
    const p = document.createElement("p")
    p.innerText = _.text
    return p
  }

  if (_.type === "image") {
    const img = document.createElement("img")
    img.src = _.src
    return img
  }
}))

body.append(title)
body.append(question)