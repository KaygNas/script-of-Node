const writeFile = require("./writeFileSafe")
const path = require("path")

const object = {
  HOSTNAME: "eldemo.azurewebsites.net",
  OAUTH_REDIRECT_URI: "https://eldemo.azurewebsites.net/auth/callback",
  OAUTH_SCOPES: "Sites.Read.All",
  OAUTH_AUTHORITY: "https://login.microsoftonline.com/common/oauth2/v2.0",
  APPLICATION_ID: "c9198740-5b8a-11eb-bd8e-d10cb0a8d31c",
  MICROSOFT_APP_ID: "9d4d97a7-9728-4392-99d3-5081afdd7d89",
  MICROSOFT_APP_PASSWORD: "cu21~sERcH9F7wLEAUouH4Hu0_~27_~v4D",
  PORT: "3007",
  DB_USERNAME: "hcj",
  DB_PASSWORD: "btic#12345",
  DB_HOSTNAME: "cluster-demo.yzplj.mongodb.net",
  DB_DATABASE_NAME: "teams-E-Learning"
}


const filePath = path.join(__dirname, "./data/object.json")

const data = Object.entries(object).map(pair => {
  return {
    "name": pair[0],
    "value": pair[1],
    "slotSetting": false
  }
})

writeFile(filePath, JSON.stringify(data))