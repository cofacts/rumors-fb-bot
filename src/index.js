import Koa from 'koa';
import BodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import rollbar from './rollbar';
import { version } from '../package.json';

import redis from './redisClient';
import fbClient from './fbClient';
import handleInput from './handleInput';
import { uploadImageFile } from './fileUpload';
import ga from './ga';

const app = new Koa();
const router = Router();
const userIdBlacklist = (process.env.USERID_BLACKLIST || '').split(',');

app.use(BodyParser());
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    rollbar.error(err, ctx.request);
    throw err;
  }
});

router.get('/', ctx => {
  ctx.body = JSON.stringify({ version });
});

const messageHandler = async (req, userId, instance) => {
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
    } else if (instance.message.attachments) {
      type = 'attachment';
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
      }
    });
  }

  // Send replies.
  // TODO: error handling
  //
  fbClient({
    receiver: userId,
    replies: result.replies,
  });

  // Set context
  //
  await redis.set(userId, result.context);
};

// eslint-disable-next-line
const groupHandler = async (req, type, replyToken, userId, otherFields) => {
  // TODO
};

// Routes that is after protection of checkSignature
//
router.post('/callback', ctx => {
  //let body = ctx.body;
  /*
  // Checks this is an event from a page subscription
  if (body.object === 'page') {
    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {
      // Gets the message. entry.messaging is an array, but
      // will only ever contain one message, so we get index 0
      let instance = entry.messaging[0];
      var sender = instance.sender.id;
      let isText = true;
      if (instance.message && instance.message.text) {
        var msg_text = instance.message.text || instance.postback.payload;
        console.log(msg_text);
        if (msg_text === 'help') {
          msg_text = 'Hello. I\'m a copycat bot. You can say anything you like here.';
        } else if (msg_text === 'menu') {
          isText = false;
        }
        sendMessage(sender, msg_text, isText);
      } else if (instance.postback) {
        sendMessage(sender, instance.postback.payload, isText);
      }
    });

    // Returns a '200 OK' response to all requests
    ctx.status = 200;
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    ctx.status = 404;
  }
  */

  const messageInstances = ctx.request.body.entry[0].messaging;
  messageInstances.forEach(instance => {
    const sender = instance.sender.id;
    /*
    let isText = true;
    if (instance.message && instance.message.text) {
      let msg_text = instance.message.text || instance.postback.payload;
      sendMessage(sender, msg_text, isText);
    } else if (instance.postback) {
      sendMessage(sender, instance.postback.payload, isText);
    }
    */
    messageHandler(ctx.request, sender, instance);
  });
  /*
  ctx.request.body.events.forEach(
    async ({ type, replyToken, source, ...otherFields }) => {
      let { userId } = source;
      if (source.type === 'user') {
        singleUserHandler(ctx.request, type, replyToken, userId, otherFields);
      } else if (source.type === 'group') {
        groupHandler(ctx.request, type, replyToken, userId, otherFields);
      }
    }
  );
  */
  ctx.status = 200;
});

router.get('/callback', ctx => {
  if (ctx.request.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    ctx.body = ctx.request.query['hub.challenge'];
  } else {
    ctx.body = 'Validation failed, Verify token mismatch';
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(process.env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log('Listening port', process.env.PORT);
});
