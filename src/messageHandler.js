import url from 'url';
import rollbar from './rollbar';
import redis from './redisClient';
import { sendFacebookMsg, pagePublicContentAccess } from './fbClient';
import handleInput from './handleInput';
import { uploadImageFile } from './fileUpload';
import ga from './ga';

const messageHandler = async (req, userId, instance, userIdBlacklist) => {
  if (userIdBlacklist.indexOf(userId) !== -1) {
    // User blacklist
    console.log(
      `[LOG] Blocked user INPUT =\n${JSON.stringify({
        userId,
      })}\n`
    );
    return;
  }

  // Set default result
  // format of a reply: { type, content }
  let result = {
    context: '__INIT__',
    replies: [
      {
        type: 'text',
        content: {
          text: '我們還不支援文字以外的訊息唷！',
        },
      },
    ],
  };

  // normalized "input"
  let input, type;

  // React to certain type of events
  //
  if (instance.postback && instance.postback.payload) {
    input = instance.postback.payload;
    type = 'postback';
  } else if (instance.message) {
    if (instance.message.text) {
      input = instance.message.text;
      type = 'text';
    } else if (
      typeof instance.message.attachments === typeof [] &&
      instance.message.attachments.length > 0
    ) {
      if (instance.message.attachments[0].type === 'fallback') {
        // attachment is a link (should be only 1 link)
        // should handle 2 types:
        // 1. non-fb url: parse content in the link
        // 2. fb url: get post id and use public content access
        type = 'text';
        let urlAttached = instance.message.attachments[0].url;
        let queryData = url.parse(urlAttached, true);
        if (
          urlAttached.indexOf('https://www.facebook.com/') !== -1 ||
          urlAttached.indexOf('http://www.facebook.com/') !== -1
        ) {
          // facebook permanent link, need permission page public content access
          input = await pagePublicContentAccess(
            `${queryData.query.id}_${queryData.query.story_fbid}`
          );
        } else if (
          urlAttached.indexOf('https://l.facebook.com/') !== -1 ||
          urlAttached.indexOf('http://l.facebook.com/') !== -1
        ) {
          // external link, get the decoded link and title
          input = `${
            instance.message.attachments[0].title
          }\t${decodeURIComponent(queryData.query.u)}`;
        }
      } else {
        type = 'attachment';
      }
    }
  } else {
    // ignore other webhook events like message_delivery
    return;
  }

  if (input) {
    const context = (await redis.get(userId)) || {};

    // Debugging: type 'RESET' to reset user's context and start all over.
    //
    if (input === 'RESET') {
      redis.del(userId);
      return;
    }

    try {
      // When this message is received.
      //
      const issuedAt = Date.now();
      result = await handleInput(context, { input, type }, issuedAt, userId);

      if (!result.replies) {
        throw new Error(
          'Returned replies is empty, please check processMessages() implementation.'
        );
      }

      // Renew "issuedAt" of the resulting context if state changed
      //
      if (context.state !== result.context.state) {
        result.context.issuedAt = issuedAt;
      } else {
        result.context.issuedAt = context.issuedAt;
      }
    } catch (e) {
      console.error(e);
      rollbar.error(e, req);

      result = {
        context: { state: '__INIT__', data: {} },
        replies: [
          {
            type: 'text',
            content: {
              text: '糟糕，bot 故障了。可以再傳一次嗎？ QQ',
            },
          },
        ],
      };
    }

    // LOGGING:
    // 60 chars per line, each prepended with [[LOG]]
    //
    console.log('\n||LOG||<----------');
    JSON.stringify({
      CONTEXT: context,
      INPUT: { type, userId },
      OUTPUT: result,
    })
      .split(/(.{60})/)
      .forEach(line => {
        if (line) {
          // Leading \n makes sure ||LOG|| is in the first line
          console.log(`\n||LOG||${line}`);
        }
      });
    console.log('\n||LOG||---------->');
  } else if (type === 'attachment') {
    instance.message.attachments.forEach((element, idx) => {
      if (idx >= 10) {
        // prevent attacks using too many attachments
        return;
      }
      // Track message attachment type sent by user
      ga(userId, {
        ec: 'UserInput',
        ea: 'MessageType',
        el: element.type,
      });
      if (element.type === 'image') {
        uploadImageFile(instance.mid, idx, element.payload.url);
      } else if (element.type === 'video') {
        //uploadVideoFile(instance.mid, idx, element.payload.url);
      } else if (element.type === 'fallback') {
        // for shared posts, already handled => do nothing
      }
    });
  }

  // Send replies.
  // Error handler inside
  //
  sendFacebookMsg({
    receiver: userId,
    replies: result.replies,
  });

  // Set context
  //
  await redis.set(userId, result.context);
};

export default messageHandler;
