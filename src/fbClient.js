import fetch from 'node-fetch';
import FormData from 'form-data';
import rollbar from './rollbar';

function wrapUpMessages(receipient, replies) {
  const batchMessages = [
    //whole request need to be stringified to attach to form
    {
      method: 'POST',
      name: 'msg0',
      relative_url: 'v2.6/me/messages',
      body: `${receipient}&sender_action=typing_on`,
    }, //to display typing on bubble :)
  ];
  replies.forEach((reply, idx) => {
    batchMessages.push({
      method: 'POST',
      name: `msg${idx + 1}`,
      depends_on: `msg${idx}`,
      relative_url: 'v2.6/me/messages',
      body: `${receipient}&message=${encodeURIComponent(
        JSON.stringify(reply.content)
      )}`,
    });
  });
  return JSON.stringify(batchMessages);
}

export default async function fbClient(params = {}, options = {}) {
  const URL = 'https://graph.facebook.com';
  const receipient = `recipient=${encodeURIComponent(
    JSON.stringify({ id: params.receiver })
  )}`;
  const replies = wrapUpMessages(receipient, params.replies);
  const respBody = new FormData();
  respBody.append('access_token', process.env.PAGE_ACCESS_TOKEN);
  respBody.append('batch', replies);
  const resp = await fetch(URL, {
    method: 'POST',
    body: respBody,
  });

  const results = await resp.json();
  if (resp.status !== 200) {
    console.error(JSON.stringify(results, null, '  '));

    rollbar.error(
      `[FB Client] ${resp.status}: ${results.message}.`,
      {
        // Request object for rollbar server SDK
        headers: {
          'Content-Type': 'multipart/form-data',
          ...options.headers,
        },
        body: respBody,
        url: URL,
        method: 'POST',
      },
      { results }
    );
  } else {
    results.forEach((result, idx) => {
      if (result !== null && result.code !== 200) {
        const resultBody = JSON.parse(result.body);
        console.error(JSON.stringify(resultBody, null, '  '));
        console.error(`Source: \n${JSON.stringify(params.replies[idx - 1])}`);

        rollbar.error(
          `[FB Client] ${result.code}: ${resultBody}.`,
          {
            // Request object for rollbar server SDK
            headers: {
              'Content-Type': 'multipart/form-data',
              ...options.headers,
            },
            body: JSON.stringify(params.replies[idx]),
            url: URL,
            method: 'POST',
          },
          { result }
        );
      }
    });
  }

  return results;
}
