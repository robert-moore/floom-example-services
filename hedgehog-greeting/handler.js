exports.handler = async (event, context, callback) => {
  const name = JSON.parse(event.body).hedgehog_name || 'hedgehog'
  const output = [{
      key: "greeting",                 // internal key for bookkeeping
      label: 'Your hedgehog greeting', // customer facing label
      type: 'TEXT',                    // available types are TEXT, IMAGE, VIDEO, AUDIO, LINK
      value: `Hello, ${name}!`,        // the output value
  }]
  const response = {
      statusCode: 200,
      body: JSON.stringify(output),
  };
  callback(null, response)
};