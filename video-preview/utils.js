function buildResponse(response, status = 200) {
  return {
    statusCode: status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response)
  }
}

function handleError(e) {
  console.log(e)
  return {
    statusCode: 500,
    body: JSON.stringify({
      error: e,
    })
  }
}

module.exports = {
  buildResponse,
  handleError,
}