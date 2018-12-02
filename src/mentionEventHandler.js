import { pagePublicContentAccess, replyToComment } from './fbClient';
import handleInput from './handleInput';

const mentionEventHandler = async (context, instance) => {
  console.log(instance);
  // get post content
  const input = await pagePublicContentAccess(instance.value.post_id);
  console.log('msg: ' + input);
  try {
    throw new Error();
    /*
    // TODO: query
    // attempt to reply in message
    const issuedAt = Date.now();
    const result = await handleInput(
      context,
      { input, type: 'text' },
      issuedAt,
      userId,
    );

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
    */
  } catch (e) {
    // cannot send msg to the user so reply to her comment instead
    await replyToComment(instance.value.comment_id, input);
  }
};

export default mentionEventHandler;
