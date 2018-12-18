import {
  pagePublicContentAccess,
  checkCommentCommentable,
  replyToComment,
} from './fbClient';
import handleInput from './handleInput';

const mentionEventHandler = async (context, instance) => {
  console.log(instance);
  // get post content
  const inputStr = await pagePublicContentAccess(instance.value.post_id);
  console.log('msg: ' + inputStr);

  // get analysed content
  const params = await handleInput(
    { state: '__INIT__' },
    { input: inputStr },
    instance.time,
    0 // for comments
  );
  console.log(params)
  // check if this comment is already a child comment
  const canComment = await checkCommentCommentable(instance.value.comment_id);
  if (canComment) {
    // reply to her comment
    await replyToComment(
      instance.value.comment_id,
      params.replies.content.text
    );
  }
};

export default mentionEventHandler;
