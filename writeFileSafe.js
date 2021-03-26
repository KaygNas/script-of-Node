const fs = require("fs")
const path = require("path")

async function isDirExist(dirPath) {
  try {
    await fs.promises.stat(dirPath)
    return true
  } catch (err) {
    return false
  }
}

async function mkdir(dirPath) {
  if ((await isDirExist(dirPath))) return

  await fs.promises.mkdir(dirPath, {
    recursive: true
  })
}

async function writeFile(filePath, data) {
  const dirPath = path.dirname(filePath)
  await mkdir(dirPath)
  await fs.promises.writeFile(filePath, data, "utf-8")
}

module.exports = writeFile