import Koa from 'koa';
import Router from 'koa-router';
import rollbar from './rollbar';
import messageHandler from './messageHandler';
import mentionEventHandler from './mentionEventHandler';
import { getLongLivedPageAccessToken } from './fbClient';
import { version } from '../package.json';

import checkSignatureAndParse from './checkSignatureAndParse';

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

// eslint-disable-next-line
const groupHandler = async (req, type, replyToken, userId, otherFields) => {
  // TODO
};

router.post('*', checkSignatureAndParse);
router.post('/callback', ctx => {
  if (ctx.request.body.entry[0].hasOwnProperty('changes')) {
    const messageInstances = ctx.request.body.entry[0].changes;
    messageInstances.forEach(instance => {
      if (
        instance.field !== 'mention' ||
        !instance.value ||
        instance.value.item !== 'comment'
      ) {
        // only accept mention event and comments
        return;
      }
      mentionEventHandler(ctx.request, instance);
    });
    ctx.status = 200;
  } else if (ctx.request.body.entry[0].hasOwnProperty('messaging')) {
    // uncomment to enable chatbot
    const messageInstances = ctx.request.body.entry[0].messaging;
    messageInstances.forEach(instance => {
      const sender = instance.sender.id;
      messageHandler(ctx.request, sender, instance, userIdBlacklist);
    });

    ctx.status = 200;
  }
});

// for Facebook webhook verification
router.get('/callback', ctx => {
  if (ctx.request.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    ctx.body = ctx.request.query['hub.challenge'];
  } else {
    ctx.body = 'Validation failed, Verify token mismatch';
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

// get page access token and then start listening
getLongLivedPageAccessToken()
  .then(() => {
    console.log('Long-lived page access token fetched');
    // Fetch a new page access token every 14 days
    // setInterval(() => getLongLivedPageAccessToken(), 14 * 86400 * 1000);

    app.listen(process.env.PORT, () => {
      // eslint-disable-next-line no-console
      console.log('Listening port', process.env.PORT);
    });
  })
  .catch(e => {
    console.error(e);
    process.exit();
  });
