import rollbar from './rollbar';
import getRawBody from 'raw-body';
import crypto from 'crypto';

const SECRET = process.env.APP_SECRET;

/**
 * Check if the raw content is valid.
 * @param {*} raw raw content
 * @param {*} SECRET facebook app secret
 * @param {*} signature signature in request
 */
function validateSignature(raw, SECRET, signature) {
  if (signature) {
    return (
      signature ===
      `sha1=${crypto
        .createHmac('sha1', SECRET)
        .update(raw)
        .digest('hex')}`
    );
  }

  return false;
}

/**
 * Check if the raw content is valid and parse request body.
 * @param {*} ctx 
 * @param {*} next 
 */
async function checkSignatureAndParse(ctx, next) {
  const raw = await getRawBody(ctx.req, {
    length: ctx.request.headers['content-length'],
  });
  const signature = ctx.request.headers['x-hub-signature'];
  if (!validateSignature(raw, SECRET, signature)) {
    ctx.status = 401;
    ctx.body = 'x-hub-signature and hash does not match';

    rollbar.warning(ctx.body, ctx.request, {
      signature,
    });
  } else {
    ctx.request.body = JSON.parse(raw.toString('utf8'));
    await next();
  }
}

export default checkSignatureAndParse;
