import {
  pagePublicContentAccess,
  checkCommentCommentable,
  replyToComment,
} from './fbClient';
import handleInput from './handleInput';

const mentionEventHandler = async (context, instance) => {
  // check if this comment is already a child comment
  const canComment = await checkCommentCommentable(instance.value.comment_id);
  if (!canComment) {
    return;
  }

  // get post content
  const inputStr = await pagePublicContentAccess(instance.value.post_id);
  // get analysed content
  const params = await handleInput(
    { state: '__INIT__' },
    { input: inputStr },
    instance.time,
    '0' // for comments
  );

  // reply to comment
  await replyToComment(
    instance.value.comment_id,
    params.replies[0].content.text
  );
};

export default mentionEventHandler;
