import Koa from 'koa';
import Router from 'koa-router';
import rollbar from './rollbar';
import { version } from '../package.json';

import redis from './redisClient';
import checkSignatureAndParse from './checkSignatureAndParse';
import fbClient from './fbClient';
import handleInput from './handleInput';
import { uploadImageFile } from './fileUpload';
import ga from './ga';

const app = new Koa();
const router = Router();
const userIdBlacklist = (process.env.USERID_BLACKLIST || '').split(',');

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
  // Error handler inside
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

router.use('/callback', checkSignatureAndParse);
router.post('/callback', ctx => {
  const messageInstances = ctx.request.body.entry[0].messaging;
  messageInstances.forEach(instance => {
    const sender = instance.sender.id;
    messageHandler(ctx.request, sender, instance);
  });
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
