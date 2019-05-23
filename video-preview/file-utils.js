const axios = require('axios');
const util = require("util");
const { createWriteStream, mkdir } = require('fs');
mkdirPromise = util.promisify(mkdir)

function downloadFile(readPath, writePath) {
  console.log(`Downloading ${readPath} to ${writePath}`)
  return new Promise(async (resolve, reject) => {
    try {
      const writer = createWriteStream(writePath)
      const response = await axios({
        method: 'GET',
        url: readPath,
        responseType: 'stream'
      })
      response.data.pipe(writer)
      writer.on('close', () => resolve(writePath))
      writer.on('error', reject)
    } catch(e) {
      console.log(e)
      reject(e)
    }
  })
}

async function ensureDir (dirpath) {
  try {
    await mkdirPromise(dirpath, { recursive: true })
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
}

module.exports = {
  downloadFile,
  ensureDir,
};
