exports.handler = async (event, context) => {
  console.log('Test function called:', event.httpMethod, event.path);
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: 'Test function works!',
      method: event.httpMethod,
      path: event.path,
      query: event.queryStringParameters,
      timestamp: new Date().toISOString()
    })
  };
};