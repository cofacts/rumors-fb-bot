import fetch from 'node-fetch';
import FormData from 'form-data';
import rollbar from './rollbar';
import redis from './redisClient';

const URL = 'https://graph.facebook.com';
const graphApiVersion = 'v3.2';

/**
 * Wrap reply objects into a response body.
 * @param {string} recipient The recipient of our reply
 * @param {array} replies An array of reply objects
 * @returns {string} The full response body string
 */
function wrapUpMessages(recipient, replies) {
  if (replies.length === 0) {
    return '';
  }
  const batchMessages = [
    //whole request need to be stringified to attach to form
    {
      method: 'POST',
      name: 'msg0',
      relative_url: 'v2.6/me/messages',
      body: `${recipient}&sender_action=typing_on`,
    }, //to display typing on bubble :)
  ];
  replies.forEach((reply, idx) => {
    batchMessages.push({
      method: 'POST',
      name: `msg${idx + 1}`,
      depends_on: `msg${idx}`,
      relative_url: 'v2.6/me/messages',
      body: `${recipient}&message=${encodeURIComponent(
        JSON.stringify(reply.content)
      )}`,
    });
  });
  return JSON.stringify(batchMessages);
}

/**
 * Send our response message to Facebook
 * @param {object} params The params object that contains all user-related information
 * @param {object} options Options if any
 * @returns {array} Result of messages sent
 */
export async function sendFacebookMsg(params = {}, options = {}) {
  console.log(params.receiver);
  const recipient = `recipient=${encodeURIComponent(
    JSON.stringify({ id: params.receiver })
  )}`;
  const replies = wrapUpMessages(recipient, params.replies);
  if (replies === '') {
    return;
  }
  const respBody = new FormData();
  respBody.append('access_token', process.env.PAGE_ACCESS_TOKEN);
  respBody.append('batch', replies);
  const resp = await fetch(URL, {
    method: 'POST',
    body: respBody,
  });

  const results = await resp.json();
  if (resp.status !== 200) {
    console.error(
      'Error when sending message reply (status error): ' +
        JSON.stringify(results, null, '  ')
    );

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
        console.error(
          'Error when sending message reply (API error): ' +
            JSON.stringify(resultBody, null, '  ')
        );
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

/**
 * Get post content using Page Public Content Access
 * @param {string} postId The id of the Facebook post we're interested in
 * @returns {string} The parsed content of the Facebook post
 */
export async function pagePublicContentAccess(postId) {
  const fields = ['message', 'caption', 'link'];
  const resp = await fetch(
    `${URL}/${graphApiVersion}/${postId}?access_token=${
      process.env.PAGE_ACCESS_TOKEN
    }&fields=${fields.join(',')}`
  );
  const results = await resp.json();
  if (resp.status !== 200) {
    console.error(
      'Error when getting page public content: ' +
        JSON.stringify(results, null, '  ')
    );
    return '';
  }

  let msg = '';
  for (let field of fields) {
    if (Object.prototype.hasOwnProperty.call(results, field)) {
      msg += `${results[field]}\n`;
    }
  }
  return msg;
}

/**
 * Reply to a comment
 * @param {string} commentId The id of the comment we're replying to
 * @param {string} msg The message we're replying
 * @returns {undefined}
 */
export async function replyToComment(commentId, msg) {
  if (msg === undefined) {
    return;
  }
  const resp = await fetch(
    `${URL}/${graphApiVersion}/${commentId}/comments?access_token=${
      process.env.PAGE_ACCESS_TOKEN
    }&message=${encodeURIComponent(msg)}`,
    { method: 'POST' }
  );
  try {
    const results = await resp.json();
    if (resp.status !== 200) {
      console.error(
        'Error when replying to a comment: ' +
          JSON.stringify(results, null, '  ')
      );
    }
  } catch (error) {
    console.error('Error when replying to a comment: ' + error.message);
  }
}

/**
 * Get page access token using user access token in env variables
 * @param {undefined}
 * @returns {Promise} Promise wrapping a request for long-lived tokens
 */
export async function getLongLivedPageAccessToken() {
  if (process.env.APP_ID === undefined) {
    throw new Error(`Invalid page id: ${process.env.APP_ID}`);
  }

  let token = process.env.PAGE_ACCESS_TOKEN;
  const redisToken = await redis.get('pageAccessToken');
  if (redisToken) {
    token = redisToken;
  }

  const res = await fetch(
    `${URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.APP_ID}&client_secret=${process.env.APP_SECRET}&fb_exchange_token=${token}`
  );
  const resBody = await res.json();
  if (!Object.prototype.hasOwnProperty.call(resBody, 'access_token')) {
    throw new Error(
      'Failed to get a page access token: ' + JSON.stringify(resBody)
    );
  }
  process.env.PAGE_ACCESS_TOKEN = resBody.access_token;
  await redis.set('pageAccessToken', resBody.access_token);
}

/**
 * Check if this comment is not yet replied by others
 * @param {string} commentId The id of the comment we're replying to
 * @returns {bool} if this comment doesn't have other replies yet
 */
export async function checkCommentCommentable(commentId) {
  if (commentId === '' || typeof commentId !== typeof '') {
    return false;
  }
  const resp = await fetch(
    `${URL}/${graphApiVersion}/${commentId}?access_token=${process.env.PAGE_ACCESS_TOKEN}&fields=can_comment`,
    { method: 'POST' }
  );
  const results = await resp.json();
  if (
    resp.status !== 200 ||
    !Object.prototype.hasOwnProperty.call(results, 'can_comment')
  ) {
    console.error(
      'Error when fetching comment meta: ' + JSON.stringify(results, null, '  ')
    );
    return '';
  }
  return results.can_comment;
}
