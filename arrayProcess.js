function splitArrayIntoLength(arr, length) {
  let start = 0
  let end = length
  let result = []

  while (start < arr.length) {
    result.push(arr.slice(start, end))
    start += length
    end += length
  }

  return result
}